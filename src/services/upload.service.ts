import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer, { FileFilterCallback } from 'multer';
import { Request } from 'express';
// Use direct lib import to avoid index.js debug auto-run in Node 22
// @ts-ignore
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import { config } from '../config';
import { ChunksInfo } from './chunk.service';
import { EmbeddingsInfo } from './embedding.service';

export interface ParsedTextInfo {
  fileName: string;
  relativePath: string;
  url: string;
  charCount: number;
  pageCount: number;
}

export interface UploadedFileInfo {
  fileName: string;
  originalName: string;
  folderName: string;
  relativePath: string;
  url: string;
  size: number;
  uploadedAt: string;
  parsedTextFile?: ParsedTextInfo;
  chunksInfo?: {
    fileName: string;
    relativePath: string;
    url: string;
    totalChunks: number;
  };
  embeddingsInfo?: {
    fileName: string;
    relativePath: string;
    url: string;
    totalEmbeddings: number;
    model: string;
    dimensions: number;
  };
}

export class UploadService {
  private static instance: UploadService;
  private uploadMiddleware: multer.Multer;

  private constructor() {
    this.ensureUploadDirExists();
    this.uploadMiddleware = this.initMulter();
  }

  public static getInstance(): UploadService {
    if (!UploadService.instance) {
      UploadService.instance = new UploadService();
    }
    return UploadService.instance;
  }

  /**
   * Ensure uploads directory exists on the filesystem
   */
  public ensureUploadDirExists(): void {
    if (!fs.existsSync(config.uploadDir)) {
      fs.mkdirSync(config.uploadDir, { recursive: true });
    }
  }

