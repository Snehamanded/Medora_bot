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

// Mock directory of top doctors by specialty; region filtering is demo-only
const DOCTOR_DIRECTORY = {
	Neurology: [
		{ id: 'doc-neuro-1', name: 'Dr. A. Rao', hospital: 'City Neuro Clinic', city: 'Hubli-Dharwad' },
		{ id: 'doc-neuro-2', name: 'Dr. M. Sharma', hospital: 'Neuro Care', city: 'Belgaum' },
		{ id: 'doc-neuro-3', name: 'Dr. K. Iyer', hospital: 'Neuro Health', city: 'Hubli' },
	],
	Cardiology: [
		{ id: 'doc-cardio-1', name: 'Dr. R. Singh', hospital: 'Heart Care Center', city: 'Belgaum' },
		{ id: 'doc-cardio-2', name: 'Dr. P. Menon', hospital: 'Fortis Heart', city: 'Hubli-Dharwad' },
		{ id: 'doc-cardio-3', name: 'Dr. S. Patil', hospital: 'Pulse Institute', city: 'Hubli' },
	],
	Orthopedics: [
		{ id: 'doc-ortho-1', name: 'Dr. T. Khanna', hospital: 'OrthoPlus', city: 'Hubli-Dharwad' },
		{ id: 'doc-ortho-2', name: 'Dr. V. Reddy', hospital: 'Bone & Joint', city: 'Belgaum' },
		{ id: 'doc-ortho-3', name: 'Dr. G. Joshi', hospital: 'Care Hospitals', city: 'Hubli' },
	],
	Gastroenterology: [
		{ id: 'doc-gi-1', name: 'Dr. N. Shah', hospital: 'GI Center', city: 'Belgaum' },
		{ id: 'doc-gi-2', name: 'Dr. B. Das', hospital: 'Digestive Institute', city: 'Hubli-Dharwad' },
		{ id: 'doc-gi-3', name: 'Dr. H. Kumar', hospital: 'Apollo', city: 'Hubli' },
	],
	Urology: [
		{ id: 'doc-uro-1', name: 'Dr. S. Nair', hospital: 'UroCare', city: 'Hubli-Dharwad' },
		{ id: 'doc-uro-2', name: 'Dr. R. Gupta', hospital: 'City Hospital', city: 'Belgaum' },
		{ id: 'doc-uro-3', name: 'Dr. P. Kulkarni', hospital: 'HealthFirst', city: 'Hubli' },
	],
	Dermatology: [
		{ id: 'doc-derm-1', name: 'Dr. L. Jain', hospital: 'SkinLab', city: 'Hubli-Dharwad' },
		{ id: 'doc-derm-2', name: 'Dr. C. Roy', hospital: 'DermaCare', city: 'Belgaum' },
		{ id: 'doc-derm-3', name: 'Dr. E. Dutta', hospital: 'Glow Clinic', city: 'Hubli' },
	],
	Gynecology: [
		{ id: 'doc-gyn-1', name: 'Dr. F. Sinha', hospital: 'Women’s Health', city: 'Belgaum' },
		{ id: 'doc-gyn-2', name: 'Dr. Z. Khan', hospital: 'Care Mother & Child', city: 'Hubli-Dharwad' },
		{ id: 'doc-gyn-3', name: 'Dr. Y. Pillai', hospital: 'LifeCare', city: 'Hubli' },
	],
	ENT: [
		{ id: 'doc-ent-1', name: 'Dr. D. Mehta', hospital: 'Ear Nose Throat Center', city: 'Belgaum' },
		{ id: 'doc-ent-2', name: 'Dr. O. Verma', hospital: 'Sinus & Voice Clinic', city: 'Hubli-Dharwad' },
		{ id: 'doc-ent-3', name: 'Dr. J. Rao', hospital: 'Apollo ENT', city: 'Hubli' },
	],
};

export function getTopDoctorsByRegion(specialty, regionText) {
	const list = DOCTOR_DIRECTORY[specialty] || [];
	if (!regionText) return list.slice(0, 3);
	const region = String(regionText).toLowerCase();
	const aliases = ['hubli', 'hubballi', 'dharwad', 'hubli-dharwad', 'belgaum', 'belagavi'];
	const regionMatch = aliases.find(a => region.includes(a)) || region;
	const filtered = list.filter(d => d.city.toLowerCase().includes(regionMatch));
	const results = (filtered.length ? filtered : list).slice(0, 3);
	return results;
}


