export type TaskStatus = 'todo' | 'in_progress' | 'completed' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface TaskItem {
  id: string;
  userId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: Date | string;
  tags: string[];
  createdAt: Date | string;
  updatedAt: Date | string;
}

export type ReminderStatus = 'pending' | 'triggered' | 'cancelled';

export interface ReminderItem {
  id: string;
  userId: string;
  title: string;
  description?: string;
  remindAt: Date | string;
  status: ReminderStatus;
  createdAt: Date | string;
  updatedAt: Date | string;
}
