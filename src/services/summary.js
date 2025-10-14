export function buildClinicianSummary({ chief_complaint, oldcarts, risk, specialty, attachments }) {
	return {
		chief_complaint,
		oldcarts,
		risk_band: risk?.risk_band,
		specialty: risk?.specialty || specialty,
		attachments: attachments || [],
		narrative: buildNarrative(oldcarts),
	};
}

function buildNarrative(oldcarts) {
	const parts = [];
	if (oldcarts?.onset) parts.push(`Onset ${oldcarts.onset}`);
	if (oldcarts?.location) parts.push(`at ${oldcarts.location}`);
	if (oldcarts?.character) parts.push(`${oldcarts.character}`);
	if (oldcarts?.duration) parts.push(`duration ${oldcarts.duration}`);
	if (oldcarts?.aggrav_relieve) parts.push(`triggers/relief: ${oldcarts.aggrav_relieve}`);
	if (oldcarts?.related) parts.push(`associated: ${Array.isArray(oldcarts.related) ? oldcarts.related.join(', ') : oldcarts.related}`);
	if (oldcarts?.severity_impact) parts.push(`impact: ${JSON.stringify(oldcarts.severity_impact)}`);
	return parts.join('; ');
}


