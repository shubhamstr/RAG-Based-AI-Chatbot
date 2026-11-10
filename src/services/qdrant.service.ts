import { QdrantVectorStore } from '@langchain/qdrant';
import { Document } from '@langchain/core/documents';
import { QdrantClient } from '@qdrant/js-client-rest';
import crypto from 'crypto';
import { config } from '../config';
import { embeddingService, ChunkEmbedding } from './embedding.service';

export interface QdrantStoreParams {
  documentId: string;
  fileName: string;
  folderName?: string;
  embeddings: ChunkEmbedding[];
  dimensions?: number;
  collectionName?: string;
}

export interface QdrantStoreResult {
  success: boolean;
  collectionName: string;
  storedCount: number;
  pointIds: string[];
}

export interface QdrantHealthStatus {
  connected: boolean;
  url: string;
  version?: string;
  collections?: string[];
  error?: string;
}

export interface QdrantSearchResult {
  id?: string | number;
  score?: number;
  pageContent: string;
  metadata: Record<string, unknown>;
}

export class QdrantService {
  private static instance: QdrantService;
  private client: QdrantClient | null = null;
  private vectorStores: Map<string, QdrantVectorStore> = new Map();
  private currentUrl: string | null = null;
  private currentApiKey?: string;

  public static getInstance(): QdrantService {
    if (!QdrantService.instance) {
      QdrantService.instance = new QdrantService();
    }
    return QdrantService.instance;
  }

  /**
   * Check if Qdrant is configured in the environment
   */
  public isConfigured(): boolean {
    const url = process.env.QDRANT_URL || config.qdrant.url;
    return typeof url === 'string' && url.trim().length > 0;
  }

  /**
   * Get or initialize the underlying QdrantClient instance
   * Configured with checkCompatibility: false to prevent unhandled background version check warnings
   */
  public getClient(): QdrantClient {
    const url = (process.env.QDRANT_URL || config.qdrant.url || 'http://localhost:6002').trim();
    const rawApiKey = (process.env.QDRANT_API_KEY || config.qdrant.apiKey || '').trim();
    const apiKey = rawApiKey.length > 0 ? rawApiKey : undefined;

    if (!this.client || this.currentUrl !== url || this.currentApiKey !== apiKey) {
      this.client = new QdrantClient({
        url,
        apiKey,
        checkCompatibility: false,
      });
      this.currentUrl = url;
      this.currentApiKey = apiKey;
      this.vectorStores.clear(); // invalidate cached stores if client credentials changed
    }

    return this.client;
  }

  /**
   * Get LangChain QdrantVectorStore instance configured with OpenAI embeddings
   */
  public getVectorStore(
    collectionName: string = config.qdrant.collectionName,
    dimensions: number = 1536
  ): QdrantVectorStore {
    const client = this.getClient();
    const cacheKey = `${collectionName}_${dimensions}`;

    if (this.vectorStores.has(cacheKey)) {
      return this.vectorStores.get(cacheKey)!;
    }

    const embeddings = embeddingService.getEmbeddings();

    const store = new QdrantVectorStore(embeddings, {
      client,
      collectionName,
      collectionConfig: {
        vectors: {
          size: dimensions,
          distance: 'Cosine',
        },
      },
    });

    this.vectorStores.set(cacheKey, store);
    return store;
  }

