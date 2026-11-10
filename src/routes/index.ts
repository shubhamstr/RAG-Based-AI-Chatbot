import { Router } from 'express';
import uploadRoutes from './upload.routes';
import chatRoutes from './chat.routes';
import viewRoutes from './view.routes';

const router = Router();
const apiRouter = Router();

// Group API sub-routes under the parent apiRouter
apiRouter.use(uploadRoutes);
apiRouter.use(chatRoutes);

// Mount parent /api route once (also allows API-wide middleware here)
router.use('/api', apiRouter);

// Mount view routes
router.use('/', viewRoutes);

export default router;
