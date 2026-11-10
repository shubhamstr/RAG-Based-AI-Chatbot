import fs from 'fs/promises';
// @ts-ignore
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { OpenAIEmbeddings } from '@langchain/openai';
import { QdrantVectorStore } from '@langchain/qdrant';
import { QdrantClient } from '@qdrant/js-client-rest';
import { config } from '../config';

export interface IngestResult {
  totalChunks: number;
  totalEmbeddings: number;
  storedInQdrant: boolean;
}

/**
 * Ingestion Pipeline: executes all initial RAG steps
 * 1. Extract text from uploaded PDF
 * 2. Split text into manageable chunks
 * 3. Generate vector embeddings
 * 4. Store vectors in Qdrant Vector DB
 */
export async function ingestPipeline(file: Express.Multer.File): Promise<IngestResult> {
  // Step 1: Extract text from PDF
  const buffer = await fs.readFile(file.path);
  const pdfData = await pdfParse(buffer);
  const text = (pdfData.text || '').trim();

  // Step 2: Split text into chunks
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });
  const docs = await splitter.createDocuments(
    [text],
    [{ source: file.originalname, fileName: file.filename }]
  );

  // Step 3 & 4: Generate embeddings & store in Qdrant Vector DB
  let storedInQdrant = false;

  if (config.openai.apiKey) {
    try {
      const embeddings = new OpenAIEmbeddings({
        model: config.openai.embeddingModel,
        apiKey: config.openai.apiKey,
      });

      const client = new QdrantClient({
        url: config.qdrant.url,
        apiKey: config.qdrant.apiKey,
        checkCompatibility: false,
      });

      const vectorStore = new QdrantVectorStore(embeddings, {
        client,
        collectionName: config.qdrant.collectionName,
      });

      await vectorStore.ensureCollection();
      await vectorStore.addDocuments(docs);
      storedInQdrant = true;
    } catch (err: any) {
      console.warn(`[Qdrant] Warning: Could not store vectors (${err.message})`);
    }
  } else {
    console.warn('[OpenAI] OPENAI_API_KEY not configured. Skipping embeddings.');
  }

  return {
    totalChunks: docs.length,
    totalEmbeddings: storedInQdrant ? docs.length : 0,
    storedInQdrant,
  };
}