  /**
   * Initialize Multer with dynamic subfolder creation per upload and random PDF naming
   */
  private initMulter(): multer.Multer {
    const storage = multer.diskStorage({
      destination: (
        req: Request,
        file: Express.Multer.File,
        cb: (error: Error | null, destination: string) => void
      ) => {
        try {
          this.ensureUploadDirExists();

          // Reuse the folder created for this request or create a new unique folder
          if (!(req as any).uploadFolderPath) {
            const folderName = `upload_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
            const folderPath = path.join(config.uploadDir, folderName);
            fs.mkdirSync(folderPath, { recursive: true });
            (req as any).uploadFolderName = folderName;
            (req as any).uploadFolderPath = folderPath;
          }

          cb(null, (req as any).uploadFolderPath);
        } catch (err: any) {
          cb(err, '');
        }
      },
      filename: (
        req: Request,
        file: Express.Multer.File,
        cb: (error: Error | null, filename: string) => void
      ) => {
        // Generate random name with .pdf extension
        const randomFileName = `${crypto.randomBytes(16).toString('hex')}.pdf`;
        cb(null, randomFileName);
      }
    });

    const fileFilter = (
      req: Request,
      file: Express.Multer.File,
      cb: FileFilterCallback
    ) => {
      const isPdfMime = config.upload.allowedMimeTypes.includes(file.mimetype);
      const isPdfExt = config.upload.allowedExtensions.includes(
        path.extname(file.originalname).toLowerCase()
      );

      if (isPdfMime || isPdfExt) {
        cb(null, true);
      } else {
        cb(new Error('Only PDF files are allowed!'));
      }
    };

    return multer({
      storage,
      fileFilter,
      limits: {
        fileSize: config.upload.maxFileSize,
        files: config.upload.maxFiles
      }
    });
  }

  /**
   * Parse text from the uploaded PDF and write it to one txt file in that same folder
   */
  public async parseAndSavePdfText(
    file: Express.Multer.File,
    folderPath: string,
    folderName: string
  ): Promise<ParsedTextInfo> {
    const dataBuffer = await fs.promises.readFile(file.path);
    let extractedText = '';
    let pageCount = 0;

    try {
      const parsed = await pdfParse(dataBuffer);
      extractedText = (parsed.text || '').trim();
      pageCount = parsed.numpages || 1;
    } catch (err: any) {
      console.error(`Failed to parse PDF text for ${file.originalname}:`, err);
      extractedText = `[Parsing Note: Could not extract text from this PDF file. Reason: ${err?.message || 'Unknown error'}]`;
    }

    const textFileName = 'extracted_text.txt';
    const textFilePath = path.join(folderPath, textFileName);
    const textRelativePath = `${folderName}/${textFileName}`;
    const textUrl = `/uploads/${folderName}/${textFileName}`;

    const content = [
      '================================================================================',
      `Original Document: ${file.originalname}`,
      `Saved PDF File:    ${file.filename}`,
      `Folder:            ${folderName}`,
      `Page Count:        ${pageCount}`,
      `Extracted At:      ${new Date().toISOString()}`,
      '================================================================================\n',
      extractedText
    ].join('\n');

    await fs.promises.writeFile(textFilePath, content, 'utf-8');

    return {
      fileName: textFileName,
      relativePath: textRelativePath,
      url: textUrl,
      charCount: extractedText.length,
      pageCount
    };
  }

  /**
   * Get Multer middleware instance for handling uploads
   */
  public getArrayUploader(fieldName: string = 'pdfs', maxCount: number = config.upload.maxFiles) {
    return this.uploadMiddleware.array(fieldName, maxCount);
  }

  /**
   * Format uploaded file into structured response item
   */
  public formatUploadedFile(
    file: Express.Multer.File,
    folderName: string,
    parsedTextInfo?: ParsedTextInfo,
    chunksInfo?: ChunksInfo | {
      fileName: string;
      relativePath: string;
      url: string;
      totalChunks: number;
    },
    embeddingsInfo?: EmbeddingsInfo | {
      fileName: string;
      relativePath: string;
      url: string;
      totalEmbeddings: number;
      model: string;
      dimensions: number;
    }
  ): UploadedFileInfo {
    const relativePath = folderName ? `${folderName}/${file.filename}` : file.filename;
    const url = `/uploads/${relativePath}`;

    return {
      fileName: file.filename,
      originalName: file.originalname,
      folderName,
      relativePath,
      url,
      size: file.size,
      uploadedAt: new Date().toISOString(),
      parsedTextFile: parsedTextInfo,
      chunksInfo: chunksInfo ? {
        fileName: chunksInfo.fileName,
        relativePath: chunksInfo.relativePath,
        url: chunksInfo.url,
        totalChunks: chunksInfo.totalChunks
      } : undefined,
      embeddingsInfo: embeddingsInfo ? {
        fileName: embeddingsInfo.fileName,
        relativePath: embeddingsInfo.relativePath,
        url: embeddingsInfo.url,
        totalEmbeddings: embeddingsInfo.totalEmbeddings,
        model: embeddingsInfo.model,
        dimensions: embeddingsInfo.dimensions
      } : undefined
    };
  }

  /**
   * List all uploaded files currently in the uploads directory (including subdirectories)
   */
  public getUploadedFiles(): UploadedFileInfo[] {
    this.ensureUploadDirExists();
    const entries = fs.readdirSync(config.uploadDir, { withFileTypes: true });
    const results: UploadedFileInfo[] = [];

    for (const entry of entries) {
      const fullPath = path.join(config.uploadDir, entry.name);

      if (entry.isDirectory()) {
        const folderName = entry.name;
        const subFiles = fs.readdirSync(fullPath, { withFileTypes: true });
        const txtPath = path.join(fullPath, 'extracted_text.txt');
        const hasTxt = fs.existsSync(txtPath);
        const chunksPath = path.join(fullPath, 'chunks.json');
        const hasChunks = fs.existsSync(chunksPath);
        let totalChunks = 0;

        if (hasChunks) {
          try {
            const raw = fs.readFileSync(chunksPath, 'utf-8');
            const parsedChunks = JSON.parse(raw);
            if (Array.isArray(parsedChunks)) {
              totalChunks = parsedChunks.length;
            }
          } catch {
            totalChunks = 0;
          }
        }

        const embeddingsPath = path.join(fullPath, 'embeddings.json');
        const hasEmbeddings = fs.existsSync(embeddingsPath);
        let embeddingsMeta: { totalEmbeddings: number; model: string; dimensions: number } | undefined = undefined;

        if (hasEmbeddings) {
          try {
            const raw = fs.readFileSync(embeddingsPath, 'utf-8');
            const parsedEmbeddings = JSON.parse(raw);
            embeddingsMeta = {
              totalEmbeddings: parsedEmbeddings.totalEmbeddings || (Array.isArray(parsedEmbeddings.embeddings) ? parsedEmbeddings.embeddings.length : 0),
              model: parsedEmbeddings.model || 'text-embedding-3-small',
              dimensions: parsedEmbeddings.dimensions || 1536
            };
          } catch {
            embeddingsMeta = undefined;
          }
        }

        for (const subFile of subFiles) {
          if (subFile.isFile() && subFile.name.toLowerCase().endsWith('.pdf')) {
            const filePath = path.join(fullPath, subFile.name);
            const stats = fs.statSync(filePath);

            results.push({
              fileName: subFile.name,
              originalName: subFile.name,
              folderName,
              relativePath: `${folderName}/${subFile.name}`,
              url: `/uploads/${folderName}/${subFile.name}`,
              size: stats.size,
              uploadedAt: stats.mtime.toISOString(),
              parsedTextFile: hasTxt ? {
                fileName: 'extracted_text.txt',
                relativePath: `${folderName}/extracted_text.txt`,
                url: `/uploads/${folderName}/extracted_text.txt`,
                charCount: 0,
                pageCount: 0
              } : undefined,
              chunksInfo: hasChunks ? {
                fileName: 'chunks.json',
                relativePath: `${folderName}/chunks.json`,
                url: `/uploads/${folderName}/chunks.json`,
                totalChunks
              } : undefined,
              embeddingsInfo: embeddingsMeta ? {
                fileName: 'embeddings.json',
                relativePath: `${folderName}/embeddings.json`,
                url: `/uploads/${folderName}/embeddings.json`,
                totalEmbeddings: embeddingsMeta.totalEmbeddings,
                model: embeddingsMeta.model,
                dimensions: embeddingsMeta.dimensions
              } : undefined
            });
          }
        }
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.pdf')) {
        const stats = fs.statSync(fullPath);
        results.push({
          fileName: entry.name,
          originalName: entry.name.replace(/^\d+-\d+-/, ''),
          folderName: '',
          relativePath: entry.name,
          url: `/uploads/${entry.name}`,
          size: stats.size,
          uploadedAt: stats.mtime.toISOString()
        });
      }
    }

    return results;
  }

  /**
   * Parse upload / multer errors into clean HTTP status codes and error messages
   */
  public parseUploadError(err: unknown): { status: number; message: string } {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_UNEXPECTED_FILE' || err.code === 'LIMIT_FILE_COUNT') {
        return { status: 400, message: `Only ${config.upload.maxFiles} PDF file can be uploaded at a time.` };
      }
      if (err.code === 'LIMIT_FILE_SIZE') {
        const mb = Math.round(config.upload.maxFileSize / (1024 * 1024));
        return { status: 400, message: `File size exceeds limit of ${mb}MB.` };
      }
      return { status: 400, message: err.message };
    } else if (err instanceof Error) {
      return { status: 400, message: err.message };
    }
    return { status: 400, message: 'An unknown upload error occurred.' };
  }
}

export const uploadService = UploadService.getInstance();
