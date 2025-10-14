import 'dotenv/config';
import express from 'express';
import pino from 'pino';
import pinoHttp from 'pino-http';
import { whatsappRouter } from './webhook/whatsapp.js';
import { ocrRouter } from './routes/ocr.js';
import fs from 'fs';

const logger = pino({
	level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
	transport: process.env.NODE_ENV === 'production' ? undefined : { target: 'pino-pretty' },
});

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(pinoHttp({ logger }));

// Lightweight request tracer
app.use((req, _res, next) => {
	console.log('REQ', { method: req.method, url: req.originalUrl, 'content-type': req.headers['content-type'] });
	next();
});

app.get('/health', (_req, res) => {
	res.json({ ok: true });
});

app.use('/webhook/whatsapp', whatsappRouter);
app.use('/ocr', ocrRouter);

// Central error handler with logging
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
	req?.log?.error?.({ err }, 'Unhandled app error');
	console.error('Unhandled app error', err);
	res.status(500).json({ ok: false });
});

const port = Number(process.env.PORT ?? 8080);
// Ensure tmp upload directory exists
try { fs.mkdirSync('tmp', { recursive: true }); } catch {}
app.listen(port, () => {
	logger.info({ port }, 'MEDORA WhatsApp triage bot listening');
});

process.on('unhandledRejection', (reason, p) => {
	console.error('Unhandled Rejection at:', p, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
	console.error('Uncaught Exception thrown', err);
});


