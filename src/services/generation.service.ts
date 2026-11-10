import OpenAI from 'openai';
import { config } from '../config';

const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

/**
 * Generation Service:
 * Constructs prompt with retrieved context and user query,
 * calls OpenAI chat model, and returns the final LLM answer.
 */
export async function generateAnswer(query: string, context?: string): Promise<string> {
  if (!config.openai.apiKey) {
    return 'OpenAI API key is missing. Please set OPENAI_API_KEY in your .env file.';
  }

  const prompt = `You are a helpful and precise assistant. Use the following context to answer the user's question accurately. If the context does not contain enough information to answer, state that clearly.

Context:
${context?.trim() || 'No relevant context found.'}

Question:
${query}`;

  try {
    const response = await openai.chat.completions.create({
      model: config.openai.chatModel,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
    });

    return response.choices[0]?.message?.content?.trim() || 'No answer generated.';
  } catch (error: any) {
    console.error('[GenerationService] Error:', error.message);
    return `Error generating response: ${error.message}`;
  }
}

