import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  uploadDir: path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads'),
  publicDir: path.resolve(process.cwd(), 'public'),
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    chatModel: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
    embeddingModel: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
  },
  qdrant: {
    url: process.env.QDRANT_URL || 'http://localhost:6002',
    collectionName: process.env.QDRANT_COLLECTION_NAME || 'rag_documents',
    apiKey: process.env.QDRANT_API_KEY || undefined,
  },
};
