import fs from 'fs';
import path from 'path';
import multer, { FileFilterCallback } from 'multer';
import { Request } from 'express';
import { config } from '../config';

export interface UploadedFileInfo {
  fileName: string;
  originalName: string;
  size: number;
  uploadedAt: string;
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
   * Initialize Multer with storage configuration and PDF-only filters
   */
  private initMulter(): multer.Multer {
    const storage = multer.diskStorage({
      destination: (
        req: Request,
        file: Express.Multer.File,
        cb: (error: Error | null, destination: string) => void
      ) => {
        cb(null, config.uploadDir);
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
   * Get Multer middleware instance for handling array uploads
   */
  public getArrayUploader(fieldName: string = 'pdfs', maxCount: number = config.upload.maxFiles) {
    return this.uploadMiddleware.array(fieldName, maxCount);
  }

  /**
   * Transform uploaded Multer files into structured response items
   */
  public formatUploadedFiles(files: Express.Multer.File[]): UploadedFileInfo[] {
    return files.map((file) => ({
      originalName: file.originalname,
      fileName: file.filename,
      size: file.size,
      uploadedAt: new Date().toISOString()
    }));
  }

  /**
   * List all uploaded files currently in the uploads directory
   */
  public getUploadedFiles(): UploadedFileInfo[] {
    this.ensureUploadDirExists();
    const fileNames = fs.readdirSync(config.uploadDir);

    return fileNames.map((fileName) => {
      const filePath = path.join(config.uploadDir, fileName);
      const stats = fs.statSync(filePath);
      return {
        fileName,
        originalName: fileName.replace(/^\d+-\d+-/, ''),
        size: stats.size,
        uploadedAt: stats.mtime.toISOString()
      };
    });
  }

  /**
   * Parse upload / multer errors into clean HTTP status codes and error messages
   */
  public parseUploadError(err: unknown): { status: number; message: string } {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_UNEXPECTED_FILE' || err.code === 'LIMIT_FILE_COUNT') {
        return { status: 400, message: `Maximum ${config.upload.maxFiles} files allowed.` };
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

