import { Router, Request, Response } from 'express';
import { chatService, ChatRequestBody } from '../services/chat.service';

const router = Router();

// Chat endpoint for RAG query processing (supports SSE streaming and JSON fallback)
router.post('/chat', async (req: Request<{}, {}, ChatRequestBody>, res: Response) => {
  const { message, files, stream = true } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ success: false, error: 'Message is required' });
  }

  // Non-streaming fallback if explicitly requested
  if (stream === false) {
    try {
      const result = await chatService.generateReply(message, files);
      return res.json(result);
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        reply: `Error: ${error.message || 'Something went wrong generating the answer.'}`,
      });
    }
  }

  // Set SSE streaming headers
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const abortController = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) {
      abortController.abort();
    }
  });

  try {
    for await (const token of chatService.generateReplyStream(message, files, abortController.signal)) {
      if (abortController.signal.aborted) break;
      res.write(`data: ${JSON.stringify(token)}\n\n`);
    }
    if (!abortController.signal.aborted) {
      res.write('data: [DONE]\n\n');
    }
  } catch (error: any) {
    if (!abortController.signal.aborted) {
      res.write(`data: ${JSON.stringify(`\n\nError: ${error.message}`)}\n\n`);
      res.write('data: [DONE]\n\n');
    }
  } finally {
    res.end();
  }
});

export default router;
