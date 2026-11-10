import { Router, Request, Response } from 'express';
import path from 'path';
import { uploadService } from '../services/upload.service';
import { chunkService } from '../services/chunk.service';
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

// Upload endpoint for single PDF
router.post('/upload', (req: Request, res: Response) => {
  uploadService.getArrayUploader()(req, res, async (err: unknown) => {
    if (err) {
      const { status, message } = uploadService.parseUploadError(err);
      return res.status(status).json({ success: false, error: message });
    }

    const files = req.files as Express.Multer.File[] | undefined;

    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Please select a PDF file.'
      });
    }

    if (files.length > config.upload.maxFiles) {
      return res.status(400).json({
        success: false,
        error: 'Only a single PDF file can be uploaded.'
      });
    }

    const file = files[0];
    const folderName = (req as any).uploadFolderName || '';
    const folderPath = (req as any).uploadFolderPath || config.uploadDir;

    try {
      const parsedTextInfo = await uploadService.parseAndSavePdfText(file, folderPath, folderName);

      // Start chunking immediately after extraction is complete
      const textFilePath = path.join(folderPath, parsedTextInfo.fileName);
      const documentId = folderName || file.filename;
      const chunksInfo = await chunkService.createAndSaveChunks(
        textFilePath,
        documentId,
        folderPath,
        folderName
      );

      const uploadedFile = uploadService.formatUploadedFile(
        file,
        folderName,
        parsedTextInfo,
        chunksInfo
      );

      return res.json({
        success: true,
        message: `PDF uploaded, text extracted, and split into ${chunksInfo.totalChunks} chunk${chunksInfo.totalChunks === 1 ? '' : 's'}.`,
        file: uploadedFile,
        files: [uploadedFile],
        folder: folderName,
        parsedTextFile: parsedTextInfo,
        chunksInfo: {
          totalChunks: chunksInfo.totalChunks,
          fileName: chunksInfo.fileName,
          relativePath: chunksInfo.relativePath,
          url: chunksInfo.url
        },
        chunks: chunksInfo.chunks
      });
    } catch (processError: any) {
      console.error('Error during PDF parsing or chunking:', processError);
      return res.status(500).json({
        success: false,
        error: processError?.message || 'Failed to process, extract, or chunk text from the uploaded PDF.'
      });
    }
  });
});

export default router;
