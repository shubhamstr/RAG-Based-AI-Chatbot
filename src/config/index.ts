import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

/**
 * Resolve project root directory dynamically across development (ts-node / tsx)
 * and production build environments (dist/).
 */
function resolveProjectRoot(): string {
  const cwd = process.cwd();
  if (fs.existsSync(path.join(cwd, 'public'))) {
    return cwd;
  }

  let currentDir = __dirname;
  for (let i = 0; i < 4; i++) {
    if (fs.existsSync(path.join(currentDir, 'public'))) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }

  return cwd;
}

const projectRoot = resolveProjectRoot();

export interface AppConfig {
  port: number;
  nodeEnv: string;
  projectRoot: string;
  uploadDir: string;
  publicDir: string;
  upload: {
    maxFileSize: number;
    maxFiles: number;
    allowedMimeTypes: string[];
    allowedExtensions: string[];
  };
  openai: {
    apiKey: string;
    embeddingModel: string;
  };
}

export const config: AppConfig = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  projectRoot,
  uploadDir: process.env.UPLOAD_DIR
    ? path.resolve(projectRoot, process.env.UPLOAD_DIR)
    : path.join(projectRoot, 'uploads'),
  publicDir: path.join(projectRoot, 'public'),
  upload: {
    maxFileSize: 25 * 1024 * 1024, // 25 MB
    maxFiles: 1,
    allowedMimeTypes: ['application/pdf'],
    allowedExtensions: ['.pdf']
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    embeddingModel: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small'
  }
};

