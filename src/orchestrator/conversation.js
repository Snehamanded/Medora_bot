import { inferOldcartsFromNarrative, suggestFollowUps, geminiTriage } from '../services/gemini.js';
import { mergeOldcarts, getMissingKeys, ruleBasedOldcarts } from '../services/oldcarts.js';
import { heuristicTriage } from '../services/triage.js';
import { getSuggestedSlots, formatSlotOptions } from '../services/booking.js';
import { sendWhatsAppButtons, sendWhatsAppText } from '../services/whatsapp.js';

const sessions = new Map();

export function getSession(userId) {
    if (!sessions.has(userId)) sessions.set(userId, { oldcarts: {}, chief_complaint: '', attachments: [], stage: 'intake', askedKeys: [] });
	return sessions.get(userId);
}

export async function handleUserMessage(userId, text) {
	const s = getSession(userId);
	// Greeting/consent for short or greeting-only inputs
    if (/^(hi|hello|hey)\b/i.test(text.trim())) {
        return 'Hi, I’m MEDORA Assist. I’ll ask a few quick questions like a clinician would, to understand what’s going on and guide you. What’s bothering you today?';
    }

	// Immediate red-flag catch (prioritize safety)
    if (/(chest\s*pain|pressure\s*in\s*chest|short(ness)?\s*of\s*breath|one\s*side\s*weak|face\s*droop|speech\s*slur|worst\s+headache|thunderclap|faint(ed)?|confusion|hives\s*with\s*swelling|throat\s*tight)/i.test(text)) {
		return 'Your symptoms could be serious. If this is severe, sudden, worsening, or with breathlessness, sweating, or fainting, please seek emergency care immediately (local emergency number). If you’re stable, I can still help—when did this start and what were you doing when it began?';
	}

    // If we asked a specific key previously and it's still missing, accept user's free-text as the answer
    if (s.lastAskedKey) {
        const key = s.lastAskedKey;
        const currentMissing = getMissingKeys(s.oldcarts);
        if (currentMissing.includes(key)) {
            s.oldcarts[key] = text; // capture as-is to avoid loops on phrasing
        }
        if (!s.askedKeys.includes(key)) s.askedKeys.push(key);
        s.lastAskedKey = undefined;
    }
	if (!s.chief_complaint) s.chief_complaint = text;

	// Extract/infer OLDCARTS (tolerate AI errors)
	let aiExtract = null;
	try {
		aiExtract = await inferOldcartsFromNarrative(text);
	} catch (e) {
		console.warn('inferOldcarts error', e);
	}
	const rb = ruleBasedOldcarts(text);
	s.oldcarts = mergeOldcarts(s.oldcarts, aiExtract || rb || {});

    const missing = getMissingKeys(s.oldcarts);
    if (missing.length > 0) {
        // Ask only ONE focused question at a time to avoid repeats
        const nextKey = chooseNextKey(missing, s.lastAskedKey, s.askedKeys);
        if (nextKey) {
            const question = focusedQuestionFor(nextKey);
            s.lastAskedKey = nextKey;
            s.lastReplyText = question;
            if (!s.askedKeys.includes(nextKey)) s.askedKeys.push(nextKey);
            return question;
        }
        // If we've already asked up to 4 focused questions, proceed to triage to avoid loops
        if (s.askedKeys.length >= 4) {
            // fall through to triage below
        } else {
            // ask a generic catch-all once
            s.lastAskedKey = undefined;
            return defaultFollowUps(missing.slice(0,1));
        }
    }

    // Triage once enough information captured (>=3 slots or explicit complaint)
    const filledCount = Object.values(s.oldcarts).filter(v => v !== undefined && v !== null && String(v).trim() !== '').length;
    let risk = null;
	try {
        if (filledCount >= 3) {
            // Include latest message content to avoid stale chief complaint (e.g., chest pain after headache)
            risk = await geminiTriage(s.oldcarts, `${s.chief_complaint} ${text}`.trim());
        }
	} catch (e) {
		console.warn('geminiTriage error', e);
	}
    if (!risk) risk = heuristicTriage(`${s.chief_complaint} ${text}`.trim(), s.oldcarts);
    s.risk = risk;
	s.stage = 'triage';
    // reset asked keys once we enter triage/booking
    s.askedKeys = [];

    const slots = getSuggestedSlots(risk?.care_mode || null);
    const label = buildHumanAssessment(risk, s.chief_complaint);
    // Send mode choice via buttons
    s.stage = 'booking_mode';
    s.risk = risk;
    s.suggestedSlots = slots;
    await sendWhatsAppButtons(userId, `${label}\nHow would you like to consult?`, [
        { id: 'mode_tele', title: 'Teleconsultation' },
        { id: 'mode_inperson', title: 'In-person' }
    ]);
    if (process.env.ENABLE_MEDIA === 'true') {
        await sendWhatsAppText(userId, 'If you have any medical reports or images (like lab tests or prescriptions), please upload them here 📎. I’ll summarize them for your doctor.');
    }
    return 'Please choose an option above.';
}

