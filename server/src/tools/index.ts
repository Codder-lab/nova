import { globalToolRegistry } from './base/tool-registry';
import { getCurrentTimeTool } from './system/datetime.tool';
import { calculateTool } from './system/calculate.tool';
import {
  createTaskTool,
  listTasksTool,
  updateTaskTool,
  completeTaskTool,
  deleteTaskTool,
} from './productivity/task.tools';
import {
  createReminderTool,
  listRemindersTool,
  cancelReminderTool,
} from './productivity/reminder.tools';
import { webSearchTool } from './research/web-search.tool';
import { fetchWebPageTool } from './research/fetch-web-page.tool';

export * from './base/agent-tool.interface';
export * from './base/tool-registry';
export * from './base/zod-to-json';
export * from './system/datetime.tool';
export * from './system/calculate.tool';
export * from './productivity/task.tools';
export * from './productivity/reminder.tools';
export * from './research/web-search.tool';
export * from './research/fetch-web-page.tool';

export function initializeDefaultTools(): void {
  // System Tools
  globalToolRegistry.register(getCurrentTimeTool);
  globalToolRegistry.register(calculateTool);

  // Productivity: Task Tools
  globalToolRegistry.register(createTaskTool);
  globalToolRegistry.register(listTasksTool);
  globalToolRegistry.register(updateTaskTool);
  globalToolRegistry.register(completeTaskTool);
  globalToolRegistry.register(deleteTaskTool);

  // Productivity: Reminder Tools
  globalToolRegistry.register(createReminderTool);
  globalToolRegistry.register(listRemindersTool);
  globalToolRegistry.register(cancelReminderTool);

  // Research Tools
  globalToolRegistry.register(webSearchTool);
  globalToolRegistry.register(fetchWebPageTool);
}
