const MOCK_SLOTS = [
	{ id: 'slot-1', mode: 'tele', when: 'today 6:00 PM' },
	{ id: 'slot-2', mode: 'in-person', when: 'tomorrow 9:30 AM' },
	{ id: 'slot-3', mode: 'tele', when: 'tomorrow 7:00 PM' },
];

export function getSuggestedSlots(preferredMode) {
	if (!preferredMode) return MOCK_SLOTS;
	return MOCK_SLOTS.filter(s => s.mode === preferredMode).concat(MOCK_SLOTS.filter(s => s.mode !== preferredMode).slice(0,1));
}

export function formatSlotOptions(slots) {
	return slots.map(s => `${s.mode === 'tele' ? 'Teleconsultation' : 'In-person'}: ${s.when}`).join(' | ');
}


