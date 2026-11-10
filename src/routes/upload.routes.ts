import { Router, Request, Response } from 'express';
import { uploadService } from '../services/upload.service';
import { config } from '../config';

const router = Router();

// List uploaded files endpoint
router.get('/files', (req: Request, res: Response) => {
  try {
    const files = uploadService.getUploadedFiles();
    res.json({ success: true, files });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to read uploads directory' });
  }
});

// Upload endpoint for up to configured maximum PDFs
router.post('/upload', (req: Request, res: Response) => {
  uploadService.getArrayUploader()(req, res, (err: unknown) => {
    if (err) {
      const { status, message } = uploadService.parseUploadError(err);
      return res.status(status).json({ success: false, error: message });
    }

    const files = req.files as Express.Multer.File[] | undefined;

    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Please select at least one PDF file.'
      });
    }

    if (files.length > config.upload.maxFiles) {
      return res.status(400).json({
        success: false,
        error: `You can upload a maximum of ${config.upload.maxFiles} PDFs.`
      });
    }

    const uploadedFiles = uploadService.formatUploadedFiles(files);

    return res.json({
      success: true,
      message: `${uploadedFiles.length} PDF${uploadedFiles.length > 1 ? 's' : ''} uploaded successfully.`,
      files: uploadedFiles
    });
  });
});

export default router;

