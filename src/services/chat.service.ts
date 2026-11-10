import { retrievalPipeline, RetrievalResult } from './retrieval.service';
import { generateAnswer, generateAnswerStream } from './generation.service';

export interface ChatFile {
  fileName?: string;
  originalName?: string;
}

export interface ChatRequestBody {
  message: string;
  files?: ChatFile[];
  stream?: boolean;
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

  private async getContextAndSources(message: string, files?: ChatFile[]) {
    const retrieval = await retrievalPipeline(message);
    const activeFiles = Array.isArray(files) && files.length > 0
      ? files.map((f: ChatFile) => f.originalName || f.fileName || 'Document').join(', ')
      : 'Uploaded Document';

    const retrievedSources = retrieval.chunks
      .map((c) => c.source)
      .filter((s): s is string => Boolean(s));

    const sources = retrievedSources.length > 0
      ? Array.from(new Set(retrievedSources))
      : (Array.isArray(files) && files.length > 0
          ? files.map((f: ChatFile) => f.originalName).filter(Boolean) as string[]
          : [activeFiles]);

    return { context: retrieval.context, sources };
  }

  public async generateReply(message: string, files?: ChatFile[]): Promise<ChatResponseData> {
    const { context, sources } = await this.getContextAndSources(message, files);
    const reply = await generateAnswer(message, context);
    return { success: true, reply, sources, context };
  }

  public async *generateReplyStream(
    message: string,
    files?: ChatFile[],
    signal?: AbortSignal
  ): AsyncGenerator<string, void, unknown> {
    const { context } = await this.getContextAndSources(message, files);
    yield* generateAnswerStream(message, context, signal);
  }
}

export const chatService = ChatService.getInstance();
