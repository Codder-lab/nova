import { globalToolRegistry } from "./base/tool-registry";
import { getCurrentTimeTool } from "./system/datetime.tool";
import { calculateTool } from "./system/calculate.tool";
import {
  createTaskTool,
  listTasksTool,
  updateTaskTool,
  completeTaskTool,
  deleteTaskTool,
} from "./productivity/task.tools";
import {
  createReminderTool,
  listRemindersTool,
  cancelReminderTool,
} from "./productivity/reminder.tools";
import {
  saveMemoryTool,
  recallMemoryTool,
  listMemoriesTool,
} from "./productivity/memory.tools";
import { webSearchTool } from "./research/web-search.tool";
import { fetchWebPageTool } from "./research/fetch-web-page.tool";
import {
  listFilesTool,
  readFileTool,
  createFileTool,
} from "./system/file.tools";
import {
  createScheduleTool,
  listSchedulesTool,
  cancelScheduleTool,
} from "./productivity/scheduler.tools";
import {
  openBrowserTool,
  navigateToTool,
  clickElementTool,
  typeIntoTool,
  extractPageContentTool,
} from "./browser/browser.tools";

export * from "./base/agent-tool.interface";
export * from "./base/tool-registry";
export * from "./base/zod-to-json";
export * from "./system/datetime.tool";
export * from "./system/calculate.tool";
export * from "./productivity/task.tools";
export * from "./productivity/reminder.tools";
export * from "./productivity/memory.tools";
export * from "./research/web-search.tool";
export * from "./research/fetch-web-page.tool";
export * from "./system/file.tools";
export * from "./productivity/scheduler.tools";
export * from "./browser/browser.tools";
export * from "./browser/browser.manager";

export function initializeDefaultTools(): void {
  // System Tools
  globalToolRegistry.register(getCurrentTimeTool);
  globalToolRegistry.register(calculateTool);
  globalToolRegistry.register(listFilesTool);
  globalToolRegistry.register(readFileTool);
  globalToolRegistry.register(createFileTool);

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

  // Productivity: Memory Tools
  globalToolRegistry.register(saveMemoryTool);
  globalToolRegistry.register(recallMemoryTool);
  globalToolRegistry.register(listMemoriesTool);

  // Productivity: Scheduler Tools
  globalToolRegistry.register(createScheduleTool);
  globalToolRegistry.register(listSchedulesTool);
  globalToolRegistry.register(cancelScheduleTool);

  // Browser Tools (Playwright Automation)
  globalToolRegistry.register(openBrowserTool);
  globalToolRegistry.register(navigateToTool);
  globalToolRegistry.register(clickElementTool);
  globalToolRegistry.register(typeIntoTool);
  globalToolRegistry.register(extractPageContentTool);

  // Research Tools
  globalToolRegistry.register(webSearchTool);
  globalToolRegistry.register(fetchWebPageTool);
}
