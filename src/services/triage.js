// Simple heuristic fallback if Gemini is unavailable
// Expanded red flags: ACS, stroke, sepsis, anaphylaxis, ectopic etc.
const RED_FLAGS = [
	/"worst"\s+headache|thunderclap/i,
	/chest\s*pain|pressure\s+in\s+chest|tightness\s+in\s+chest/i,
	/short(ness)?\s*of\s*breath|breathless|difficulty\s*breathing|wheeze/i,
	/one\s*side\s*weak(ness)?|face\s*droop|speech\s*slur/i,
	/confusion|faint(ed)?|black(ed)?\s*out|syncope/i,
	/high\s*fever\s*with\s*chills|rigors|rash\s*with\s*fever/i,
	/hives|swelling\s*of\s*(face|lips|tongue)|throat\s*tight/i,
	/pregnan(t|cy).*bleed|severe\s*lower\s*abdominal\s*pain/i,
];

export function heuristicTriage(narrative, oldcarts) {
	const text = `${narrative} ${JSON.stringify(oldcarts || {})}`;
	let risk_band = 'Routine';
	for (const rf of RED_FLAGS) {
		if (rf.test(text)) { risk_band = 'Urgent'; break; }
	}
	if (/bleed|vomit(ing)?\s*blood|black\s*tarry\s*stool/i.test(text)) risk_band = 'Urgent';
	let specialty = ['General Practice'];
	// Neuro
	if (/headache|migraine|dizzy|seizure|vertigo/i.test(text)) specialty = ['Neurology'];
	// Cardiology for chest pain/pressure, exertional dyspnea, palpitations
	if (/chest\s*(pain|pressure|tight(ness)?)|palpitation|exertional\s*breath(lessness)?/i.test(text)) specialty = ['Cardiology'];
	// Orthopedics/MSK
	if (/(back|neck)\s*pain|joint|knee|shoulder|sprain|fracture|injury/i.test(text)) specialty = ['Orthopedics'];
	// Gastroenterology/General surgery for abdominal
	if (/(abdominal|stomach|belly|gastric)\s*pain|nausea|vomit|diarrhea|acid(ity)?|reflux/i.test(text)) specialty = ['Gastroenterology'];
	// Urology/UTI
	if (/burning\s*urination|pain\s*on\s*urination|frequent\s*urination|uti|urine\s*infection/i.test(text)) specialty = ['Urology'];
	// Dermatology
	if (/rash|itch|hives|acne|eczema|psoriasis|skin\s*(lesion|infection)/i.test(text)) specialty = ['Dermatology'];
	// Gynecology
	if (/(menstrual|period|vaginal)\s*(pain|bleed|discharge)|pregnan(t|cy)|pcos|fibroid/i.test(text)) specialty = ['Gynecology'];
	// ENT
	if (/(ear|nose|throat)\s*(pain|block|discharge)|sinus|tonsil|sore\s*throat/i.test(text)) specialty = ['ENT'];
	return { risk_band, specialty, rationale: 'Heuristic triage applied due to unavailable AI.' };
}