  /**
   * Check connection and health of the Qdrant vector database
   */
  public async checkHealth(): Promise<QdrantHealthStatus> {
    const url = process.env.QDRANT_URL || config.qdrant.url || 'http://localhost:6002';
    try {
      const client = this.getClient();
      const collectionsRes = await client.getCollections();
      const collectionNames = collectionsRes.collections?.map((c) => c.name) || [];

      let version = 'unknown';
      try {
        const vInfo = await client.versionInfo();
        version = vInfo.version || 'unknown';
      } catch {
        // versionInfo is optional
      }

      return {
        connected: true,
        url,
        version,
        collections: collectionNames,
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return {
        connected: false,
        url,
        error: errorMessage || 'Unable to connect to Qdrant vector database',
      };
    }
  }

  /**
   * Check if Qdrant database is currently online and reachable
   */
  public async isHealthy(): Promise<boolean> {
    try {
      const health = await this.checkHealth();
      return health.connected;
    } catch {
      return false;
    }
  }

  /**
   * Ensure that the collection exists with the specified vector dimensions and distance metric.
   */
  public async ensureCollection(
    collectionName: string = config.qdrant.collectionName,
    dimensions: number = 1536
  ): Promise<boolean> {
    try {
      const vectorStore = this.getVectorStore(collectionName, dimensions);
      await vectorStore.ensureCollection();
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[Qdrant] Warning ensuring collection "${collectionName}": ${message}`);
      return false;
    }
  }

  /**
   * Store document chunk embeddings into Qdrant using LangChain's QdrantVectorStore and Document
   */
  public async storeEmbeddings(params: QdrantStoreParams): Promise<QdrantStoreResult> {
    const {
      documentId,
      fileName,
      folderName,
      embeddings,
      dimensions = 1536,
      collectionName = config.qdrant.collectionName,
    } = params;

    if (!embeddings || embeddings.length === 0) {
      return {
        success: true,
        collectionName,
        storedCount: 0,
        pointIds: [],
      };
    }

    // Determine vector dimension from the first embedding if available
    const detectedDim = embeddings[0]?.embedding?.length || dimensions;
    const vectorStore = this.getVectorStore(collectionName, detectedDim);

    // Create LangChain Document instances for each chunk
    const pointIds: string[] = [];
    const documents: Document[] = [];
    const vectors: number[][] = [];

    for (const item of embeddings) {
      const pointId = crypto.randomUUID();
      pointIds.push(pointId);

      const chunkMetadata = item.metadata && typeof item.metadata === 'object' ? item.metadata : {};
      const metadata: Record<string, unknown> = {
        ...chunkMetadata,
        documentId,
        fileName,
        folderName: folderName || documentId,
        chunkIndex: item.index,
        storedAt: new Date().toISOString(),
      };

      const doc = new Document({
        id: pointId,
        pageContent: item.content,
        metadata,
      });

      documents.push(doc);
      vectors.push(item.embedding);
    }

    // Upsert vectors and LangChain documents into QdrantVectorStore in batches
    const BATCH_SIZE = 100;
    for (let i = 0; i < documents.length; i += BATCH_SIZE) {
      const docBatch = documents.slice(i, i + BATCH_SIZE);
      const vecBatch = vectors.slice(i, i + BATCH_SIZE);
      const idBatch = pointIds.slice(i, i + BATCH_SIZE);
      await vectorStore.addVectors(vecBatch, docBatch, { ids: idBatch });
    }

    console.log(
      `[LangChain Qdrant] Stored ${documents.length} documents into collection "${collectionName}" for document "${fileName}" (${documentId}).`
    );

    return {
      success: true,
      collectionName,
      storedCount: documents.length,
      pointIds,
    };
  }

  /**
   * Add LangChain Document objects directly, letting LangChain generate embeddings
   */
  public async addDocuments(
    docs: Document[],
    collectionName: string = config.qdrant.collectionName
  ): Promise<void> {
    const vectorStore = this.getVectorStore(collectionName);
    await vectorStore.addDocuments(docs);
  }

  /**
   * Search for similar documents using LangChain text query similarity search
   */
  public async similaritySearch(
    query: string,
    options: {
      k?: number;
      collectionName?: string;
      filter?: Record<string, unknown>;
    } = {}
  ): Promise<QdrantSearchResult[]> {
    const {
      k = 5,
      collectionName = config.qdrant.collectionName,
      filter,
    } = options;

    try {
      const vectorStore = this.getVectorStore(collectionName);
      const results = await vectorStore.similaritySearch(query, k, filter as any);

      return results.map((doc) => ({
        id: doc.id,
        pageContent: doc.pageContent,
        metadata: doc.metadata,
      }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[Qdrant] similaritySearch error: ${message}`);
      return [];
    }
  }

  /**
   * Search for similar documents using vector similarity search with scores
   */
  public async similaritySearchVectorWithScore(
    queryVector: number[],
    options: {
      k?: number;
      collectionName?: string;
      filter?: Record<string, unknown>;
    } = {}
  ): Promise<QdrantSearchResult[]> {
    const {
      k = 5,
      collectionName = config.qdrant.collectionName,
      filter,
    } = options;

    try {
      const vectorStore = this.getVectorStore(collectionName);
      const results = await vectorStore.similaritySearchVectorWithScore(queryVector, k, filter as any);

      return results.map(([doc, score]) => ({
        id: doc.id,
        score,
        pageContent: doc.pageContent,
        metadata: doc.metadata,
      }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[Qdrant] similaritySearchVectorWithScore error: ${message}`);
      return [];
    }
  }

  /**
   * Get collection stats (points count)
   */
  public async getCollectionStats(collectionName: string = config.qdrant.collectionName) {
    const client = this.getClient();
    const countRes = await client.count(collectionName, { exact: true });
    return {
      collectionName,
      pointsCount: countRes.count,
    };
  }
}

export const qdrantService = QdrantService.getInstance();
