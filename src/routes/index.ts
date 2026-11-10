import { Router } from 'express';
import uploadRoutes from './upload.routes';
import chatRoutes from './chat.routes';
import viewRoutes from './view.routes';

const router = Router();

router.use('/api', uploadRoutes);
router.use('/api', chatRoutes);
router.use('/', viewRoutes);

export default router;
