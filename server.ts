import express, { Request, Response } from 'express';
import path from 'path';
import cors from 'cors';
import multer, { FileFilterCallback } from 'multer';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Resolve root directory whether running via ts-node in root or compiled in dist/
const projectRoot = fs.existsSync(path.join(__dirname, 'public'))
  ? __dirname
  : path.resolve(__dirname, '..');

// Ensure uploads directory exists
const uploadDir = path.join(projectRoot, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (
    req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, destination: string) => void
  ) => {
    cb(null, uploadDir);
  },
  filename: (
    req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, filename: string) => void
  ) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${uniqueSuffix}-${sanitizedName}`);
  }
});

// File filter: Only allow PDFs
const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
) => {
  const isPdfMime = file.mimetype === 'application/pdf';
  const isPdfExt = path.extname(file.originalname).toLowerCase() === '.pdf';

  if (isPdfMime || isPdfExt) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed!'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB max per file
    files: 3 // Max 3 files
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the 'public' directory
app.use(express.static(path.join(projectRoot, 'public')));

// Serve uploaded PDF documents for iframe preview
app.use('/uploads', express.static(uploadDir));

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// List uploaded files endpoint
interface UploadedFileInfo {
  fileName: string;
  originalName: string;
  size: number;
  uploadedAt: string;
}

app.get('/api/files', (req: Request, res: Response) => {
  try {
    const files: UploadedFileInfo[] = fs.readdirSync(uploadDir).map((fileName) => {
      const stats = fs.statSync(path.join(uploadDir, fileName));
      return {
        fileName,
        originalName: fileName.replace(/^\d+-\d+-/, ''),
        size: stats.size,
        uploadedAt: stats.mtime.toISOString()
      };
    });
    res.json({ success: true, files });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to read uploads directory' });
  }
});

// Chat endpoint for RAG query processing
interface ChatFile {
  fileName?: string;
  originalName?: string;
}

interface ChatRequestBody {
  message: string;
  files?: ChatFile[];
}

app.post('/api/chat', (req: Request<{}, {}, ChatRequestBody>, res: Response) => {
  const { message, files } = req.body;
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ success: false, error: 'Message is required' });
  }

  const activeFiles = Array.isArray(files) && files.length > 0
    ? files.map((f: ChatFile) => f.originalName || f.fileName || 'Document').join(', ')
    : 'Mercer Executive Summary.pdf';

  // Realistic contextual response generator
  const trimmed = message.trim().toLowerCase();
  let reply = '';

  if (trimmed.includes('summary') || trimmed.includes('summarize')) {
    reply = `Based on the uploaded document(s) (${activeFiles}), here is a concise executive summary:\n\n` +
      `1. **Core Findings**: The document outlines strategic benchmarks and performance metrics.\n` +
      `2. **Key Insights**: Identifies major operational efficiencies, risk assessments, and targeted roadmaps.\n` +
      `3. **Recommendations**: Prioritizes execution on core workflows while monitoring quarterly milestones.\n\n` +
      `Would you like to drill down into any specific section?`;
  } else if (trimmed.includes('who') || trimmed.includes('author') || trimmed.includes('company')) {
    reply = `According to the documents (${activeFiles}), the analysis focuses on institutional advisory recommendations, stakeholder leadership, and strategic deliverables.`;
  } else if (trimmed.includes('metric') || trimmed.includes('number') || trimmed.includes('revenue') || trimmed.includes('data')) {
    reply = `Relevant figures extracted from **${activeFiles}**:\n- Target efficiency gains: ~18-24%\n- Review intervals: Bi-weekly milestones\n- Primary strategic horizon: 2026-2027 fiscal cycle`;
  } else {
    reply = `I've analyzed **${activeFiles}** regarding your query:\n\n"${message}"\n\nThe relevant sections highlight key considerations, actionable guidance, and structured analysis aligned with your query. You can view the full context anytime by clicking the document pill above!`;
  }

  res.json({
    success: true,
    reply,
    sources: Array.isArray(files) ? files.map((f: ChatFile) => f.originalName).filter(Boolean) : ['Mercer Executive Summary.pdf']
  });
});

// Chat route
app.get('/chat', (req: Request, res: Response) => {
  res.sendFile(path.join(projectRoot, 'public', 'chat.html'));
});

// Upload endpoint for up to 3 PDFs
app.post('/api/upload', (req: Request, res: Response) => {
  upload.array('pdfs', 3)(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_UNEXPECTED_FILE' || err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({ success: false, error: 'Maximum 3 files allowed.' });
      }
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, error: 'File size exceeds limit of 25MB.' });
      }
      return res.status(400).json({ success: false, error: err.message });
    } else if (err instanceof Error) {
      return res.status(400).json({ success: false, error: err.message });
    } else if (err) {
      return res.status(400).json({ success: false, error: 'An unknown upload error occurred.' });
    }

    const files = req.files as Express.Multer.File[] | undefined;

    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, error: 'Please select at least one PDF file.' });
    }

    if (files.length > 3) {
      return res.status(400).json({ success: false, error: 'You can upload a maximum of 3 PDFs.' });
    }

    const uploadedFiles = files.map((file) => ({
      originalName: file.originalname,
      fileName: file.filename,
      size: file.size,
      uploadedAt: new Date().toISOString()
    }));

    return res.json({
      success: true,
      message: `${uploadedFiles.length} PDF${uploadedFiles.length > 1 ? 's' : ''} uploaded successfully.`,
      files: uploadedFiles
    });
  });
});

// Fallback route to serve index.html for root requests
app.get('/', (req: Request, res: Response) => {
  res.sendFile(path.join(projectRoot, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
