import OpenAI from 'openai';
import { config } from '../config';

const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

function buildPrompt(query: string, context?: string): string {
  return `You are a helpful and precise assistant. Use the following context to answer the user's question accurately. If the context does not contain enough information to answer, state that clearly.

Context:
${context?.trim() || 'No relevant context found.'}

Question:
${query}`;
}

export async function generateAnswer(query: string, context?: string): Promise<string> {
  if (!config.openai.apiKey) {
    return 'OpenAI API key is missing. Please set OPENAI_API_KEY in your .env file.';
  }

  try {
    const res = await openai.chat.completions.create({
      model: config.openai.chatModel,
      messages: [{ role: 'user', content: buildPrompt(query, context) }],
      temperature: 0.2,
    });
    return res.choices[0]?.message?.content?.trim() || 'No answer generated.';
  } catch (error: any) {
    console.error('[GenerationService] Error:', error.message);
    return `Error generating response: ${error.message}`;
  }
}

export async function* generateAnswerStream(
  query: string,
  context?: string,
  signal?: AbortSignal
): AsyncGenerator<string, void, unknown> {
  if (!config.openai.apiKey) {
    yield 'OpenAI API key is missing. Please set OPENAI_API_KEY in your .env file.';
    return;
  }

  try {
    const stream = await openai.chat.completions.create(
      {
        model: config.openai.chatModel,
        messages: [{ role: 'user', content: buildPrompt(query, context) }],
        temperature: 0.2,
        stream: true,
      },
      { signal }
    );

    for await (const chunk of stream) {
      if (signal?.aborted) break;
      const token = chunk.choices[0]?.delta?.content;
      if (token) yield token;
    }
  } catch (error: any) {
    if (!signal?.aborted && error.name !== 'AbortError') {
      console.error('[GenerationService] Stream Error:', error.message);
      yield `\n\nError generating response: ${error.message}`;
    }
  }
}



