import { Router } from 'express';
import uploadRoutes from './upload.routes';
import chatRoutes from './chat.routes';
import viewRoutes from './view.routes';

const router = Router();

// Health check endpoint
router.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
  });
});

router.use('/api', uploadRoutes);
router.use('/api', chatRoutes);
router.use('/', viewRoutes);

export default router;
