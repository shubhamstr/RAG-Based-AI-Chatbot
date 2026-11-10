import { Router, Request, Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import { config } from '../config';
import { ingestPipeline } from '../services/ingest.service';

const router = Router();

// Ensure upload directory exists
if (!fs.existsSync(config.uploadDir)) {
  fs.mkdirSync(config.uploadDir, { recursive: true });
}

// Multer configuration for PDF uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, config.uploadDir),
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${Date.now()}-${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed!'));
    }
  },
});

// Upload route: executes the RAG ingestion pipeline
router.post('/upload', upload.single('pdfs'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Please select a PDF file.' });
    }

    // Call RAG Ingestion Pipeline
    const ingestResult = await ingestPipeline(req.file);

    const fileInfo = {
      fileName: req.file.filename,
      originalName: req.file.originalname,
      url: `/uploads/${req.file.filename}`,
      size: req.file.size,
      chunksInfo: { totalChunks: ingestResult.totalChunks },
      embeddingsInfo: { totalEmbeddings: ingestResult.totalEmbeddings },
    };

    return res.json({
      success: true,
      message: `PDF ingested: ${ingestResult.totalChunks} chunks${
        ingestResult.storedInQdrant ? ', indexed in Qdrant.' : '.'
      }`,
      file: fileInfo,
      files: [fileInfo],
      ...ingestResult,
    });
  } catch (err: any) {
    console.error('Ingestion error:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Failed to process and ingest document.',
    });
  }
});

// List uploaded files for UI
router.get('/files', (req: Request, res: Response) => {
  try {
    const files = fs.readdirSync(config.uploadDir);
    const pdfs = files
      .filter((name) => name.toLowerCase().endsWith('.pdf'))
      .map((name) => ({
        fileName: name,
        originalName: name.replace(/^\d+-/, ''),
        url: `/uploads/${name}`,
      }));

    return res.json({ success: true, files: pdfs });
  } catch {
    return res.json({ success: true, files: [] });
  }
});

export default router;
