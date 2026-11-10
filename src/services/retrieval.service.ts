import { OpenAIEmbeddings } from '@langchain/openai';
import { QdrantVectorStore } from '@langchain/qdrant';
import { QdrantClient } from '@qdrant/js-client-rest';
import { config } from '../config';

export interface RetrievedChunk {
  content: string;
  source?: string;
  score?: number;
  metadata?: Record<string, any>;
}

export interface RetrievalResult {
  query: string;
  chunks: RetrievedChunk[];
  context: string;
}

/**
 * Retrieval Pipeline:
 * 1. Takes user query
 * 2. Converts query to embeddings
 * 3. Performs Qdrant similarity search to retrieve top K chunks
 * 4. Formats and generates context for sending to LLM
 */
export async function retrievalPipeline(
  query: string,
  topK: number = 4
): Promise<RetrievalResult> {
  if (!config.openai.apiKey) {
    console.warn('[Retrieval] OPENAI_API_KEY is not configured. Skipping vector search.');
    return { query, chunks: [], context: '' };
  }

  try {
    // 1. Initialize OpenAI Embeddings & Qdrant vector store
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

    // 2. Similarity search in Qdrant (query is converted to embeddings and matched against vector store)
    const searchResults = await vectorStore.similaritySearchWithScore(query, topK);

    // 3. Extract top K chunks
    const chunks: RetrievedChunk[] = searchResults.map(([doc, score]) => ({
      content: doc.pageContent,
      source: doc.metadata?.source || doc.metadata?.fileName || 'Document',
      score,
      metadata: doc.metadata,
    }));

    // 4. Generate context for sending to LLM
    const context = chunks
      .map((chunk, idx) => `[Source ${idx + 1}: ${chunk.source}]\n${chunk.content}`)
      .join('\n\n---\n\n');

    return {
      query,
      chunks,
      context,
    };
  } catch (err: any) {
    console.warn(`[Retrieval] Failed to retrieve chunks from Qdrant: ${err.message}`);
    return { query, chunks: [], context: '' };
  }
}

