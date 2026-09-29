import { Router } from 'express';
import {
  listReminders,
  createReminder,
  cancelReminder,
  deleteReminder,
} from '../controllers/reminder.controller';
import { optionalAuthMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(optionalAuthMiddleware);

router.get('/', listReminders);
router.post('/', createReminder);
router.patch('/:id/cancel', cancelReminder);
router.delete('/:id', deleteReminder);

export default router;
