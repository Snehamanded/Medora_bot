import express from 'express';
import { handleUserMessage, getSession } from '../orchestrator/conversation.js';
import { sendWhatsAppText, getMediaUrl, downloadMedia } from '../services/whatsapp.js';
import { analyzeDocumentWithGemini } from '../services/gemini.js';

export const whatsappRouter = express.Router();

// Meta/WhatsApp webhook verification (GET)
whatsappRouter.get('/', (req, res) => {
	const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
	const mode = req.query['hub.mode'];
	const token = req.query['hub.verify_token'];
	const challenge = req.query['hub.challenge'];
	console.log('Webhook verify', { mode, tokenOk: token === verifyToken });
	if (mode === 'subscribe' && token === verifyToken) {
		return res.status(200).send(challenge);
	}
	return res.sendStatus(403);
});

// Simple ping to confirm routing/logging
whatsappRouter.get('/ping', (req, res) => {
	console.log('Ping /webhook/whatsapp/ping received');
	res.json({ ok: true, at: Date.now() });
});

// Inbound messages (POST)
whatsappRouter.post('/', async (req, res) => {
	try {
		const body = req.body;
		console.log('Inbound WA webhook START', {
			method: req.method,
			url: req.originalUrl,
			headers: {
				'user-agent': req.headers['user-agent'],
				'x-forwarded-for': req.headers['x-forwarded-for'],
				'content-type': req.headers['content-type']
			}
		});
		console.log('Inbound WA webhook BODY', JSON.stringify(body));
		let delivered = false;
		for (const entry of (body && body.entry) || []) {
			for (const change of entry.changes || []) {
				const messages = (change.value && change.value.messages) || [];
				if (!messages.length) {
					console.log('No messages array on change.value, keys:', Object.keys(change.value || {}));
				}
				for (const m of messages) {
					const from = m.from;
					// Deduplicate by message id per sender to avoid loops/retries
					try {
						const session = getSession(from);
						if (session.lastMessageId === m.id) {
							console.log('Duplicate message ignored', m.id);
							continue;
						}
						session.lastMessageId = m.id;
					} catch {}
                    if ((m.type === 'image' || m.type === 'document') && process.env.ENABLE_MEDIA === 'true') {
						const id = (m.image && m.image.id) || (m.document && m.document.id);
						const mime = (m.image && m.image.mime_type) || (m.document && m.document.mime_type) || 'application/octet-stream';
						const mediaUrl = await getMediaUrl(id);
						if (mediaUrl) {
							const base64 = await downloadMedia(mediaUrl);
							const result = await analyzeDocumentWithGemini(base64, mime);
							const text = `I analyzed the report. Key points: ${JSON.stringify(result).slice(0, 900)}`;
							const sendRes = await sendWhatsAppText(from, text);
							console.log('Send result (ocr)', sendRes);
							delivered = true;
							continue;
						}
					}
					// Interactive button replies
					if (m.type === 'interactive') {
						const id = m.interactive?.button_reply?.id || m.interactive?.list_reply?.id || m.interactive?.nfm_reply?.response_json;
						if (id) {
							const reply = await handleInteractiveReply(from, id);
							const sendRes = await sendWhatsAppText(from, reply);
							console.log('Send result (interactive)', sendRes);
							delivered = true;
							continue;
						}
					}
					const text = extractIncomingText(m);
					if (!text) { console.log('Unsupported message type, skipping', m.type); continue; }
					console.log('Incoming message from', from, text);
					const reply = await handleUserMessage(from, text);
					const sendRes = await sendWhatsAppText(from, reply);
					console.log('Send result', sendRes);
					delivered = true;
				}
				// Log statuses to help debug delivery
				if (change.value && change.value.statuses) {
					console.log('Statuses', JSON.stringify(change.value.statuses));
				}
			}
		}
		if (!delivered) console.warn('No inbound messages parsed in this webhook payload');
		console.log('Inbound WA webhook END');
		res.sendStatus(200);
	} catch (e) {
		console.error('Webhook error', e);
		res.sendStatus(200);
	}
});

function extractIncomingText(message) {
	if (message.type === 'text') return message.text?.body || '';
	if (message.type === 'button') return message.button?.text || '';
	if (message.type === 'interactive') {
		const n = message.interactive?.nfm_reply?.response_json || message.interactive?.list_reply?.title || message.interactive?.button_reply?.title;
		return n || '';
	}
	return '';
}


