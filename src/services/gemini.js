import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash-latest';

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
	const systemInstruction = 'You are a clinician. Ask at most 2 short, natural follow-up questions focusing ONLY on the missing OLDCARTS fields provided. Avoid lists.';
	const userContent = `Missing: ${missingKeys.join(', ')}\nContext: ${JSON.stringify(context)}`;
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


