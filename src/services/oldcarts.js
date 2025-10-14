const ESSENTIAL_KEYS = ['onset','location','duration','character','aggrav_relieve','related','severity_impact'];

export function mergeOldcarts(existing, incoming) {
	const base = existing || {};
	const next = { ...base };
	for (const key of ESSENTIAL_KEYS) {
		const value = incoming?.oldcarts?.[key] ?? incoming?.[key];
		if (value !== undefined && value !== null && value !== '') next[key] = value;
	}
	return next;
}

export function getMissingKeys(oldcarts) {
	const missing = [];
	for (const key of ESSENTIAL_KEYS) {
		if (oldcarts?.[key] === undefined || oldcarts?.[key] === null || oldcarts?.[key] === '') {
			missing.push(key);
		}
	}
	return missing;
}

export function summarizeOldcarts(oldcarts) {
	const parts = [];
	if (oldcarts.onset) parts.push(`Onset: ${oldcarts.onset}`);
	if (oldcarts.location) parts.push(`Location: ${oldcarts.location}`);
	if (oldcarts.duration) parts.push(`Duration: ${oldcarts.duration}`);
	if (oldcarts.character) parts.push(`Character: ${oldcarts.character}`);
	if (oldcarts.aggrav_relieve) parts.push(`Aggrav/Relieve: ${oldcarts.aggrav_relieve}`);
	if (oldcarts.related) parts.push(`Related: ${Array.isArray(oldcarts.related) ? oldcarts.related.join(', ') : oldcarts.related}`);
	if (oldcarts.severity_impact) parts.push(`Impact: ${JSON.stringify(oldcarts.severity_impact)}`);
	return parts.join(' | ');
}

// Very simple heuristic extraction as a safety net when AI is unavailable
export function ruleBasedOldcarts(text) {
	const t = text.toLowerCase();
	const out = {};
	// onset
	const onsetMatch = t.match(/since\s+([^.,;]+)/) || t.match(/started\s+(?:on\s+)?([^.,;]+)/) || t.match(/for\s+the\s+past\s+([^.,;]+)/);
	if (onsetMatch) out.onset = onsetMatch[1].trim();
	// location
	const locations = ['head', 'headache', 'chest', 'left chest', 'right chest', 'back', 'lower back', 'stomach', 'abdomen', 'throat', 'knee', 'shoulder'];
	for (const loc of locations) { if (t.includes(loc)) { out.location = loc; break; } }
	// character
	const chars = ['throbbing','dull','stabbing','pressure','burning','sharp','cramping'];
	for (const c of chars) { if (t.includes(c)) { out.character = c; break; } }
	// duration pattern words
	if (/intermittent|on\s*and\s*off|episodes?/.test(t)) out.duration = 'intermittent';
	else if (/continuous|constant/.test(t)) out.duration = 'continuous';
	// aggravating/relieving
	if (/worse\s+with\s+light|photophobia/.test(t)) out.aggrav_relieve = 'worse with light';
	if (/better\s+with\s+rest|rest\s+helps/.test(t)) out.aggrav_relieve = (out.aggrav_relieve ? out.aggrav_relieve + '; ' : '') + 'relief with rest';
	// related symptoms
	const related = [];
	if (/nausea/.test(t)) related.push('nausea');
	if (/vomit/.test(t)) related.push('vomiting');
	if (/fever/.test(t)) related.push('fever');
	if (/dizziness|dizzy/.test(t)) related.push('dizziness');
	if (related.length) out.related = related;
	return out;
}