function defaultFollowUps(missing) {
	const map = {
		onset: 'When did this start? Was it sudden or gradual?',
		location: 'Where exactly do you feel it? Does it spread?',
		duration: 'Is it continuous, intermittent, or does it come in episodes?',
		character: 'How would you describe it: throbbing, dull, stabbing, pressure?',
		aggrav_relieve: 'What makes it better or worse? Any meds tried?',
		related: 'Any associated symptoms like fever, nausea, dizziness, breathlessness?',
		severity_impact: 'How is this affecting your day (sleep, work, appetite)?',
	};
	return missing.map(k => map[k]).filter(Boolean).slice(0,2).join(' ');
}

function buildHumanAssessment(risk, complaint) {
    const band = risk?.risk_band || 'Routine';
    const spec = risk?.specialty?.join(', ') || 'General Practice';
    let sentence;
    if (spec.includes('Neurology') && /headache|migraine/i.test(complaint)) {
        sentence = 'This sounds like a migraine-type headache. It’s not an emergency, but you should consult a neurologist soon to manage it properly.';
    } else if (spec.includes('Cardiology')) {
        sentence = 'Chest symptoms warrant cardiac evaluation. If pain is severe, crushing, or with breathlessness/sweating, seek emergency care; otherwise a cardiology consult is advisable soon.';
    } else if (spec.includes('Orthopedics')) {
        sentence = 'This appears musculoskeletal. Not an emergency, but an orthopedics consult is recommended.';
    } else if (spec.includes('Gastroenterology')) {
        sentence = 'This seems gastrointestinal. You can see a gastroenterologist soon for evaluation.';
    } else if (spec.includes('Urology')) {
        sentence = 'Your description suggests a urinary tract issue. Increase hydration and consider a urinalysis; a urology consult is recommended soon.';
    } else if (spec.includes('Dermatology')) {
        sentence = 'This looks dermatologic. Avoid new products on the area; a dermatology review is recommended.';
    } else if (spec.includes('Gynecology')) {
        sentence = 'This appears gynecologic. If heavy bleeding or severe pain, seek urgent care; otherwise schedule a gynecology consult soon.';
    } else if (spec.includes('ENT')) {
        sentence = 'This fits an ear–nose–throat pattern. An ENT consult can help with targeted treatment.';
    } else {
        sentence = `Assessment: ${band}. Suggested specialty: ${spec}.`;
    }
    return sentence;
}

// Handle button replies in webhook → conversation entry
export async function handleInteractiveReply(userId, id) {
    const s = getSession(userId);
    if (id === 'mode_tele' || id === 'mode_inperson') {
        const mode = id === 'mode_tele' ? 'tele' : 'in-person';
        s.preferredMode = mode;
        s.stage = 'booking_datetime';
        return `Great. For ${mode === 'tele' ? 'a teleconsultation' : 'an in-person visit'}, please share a preferred date and time (e.g., "tomorrow 6pm" or "2025-10-15 09:30").`;
    }
    if (id.startsWith('slot_')) {
        s.chosenSlotId = id;
        s.stage = 'booking_confirm';
        return 'Thanks. I’ll secure that slot and you’ll receive a booking confirmation within 2 hours with all details.';
    }
    return 'Noted.';
}

function focusedQuestionFor(key) {
    const map = {
        onset: 'When did this begin? Did it come on suddenly or build up?',
        location: 'Where is it located? Does the pain/sensation travel anywhere?',
        duration: 'Has it been constant, or does it come and go?',
        character: 'What does it feel like—throbbing, dull, sharp, pressure?',
        aggrav_relieve: 'Have you noticed anything that triggers it or eases it? Any medicines taken?',
        related: 'Have you had fever, nausea, dizziness, breathlessness, or anything else with this?',
        severity_impact: 'How much is this affecting your routine—sleep, work, eating, or movement?',
    };
    return map[key] || 'Can you share a bit more about this symptom?';
}

function chooseNextKey(missing, lastAskedKey, askedKeys = []) {
    const alt = missing.find(k => k !== lastAskedKey && !askedKeys.includes(k));
    return alt || missing[0];
}


