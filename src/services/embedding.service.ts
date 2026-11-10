import { OpenAIEmbeddings } from '@langchain/openai';
import fs from 'fs/promises';
import path from 'path';
import { config } from '../config';
import { DocumentChunk, ChunkMetadata } from './chunk.service';

export interface ChunkEmbedding {
  index: number;
  embedding: number[];
  content: string;
  metadata: ChunkMetadata | Record<string, any>;
}

export interface EmbeddingsInfo {
  fileName: string;
  relativePath: string;
  url: string;
  model: string;
  dimensions: number;
  totalEmbeddings: number;
  embeddings: ChunkEmbedding[];
}

export class EmbeddingService {
  private static instance: EmbeddingService;
  private embeddingsInstance: OpenAIEmbeddings | null = null;
  private currentApiKey: string | null = null;

  public static getInstance(): EmbeddingService {
    if (!EmbeddingService.instance) {
      EmbeddingService.instance = new EmbeddingService();
    }
    return EmbeddingService.instance;
  }

  /**
   * Check if OpenAI API key is configured in environment
   */
  public isConfigured(): boolean {
    const key = process.env.OPENAI_API_KEY || config.openai.apiKey;
    return typeof key === 'string' && key.trim().length > 0;
  }

  /**
   * Returns initialized LangChain OpenAIEmbeddings instance or throws an informative error if key is missing
   */
  public getEmbeddings(): OpenAIEmbeddings {
    const apiKey = (process.env.OPENAI_API_KEY || config.openai.apiKey || '').trim();

    if (!apiKey) {
      throw new Error(
        'OpenAI API key is missing. Please set OPENAI_API_KEY in your .env file or environment variables.'
      );
    }

    if (!this.embeddingsInstance || this.currentApiKey !== apiKey) {
      this.embeddingsInstance = new OpenAIEmbeddings({
        model: config.openai.embeddingModel || 'text-embedding-3-small',
        apiKey,
      });
      this.currentApiKey = apiKey;
    }

    return this.embeddingsInstance;
  }

  /**
   * Embed a single query string using LangChain embedQuery (for search / RAG retrieval)
   */
  public async embedQuery(query: string): Promise<number[]> {
    const embeddings = this.getEmbeddings();
    return embeddings.embedQuery(query);
  }

  /**
   * Generate vector embeddings for an array of document chunks using LangChain OpenAIEmbeddings (text-embedding-3-small)
   * 
   * @param chunks Array of document chunks generated from text splitting
   * @returns Generated embeddings and metadata
   */
  public async generateEmbeddings(
    chunks: (DocumentChunk | { content: string; metadata?: any })[]
  ): Promise<{ model: string; dimensions: number; embeddings: ChunkEmbedding[] }> {
    const model = config.openai.embeddingModel || 'text-embedding-3-small';

    if (!chunks || chunks.length === 0) {
      return {
        model,
        dimensions: 1536,
        embeddings: [],
      };
    }

    const embeddingsInstance = this.getEmbeddings();

    // Extract text content from chunks (OpenAI rejects completely empty strings)
    const texts = chunks.map((chunk) => {
      const text = (chunk.content || '').trim();
      return text.length > 0 ? text : ' ';
    });

    // LangChain embedDocuments automatically handles batching and vector generation
    const vectors = await embeddingsInstance.embedDocuments(texts);

    const detectedDimensions = vectors[0]?.length || 1536;

    const allResults: ChunkEmbedding[] = vectors.map((vec, index) => {
      const originalChunk = chunks[index];
      return {
        index,
        embedding: vec,
        content: originalChunk.content,
        metadata: originalChunk.metadata || { chunkIndex: index },
      };
    });

    return {
      model,
      dimensions: detectedDimensions,
      embeddings: allResults,
    };
  }

  /**
   * Generates embeddings for chunks and saves embeddings.json in the upload folder
   * 
   * @param chunks Array of document chunks
   * @param outputFolderPath Directory path to store embeddings.json
   * @param folderName Relative subfolder name
   */
  public async createAndSaveEmbeddings(
    chunks: DocumentChunk[],
    outputFolderPath: string,
    folderName: string
  ): Promise<EmbeddingsInfo> {
    const { model, dimensions, embeddings } = await this.generateEmbeddings(chunks);

    const embeddingsFileName = 'embeddings.json';
    const embeddingsFilePath = path.join(outputFolderPath, embeddingsFileName);
    const embeddingsRelativePath = folderName
      ? `${folderName}/${embeddingsFileName}`
      : embeddingsFileName;
    const embeddingsUrl = `/uploads/${embeddingsRelativePath}`;

    const filePayload = {
      model,
      dimensions,
      totalEmbeddings: embeddings.length,
      createdAt: new Date().toISOString(),
      embeddings,
    };

    await fs.writeFile(
      embeddingsFilePath,
      JSON.stringify(filePayload, null, 2),
      'utf-8'
    );

    return {
      fileName: embeddingsFileName,
      relativePath: embeddingsRelativePath,
      url: embeddingsUrl,
      model,
      dimensions,
      totalEmbeddings: embeddings.length,
      embeddings,
    };
  }

  /**
   * Load existing embeddings.json from a folder if present
   */
  public async loadSavedEmbeddings(outputFolderPath: string): Promise<EmbeddingsInfo | null> {
    try {
      const embeddingsFilePath = path.join(outputFolderPath, 'embeddings.json');
      const raw = await fs.readFile(embeddingsFilePath, 'utf-8');
      const parsed = JSON.parse(raw);
      return parsed;
    } catch {
      return null;
    }
  }
}

export const embeddingService = EmbeddingService.getInstance();
