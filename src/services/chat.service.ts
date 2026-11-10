import { retrievalPipeline, RetrievalResult } from './retrieval.service';

export interface ChatFile {
  fileName?: string;
  originalName?: string;
}

export interface ChatRequestBody {
  message: string;
  files?: ChatFile[];
}

export interface ChatResponseData {
  success: boolean;
  reply: string;
  sources: string[];
  context?: string;
}

export class ChatService {
  private static instance: ChatService;

  public static getInstance(): ChatService {
    if (!ChatService.instance) {
      ChatService.instance = new ChatService();
    }
    return ChatService.instance;
  }

  /**
   * Process user query through the retrieval pipeline and generate contextual response
   */
  public async generateReply(message: string, files?: ChatFile[]): Promise<ChatResponseData> {
    // 1. Run retrieval pipeline to get top-k chunks and LLM context
    const retrieval = await retrievalPipeline(message);

    const activeFiles = Array.isArray(files) && files.length > 0
      ? files.map((f: ChatFile) => f.originalName || f.fileName || 'Document').join(', ')
      : 'Uploaded Document';

    // 2. Identify sources from retrieved chunks
    const retrievedSources = retrieval.chunks
      .map((c) => c.source)
      .filter((s): s is string => Boolean(s));

    const sources = retrievedSources.length > 0
      ? Array.from(new Set(retrievedSources))
      : (Array.isArray(files) && files.length > 0
          ? files.map((f: ChatFile) => f.originalName).filter(Boolean) as string[]
          : [activeFiles]);

    // 3. Formulate response (using retrieved context if available, or fallback message)
    let reply = '';
    if (retrieval.context) {
      reply =
        `Based on the retrieved context from your documents:\n\n` +
        retrieval.chunks
          .map((chunk, i) => `**Section ${i + 1}** (${chunk.source || 'Document'}):\n> ${chunk.content.trim()}`)
          .join('\n\n');
    } else {
      reply =
        `I've analyzed **${activeFiles}** regarding your query:\n\n"${message}"\n\n` +
        `Relevant context will be retrieved here once documents are indexed in Qdrant with your OpenAI API key.`;
    }

    return {
      success: true,
      reply,
      sources,
      context: retrieval.context,
    };
  }
}

export const chatService = ChatService.getInstance();
