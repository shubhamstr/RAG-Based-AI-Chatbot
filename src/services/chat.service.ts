import { retrievalPipeline, RetrievalResult } from './retrieval.service';
import { generateAnswer } from './generation.service';

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

    // 3. Generate answer using OpenAI chat model with prompt (context + query)
    const reply = await generateAnswer(message, retrieval.context);

    return {
      success: true,
      reply,
      sources,
      context: retrieval.context,
    };
  }
}

export const chatService = ChatService.getInstance();
