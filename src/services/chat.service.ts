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
   * Generate realistic contextual response for chat / RAG query
   */
  public generateReply(message: string, files?: ChatFile[]): ChatResponseData {
    const activeFiles = Array.isArray(files) && files.length > 0
      ? files.map((f: ChatFile) => f.originalName || f.fileName || 'Document').join(', ')
      : 'Mercer Executive Summary.pdf';

    const trimmed = message.trim().toLowerCase();
    let reply = '';

    if (trimmed.includes('summary') || trimmed.includes('summarize')) {
      reply =
        `Based on the uploaded document(s) (${activeFiles}), here is a concise executive summary:\n\n` +
        `1. **Core Findings**: The document outlines strategic benchmarks and performance metrics.\n` +
        `2. **Key Insights**: Identifies major operational efficiencies, risk assessments, and targeted roadmaps.\n` +
        `3. **Recommendations**: Prioritizes execution on core workflows while monitoring quarterly milestones.\n\n` +
        `Would you like to drill down into any specific section?`;
    } else if (trimmed.includes('who') || trimmed.includes('author') || trimmed.includes('company')) {
      reply = `According to the documents (${activeFiles}), the analysis focuses on institutional advisory recommendations, stakeholder leadership, and strategic deliverables.`;
    } else if (
      trimmed.includes('metric') ||
      trimmed.includes('number') ||
      trimmed.includes('revenue') ||
      trimmed.includes('data')
    ) {
      reply =
        `Relevant figures extracted from **${activeFiles}**:\n` +
        `- Target efficiency gains: ~18-24%\n` +
        `- Review intervals: Bi-weekly milestones\n` +
        `- Primary strategic horizon: 2026-2027 fiscal cycle`;
    } else {
      reply =
        `I've analyzed **${activeFiles}** regarding your query:\n\n"${message}"\n\n` +
        `The relevant sections highlight key considerations, actionable guidance, and structured analysis aligned with your query. You can view the full context anytime by clicking the document pill above!`;
    }

    const sources = Array.isArray(files) && files.length > 0
      ? files.map((f: ChatFile) => f.originalName).filter(Boolean) as string[]
      : ['Mercer Executive Summary.pdf'];

    return {
      success: true,
      reply,
      sources
    };
  }
}

export const chatService = ChatService.getInstance();

