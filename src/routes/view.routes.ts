import { Router, Request, Response } from 'express';
import path from 'path';
import { config } from '../config';

const router = Router();

// Fallback / root route serving upload landing page
router.get('/', (req: Request, res: Response) => {
  res.sendFile(path.join(config.publicDir, 'index.html'));
});

// Chat page route
router.get('/chat', (req: Request, res: Response) => {
  res.sendFile(path.join(config.publicDir, 'chat.html'));
});

export default router;

