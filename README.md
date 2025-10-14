## MEDORA WhatsApp Triage Bot (Node.js + Express + Gemini)

Run locally:

1. Create `.env` with:
   - `GEMINI_API_KEY=<your key>`
   - `WHATSAPP_VERIFY_TOKEN=<string>`
   - `WHATSAPP_BUSINESS_PHONE_ID=<id>`
   - `WHATSAPP_ACCESS_TOKEN=<token>`
   - `PORT=8080`
2. Install deps: `npm i`
3. Dev server: `npm run dev`
4. Start: `npm start`

Endpoints:
- `POST /webhook/whatsapp` – inbound messages (configure your WhatsApp webhook)
- `GET /health` – health check
- `POST /ocr` – upload `file` (multipart/form-data) for OCR+Gemini analysis

Core features:
- Dynamic OLDCARTS extraction and gap analysis
- Gemini reasoning for follow-ups, triage, and booking suggestions
- OCR intake for images/reports, structured entity extraction
- Clinician handoff summary



