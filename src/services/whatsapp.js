import fetch from 'node-fetch';

const BASE_URL = 'https://graph.facebook.com/v20.0';

export async function sendWhatsAppText(to, body) {
	const token = process.env.WHATSAPP_ACCESS_TOKEN;
	const phoneId = process.env.WHATSAPP_BUSINESS_PHONE_ID;
	if (!token || !phoneId) return;
	const resp = await fetch(`${BASE_URL}/${phoneId}/messages`, {
		method: 'POST',
		headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
		body: JSON.stringify({
			messaging_product: 'whatsapp',
			to,
			type: 'text',
			text: { body }
		})
	});
	if (!resp.ok) {
		const text = await resp.text().catch(() => '');
		console.error('WhatsApp send error', resp.status, text);
		return { ok: false, status: resp.status, body: text };
	}
	return { ok: true, status: resp.status };
}

export async function sendWhatsAppTemplate(to, name, languageCode) {
	const token = process.env.WHATSAPP_ACCESS_TOKEN;
	const phoneId = process.env.WHATSAPP_BUSINESS_PHONE_ID;
	if (!token || !phoneId) return;
	const resp = await fetch(`${BASE_URL}/${phoneId}/messages`, {
		method: 'POST',
		headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
		body: JSON.stringify({
			messaging_product: 'whatsapp',
			to,
			type: 'template',
			template: { name, language: { code: languageCode || 'en_US' } }
		})
	});
	if (!resp.ok) {
		const text = await resp.text().catch(() => '');
		console.error('WhatsApp template send error', resp.status, text);
		return { ok: false, status: resp.status, body: text };
	}
	return { ok: true, status: resp.status };
}

export async function getMediaUrl(mediaId) {
	const token = process.env.WHATSAPP_ACCESS_TOKEN;
	if (!token) return null;
	const resp = await fetch(`${BASE_URL}/${mediaId}`, {
		headers: { Authorization: `Bearer ${token}` }
	});
	if (!resp.ok) {
		const text = await resp.text().catch(() => '');
		console.error('Get media URL error', resp.status, text);
		return null;
	}
	const json = await resp.json();
	return json.url || null;
}

export async function downloadMedia(url) {
	const token = process.env.WHATSAPP_ACCESS_TOKEN;
	if (!token) return null;
	const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
	if (!resp.ok) {
		const text = await resp.text().catch(() => '');
		console.error('Download media error', resp.status, text);
		return null;
	}
	const buf = await resp.buffer();
	return buf.toString('base64');
}

export async function sendWhatsAppButtons(to, text, buttons) {
	const token = process.env.WHATSAPP_ACCESS_TOKEN;
	const phoneId = process.env.WHATSAPP_BUSINESS_PHONE_ID;
	if (!token || !phoneId) return;
	const payload = {
		messaging_product: 'whatsapp',
		to,
		type: 'interactive',
		interactive: {
			type: 'button',
			body: { text },
			action: {
				buttons: buttons.map(b => ({ type: 'reply', reply: { id: b.id, title: b.title } }))
			}
		}
	};
	const resp = await fetch(`${BASE_URL}/${phoneId}/messages`, {
		method: 'POST',
		headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
		body: JSON.stringify(payload)
	});
	if (!resp.ok) {
		const textRes = await resp.text().catch(() => '');
		console.error('WhatsApp buttons send error', resp.status, textRes);
		return { ok: false, status: resp.status, body: textRes };
	}
	return { ok: true, status: resp.status };
}


