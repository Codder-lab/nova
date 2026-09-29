import { Router } from 'express';
import {
  listTasks,
  createTask,
  getTaskById,
  updateTask,
  deleteTask,
} from '../controllers/task.controller';
import { optionalAuthMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(optionalAuthMiddleware);

router.get('/', listTasks);
router.post('/', createTask);
router.get('/:id', getTaskById);
router.patch('/:id', updateTask);
router.delete('/:id', deleteTask);

export default router;
