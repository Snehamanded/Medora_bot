import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

function getClient() {
	const apiKey = process.env.GEMINI_API_KEY;
	if (!apiKey) return null;
	return new GoogleGenerativeAI(apiKey);
}

export async function geminiStructuredPrompt(systemInstruction, userContent) {
	const client = getClient();
	if (!client) return null;
    const model = client.getGenerativeModel({ model: GEMINI_MODEL, systemInstruction });
	const result = await model.generateContent(userContent);
	const text = result.response.text();
	return text;
}

export async function geminiJsonPrompt(systemInstruction, userContent) {
	const client = getClient();
	if (!client) return null;
    const model = client.getGenerativeModel({ model: GEMINI_MODEL, systemInstruction, generationConfig: { responseMimeType: 'application/json' } });
	const result = await model.generateContent(userContent);
	const text = result.response.text();
	try {
		return JSON.parse(text);
	} catch {
		return null;
	}
}

export async function inferOldcartsFromNarrative(narrative) {
	const systemInstruction = 'Extract OLDCARTS (Onset, Location, Duration, Character, Aggravating/Relieving, Related, Severity/Impact) as JSON. Use null for unknown.';
	const userContent = `Patient narrative: ${narrative}`;
	return await geminiJsonPrompt(systemInstruction, userContent);
}

export async function suggestFollowUps(missingKeys, context) {
    const systemInstruction = 'You are a clinician. Ask exactly 1 short, natural follow-up question (one sentence) focusing ONLY on the most important missing OLDCARTS field provided. Do not ask multiple questions. Avoid lists.';
	const userContent = `Missing: ${missingKeys.join(', ')}\nContext: ${JSON.stringify(context)}`;
	const text = await geminiStructuredPrompt(systemInstruction, userContent);
	return text || null;
}

// Dynamic OLDCARTS extraction from free-text narrative
export async function extractOldcartsFromNarrative(narrative, existingOldcarts = {}) {
    const systemInstruction = `Extract OLDCARTS (Onset, Location, Duration, Character, Aggravating/Relieving, Related, Severity/Impact) from patient narrative as JSON. 
    - Onset: When did it start? Sudden or gradual?
    - Location: Where is it located? Does it spread?
    - Duration: Continuous, intermittent, or episodic?
    - Character: Nature of pain/feeling – throbbing, dull, stabbing, etc.
    - Aggrav_relieve: Triggers, medications, rest, what makes it better/worse
    - Related: Associated symptoms like fever, nausea, dizziness, shortness of breath
    - Severity_impact: Effect on daily life, functional impact, linguistic severity cues
    Use null for unknown fields. Merge with existing data, don't overwrite.`;
    
    const userContent = `Patient narrative: "${narrative}"\nExisting OLDCARTS: ${JSON.stringify(existingOldcarts)}`;
    return await geminiJsonPrompt(systemInstruction, userContent);
}

// Dynamic contextual follow-up generation
export async function generateContextualFollowUp(narrative, oldcarts, chatHistory) {
    const systemInstruction = `You are a clinician having a natural conversation. Based on the patient's narrative and current OLDCARTS data, ask ONE conversational follow-up question to clarify the most clinically important missing information. 
    - Be natural and contextual, not robotic
    - Reference what they've already told you
    - Focus on the most important missing detail
    - Ask ONLY ONE question - never multiple questions
    - Keep it conversational, like a real doctor would ask
    - Examples: "When did this start?" or "Can you describe the pain?" or "Are you experiencing any other symptoms?"
    - NOT: "When did this start and can you describe the pain?"`;
    
    const userContent = `Patient narrative: "${narrative}"\nCurrent OLDCARTS: ${JSON.stringify(oldcarts)}\nRecent conversation: ${JSON.stringify(chatHistory.slice(-3))}`;
    const text = await geminiStructuredPrompt(systemInstruction, userContent);
    return text || null;
}

// Dynamic triage with risk bands and specialty suggestions
export async function performDynamicTriage(oldcarts, narrative) {
    const systemInstruction = `Analyze the patient's OLDCARTS and narrative to provide dynamic triage assessment. Return JSON with:
    - risk_band: "Emergency" | "Urgent" | "Soon (24-72h)" | "Routine" | "Self-care"
    - specialty: Array of suggested specialties (e.g., ["Neurology", "Cardiology"])
    - care_mode: "tele" | "in-person" | "emergency"
    - rationale: Brief clinical reasoning
    - red_flags: Array of any concerning symptoms found`;
    
    const userContent = `OLDCARTS: ${JSON.stringify(oldcarts)}\nNarrative: "${narrative}"`;
    return await geminiJsonPrompt(systemInstruction, userContent);
}

