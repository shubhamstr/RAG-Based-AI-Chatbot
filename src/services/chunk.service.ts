import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import fs from 'fs/promises';
import path from 'path';

export interface ChunkMetadata {
  documentId: string;
  source: string;
  chunkIndex: number;
  [key: string]: any;
}

export interface DocumentChunk {
  content: string;
  metadata: ChunkMetadata;
}

export interface ChunksInfo {
  fileName: string;
  relativePath: string;
  url: string;
  totalChunks: number;
  chunks: DocumentChunk[];
}

/**
 * Splits extracted text file into chunks with metadata using RecursiveCharacterTextSplitter
 * 
 * @param filePath Full filesystem path to the extracted text file
 * @param documentId Unique identifier for the document
 * @returns Array of chunks with content and metadata
 */
export async function createChunks(filePath: string, documentId: string): Promise<DocumentChunk[]> {
  // Read extracted text
  const text = await fs.readFile(filePath, 'utf-8');

  // Initialize text splitter
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
    separators: ['\n\n', '\n', '. ', ' ', ''],
  });

  // Split text
  const chunks = await splitter.createDocuments(
    [text],
    [{ documentId, source: filePath }]
  );

  // Return chunks with metadata
  return chunks.map((chunk, index) => ({
    content: chunk.pageContent,
    metadata: {
      documentId,
      source: filePath,
      ...chunk.metadata,
      chunkIndex: index,
    },
  }));
}

export class ChunkService {
  private static instance: ChunkService;

  public static getInstance(): ChunkService {
    if (!ChunkService.instance) {
      ChunkService.instance = new ChunkService();
    }
    return ChunkService.instance;
  }

  /**
   * Executes chunking immediately on extracted text and saves chunks.json in the upload folder
   */
  public async createAndSaveChunks(
    filePath: string,
    documentId: string,
    outputFolderPath: string,
    folderName: string
  ): Promise<ChunksInfo> {
    const chunks = await createChunks(filePath, documentId);

    const chunksFileName = 'chunks.json';
    const chunksFilePath = path.join(outputFolderPath, chunksFileName);
    const chunksRelativePath = folderName ? `${folderName}/${chunksFileName}` : chunksFileName;
    const chunksUrl = `/uploads/${chunksRelativePath}`;

    await fs.writeFile(chunksFilePath, JSON.stringify(chunks, null, 2), 'utf-8');

    return {
      fileName: chunksFileName,
      relativePath: chunksRelativePath,
      url: chunksUrl,
      totalChunks: chunks.length,
      chunks
    };
  }
}

export const chunkService = ChunkService.getInstance();
