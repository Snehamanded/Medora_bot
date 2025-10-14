import multer from 'multer';
import fs from 'fs';

const upload = multer({ dest: 'tmp/' });
export const ocrUploadMiddleware = upload.single('file');

export function readFileAsBase64(path) {
	const buf = fs.readFileSync(path);
	return buf.toString('base64');
}