// Generate conversational booking offers
export async function generateBookingOffer(triageResult, narrative) {
    const systemInstruction = `Based on the triage assessment, generate a natural conversational booking offer. Be friendly and professional, like a real doctor would speak. Include:
    - Brief assessment summary
    - Recommendation for consultation type
    - Offer of available options (tele/in-person)
    - Next steps`;
    
    const userContent = `Triage: ${JSON.stringify(triageResult)}\nPatient concern: "${narrative}"`;
    const text = await geminiStructuredPrompt(systemInstruction, userContent);
    return text || null;
}

// Generate clinician handoff summary
export async function generateClinicianSummary(chiefComplaint, oldcarts, triageResult, attachments = []) {
    const systemInstruction = `Generate a comprehensive clinician handoff summary. Include:
    - Chief complaint
    - Complete OLDCARTS assessment
    - Risk assessment and red flags
    - Recommended specialty and care mode
    - Attached documents summary (if any)
    - Key clinical points for the doctor`;
    
    const userContent = `Chief complaint: "${chiefComplaint}"\nOLDCARTS: ${JSON.stringify(oldcarts)}\nTriage: ${JSON.stringify(triageResult)}\nAttachments: ${JSON.stringify(attachments)}`;
    const text = await geminiStructuredPrompt(systemInstruction, userContent);
    return text || null;
}

export async function geminiTriage(oldcarts, narrative) {
	const systemInstruction = 'Given OLDCARTS + narrative, return JSON with risk_band (Emergency|Urgent|Soon|Routine|Self-care), specialty array, and brief rationale.';
	const userContent = `OLDCARTS: ${JSON.stringify(oldcarts)}\nNarrative: ${narrative}`;
	return await geminiJsonPrompt(systemInstruction, userContent);
}

export async function analyzeDocumentWithGemini(base64, mimeType) {
	const client = getClient();
	if (!client) return null;
	const model = client.getGenerativeModel({ model: GEMINI_MODEL });
	const result = await model.generateContent([
		{ text: 'Extract key findings and entities suitable for a clinician from this report or image as JSON.' },
		{ inlineData: { data: base64, mimeType } }
	]);
	try {
		return JSON.parse(result.response.text());
	} catch {
		return { summary: result.response.text() };
	}
}

// MEDORA Assist - Fully Gemini-controlled medical triage
export async function medoraTriageTurn(history, userText) {
    const client = getClient();
    if (!client) return null;
    
    const systemInstruction = `You are MEDORA Assist, a virtual medical triage assistant. 

CORE BEHAVIOR:
- Use natural, empathetic clinical language like a real doctor
- Understand patient symptoms from free-form text without rigid questioning
- Ask ONE question at a time - never ask multiple questions in a single response
- Provide conversational follow-ups when necessary, adapting like a doctor speaking to a patient
- Classify case urgency: Emergency, Urgent, Routine, Self-care
- Recommend appropriate specialist or self-care guidance
- Offer teleconsultation or clinic booking suggestions when appropriate

CONVERSATION STYLE:
- Be warm, professional, and reassuring
- Ask ONE natural follow-up question based on what the patient tells you
- Focus on the most important missing information
- Don't use rigid question lists - adapt to the conversation flow
- If you detect red flags, advise emergency care immediately
- Keep responses concise and focused on a single question or statement

RESPONSE FORMAT:
Always respond with natural conversation text. The patient should feel like they're talking to a real doctor.

CRITICAL: Ask only ONE question per response. Never ask multiple questions in a single response.

CORRECT examples:
- "When did this start?"
- "Can you describe the pain?"
- "Are you experiencing any other symptoms?"
- "What were some of the readings you've seen?"
- "Do you have any existing medical conditions?"

WRONG examples (NEVER do this):
- "When did this start and can you describe the pain?"
- "Are you experiencing nausea, vomiting, or sensitivity to light?"
- "When did you notice your blood pressure increasing, and what were some of the readings you've seen?"
- "Are you experiencing any other symptoms along with this, like headaches, dizziness, chest pain, or changes in your vision?"

If you need to ask about multiple things, ask them one at a time in separate responses.

SPECIFIC EXAMPLE - Blood Pressure:
Instead of: "When did you notice your blood pressure increasing, and what were some of the readings you've seen?"
Ask: "When did you notice your blood pressure increasing?"

Then in the next response: "What were some of the readings you've seen?"

For triage decisions, internally consider:
- Risk level (Emergency/Urgent/Routine/Self-care)
- Appropriate specialty (if needed)
- Whether booking is recommended
- Any red flags requiring immediate attention

Remember: You are the medical reasoning engine. Make clinical decisions naturally through conversation with ONE question at a time.`;

    const model = client.getGenerativeModel({ model: GEMINI_MODEL, systemInstruction });
    
    // Build conversation context
    const context = history && history.length ? 
        history.map(m => `${m.role.toUpperCase()}: ${m.text}`).join('\n') : '';
    
    const prompt = context ? `${context}\n\nPATIENT: ${userText}` : `PATIENT: ${userText}`;
    const result = await model.generateContent(prompt);
    return result.response.text();
}

