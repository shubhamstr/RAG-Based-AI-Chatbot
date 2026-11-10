import { Router, Request, Response } from 'express';
import path from 'path';
import { uploadService } from '../services/upload.service';
import { chunkService } from '../services/chunk.service';
import { embeddingService } from '../services/embedding.service';
import { qdrantService } from '../services/qdrant.service';
import { config } from '../config';

const router = Router();

// Qdrant health and status endpoint
router.get('/qdrant/status', async (req: Request, res: Response) => {
  try {
    const health = await qdrantService.checkHealth();
    let collectionStats = null;

    if (health.connected) {
      try {
        collectionStats = await qdrantService.getCollectionStats();
      } catch {
        // collection may not exist yet
      }
    }

    res.json({
      success: true,
      health,
      collection: config.qdrant.collectionName,
      stats: collectionStats
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err?.message || 'Failed to check Qdrant status'
    });
  }
});

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

      // Generate vector embeddings using OpenAI text-embedding-3-small
      let embeddingsInfo = undefined;
      let embeddingError: string | null = null;
      let qdrantResult: any = null;
      let qdrantError: string | null = null;

      if (embeddingService.isConfigured()) {
        try {
          embeddingsInfo = await embeddingService.createAndSaveEmbeddings(
            chunksInfo.chunks,
            folderPath,
            folderName
          );

          // Store generated embeddings into Qdrant vector database
          if (embeddingsInfo && embeddingsInfo.embeddings?.length > 0) {
            const isQdrantUp = await qdrantService.isHealthy();
            if (isQdrantUp) {
              try {
                qdrantResult = await qdrantService.storeEmbeddings({
                  documentId,
                  fileName: file.originalname || file.filename,
                  folderName,
                  embeddings: embeddingsInfo.embeddings,
                  dimensions: embeddingsInfo.dimensions
                });
              } catch (qErr: unknown) {
                const message = qErr instanceof Error ? qErr.message : String(qErr);
                console.warn(`[Qdrant] Warning: Failed to store embeddings: ${message}`);
                qdrantError = message || 'Failed to store embeddings in Qdrant vector DB';
              }
            } else {
              console.warn(
                `[Qdrant] Database is offline at ${config.qdrant.url}. Start with "npm run qdrant:start" to persist vectors.`
              );
              qdrantError = `Qdrant database is offline at ${config.qdrant.url}. Run "npm run qdrant:start" to start the vector DB.`;
            }
          }
        } catch (embErr: any) {
          console.error('Failed to generate OpenAI embeddings during upload:', embErr);
          embeddingError = embErr?.message || 'Failed to generate embeddings';
        }
      } else {
        console.warn('OPENAI_API_KEY is not set in environment. Skipping embedding generation.');
      }

      const uploadedFile = uploadService.formatUploadedFile(
        file,
        folderName,
        parsedTextInfo,
        chunksInfo,
        embeddingsInfo
      );

      let successMessage = `PDF uploaded, text extracted, and split into ${chunksInfo.totalChunks} chunk${chunksInfo.totalChunks === 1 ? '' : 's'}.`;
      if (embeddingsInfo) {
        if (qdrantResult?.success) {
          successMessage = `PDF uploaded, text split into ${chunksInfo.totalChunks} chunks, ${embeddingsInfo.totalEmbeddings} embeddings generated and stored in Qdrant vector DB (collection: "${qdrantResult.collectionName}").`;
        } else {
          successMessage = `PDF uploaded, text extracted, split into ${chunksInfo.totalChunks} chunks, and ${embeddingsInfo.totalEmbeddings} embeddings generated with OpenAI (${embeddingsInfo.model}).`;
        }
      }

      return res.json({
        success: true,
        message: successMessage,
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
        chunks: chunksInfo.chunks,
        embeddingsInfo: embeddingsInfo ? {
          totalEmbeddings: embeddingsInfo.totalEmbeddings,
          model: embeddingsInfo.model,
          dimensions: embeddingsInfo.dimensions,
          fileName: embeddingsInfo.fileName,
          relativePath: embeddingsInfo.relativePath,
          url: embeddingsInfo.url
        } : undefined,
        embeddings: embeddingsInfo?.embeddings,
        embeddingStatus: embeddingsInfo
          ? 'generated'
          : embeddingError
            ? `error: ${embeddingError}`
            : 'skipped - OPENAI_API_KEY not configured',
        qdrant: qdrantResult
          ? {
              status: 'stored',
              storedCount: qdrantResult.storedCount,
              collectionName: qdrantResult.collectionName,
              pointIds: qdrantResult.pointIds
            }
          : qdrantError
            ? {
                status: 'error',
                error: qdrantError
              }
            : {
                status: 'skipped'
              }
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
