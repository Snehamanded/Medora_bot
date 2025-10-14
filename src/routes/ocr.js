import express from 'express';
import mime from 'mime-types';
import { ocrUploadMiddleware, readFileAsBase64 } from '../services/ocr.js';
import { analyzeDocumentWithGemini } from '../services/gemini.js';

export const ocrRouter = express.Router();

ocrRouter.get('/', (_req, res) => {
	res.type('html').send(
		`<html><body>
			<h3>Upload a report/image</h3>
			<form action="/ocr" method="post" enctype="multipart/form-data">
				<input type="file" name="file" accept="image/*,.pdf" />
				<button type="submit">Analyze</button>
			</form>
		</body></html>`
	);
});

ocrRouter.post('/', ocrUploadMiddleware, async (req, res) => {
	try {
		const file = req.file;
		if (!file) return res.status(400).json({ error: 'file required' });
		if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
		const base64 = readFileAsBase64(file.path);
		const mimeType = mime.lookup(file.originalname) || 'application/octet-stream';
		const result = await analyzeDocumentWithGemini(base64, mimeType);
		return res.json({ ok: true, result });
	} catch (e) {
		return res.status(500).json({ ok: false, error: 'processing_failed' });
	}
});