// Generate structured triage assessment for internal use
export async function generateTriageAssessment(history, userText) {
    const client = getClient();
    if (!client) return null;
    
    const systemInstruction = `You are a medical triage system. Analyze the conversation and return ONLY a valid JSON object with no markdown, no code blocks, no explanations. 

Required JSON format:
{
  "assessment": "Brief clinical assessment of the condition",
  "urgency": "Emergency" | "Urgent" | "Routine" | "Self-care",
  "recommendation": "Specific recommendation for care or specialist referral",
  "specialty": "Most appropriate medical specialty (e.g., Cardiology, Gastroenterology, Neurology, Dermatology, Orthopedics, Psychiatry, Pulmonology, etc.)"
}

Return ONLY the JSON object, nothing else.`;
    
    const model = client.getGenerativeModel({ model: GEMINI_MODEL, systemInstruction });
    const context = history.map(m => `${m.role.toUpperCase()}: ${m.text}`).join('\n');
    const prompt = `Conversation:\n${context}\n\nLatest patient message: ${userText}`;
    
    const result = await model.generateContent(prompt);
    try {
        let responseText = result.response.text();
        
        // Handle Gemini's markdown code block format more robustly
        if (responseText.includes('```json')) {
            // Extract content between ```json and ```
            const match = responseText.match(/```json\s*([\s\S]*?)\s*```/);
            if (match && match[1]) {
                responseText = match[1].trim();
            }
        } else if (responseText.includes('```')) {
            // Extract content between ``` and ```
            const match = responseText.match(/```\s*([\s\S]*?)\s*```/);
            if (match && match[1]) {
                responseText = match[1].trim();
            }
        }
        
        // Clean up any remaining whitespace and newlines
        responseText = responseText.trim();
        
        return JSON.parse(responseText);
    } catch (e) {
        console.warn('Failed to parse triage assessment JSON', e);
        console.warn('Raw response:', result.response.text());
        console.warn('Cleaned response:', responseText);
        return null;
    }
}

// Generate booking suggestions based on triage
export async function generateBookingSuggestions(triageAssessment, conversationHistory) {
    const client = getClient();
    if (!client) return null;
    
    const systemInstruction = `Based on the triage assessment, generate natural booking suggestions. Be conversational and helpful. Include:
    - Brief assessment summary
    - Recommendation for consultation type (tele/in-person)
    - Available time options (be realistic)
    - Next steps for the patient`;
    
    const model = client.getGenerativeModel({ model: GEMINI_MODEL, systemInstruction });
    const prompt = `Triage Assessment: ${JSON.stringify(triageAssessment)}\nConversation: ${conversationHistory.map(m => `${m.role}: ${m.text}`).join('\n')}`;
    
    const result = await model.generateContent(prompt);
    return result.response.text();
}

// Generate clinician handoff summary
export async function generateClinicianHandoff(conversationHistory, triageAssessment, attachments = []) {
    const client = getClient();
    if (!client) return null;
    
    const systemInstruction = `Generate a comprehensive clinician handoff summary. Include:
    - Chief complaint and symptom progression
    - Key clinical findings from conversation
    - Risk assessment and red flags
    - Recommended specialty and urgency
    - Attached documents summary (if any)
    - Key points for the doctor to focus on
    - Patient concerns and questions`;
    
    const model = client.getGenerativeModel({ model: GEMINI_MODEL, systemInstruction });
    const conversation = conversationHistory.map(m => `${m.role.toUpperCase()}: ${m.text}`).join('\n');
    const prompt = `Conversation:\n${conversation}\n\nTriage: ${JSON.stringify(triageAssessment)}\nAttachments: ${JSON.stringify(attachments)}`;
    
    const result = await model.generateContent(prompt);
    return result.response.text();
}

// Legacy function for backward compatibility
export async function geminiClinicianTurn(history, userText) {
    return await medoraTriageTurn(history, userText);
}


