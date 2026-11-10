import { Router, Request, Response } from 'express';
import { chatService, ChatRequestBody } from '../services/chat.service';

const router = Router();

// Chat endpoint for RAG query processing
router.post('/chat', async (req: Request<{}, {}, ChatRequestBody>, res: Response) => {
  const { message, files } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ success: false, error: 'Message is required' });
  }

  try {
    const result = await chatService.generateReply(message, files);
    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      reply: `Error: ${error.message || 'Something went wrong generating the answer.'}`,
    });
  }
});

export default router;
