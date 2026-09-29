import { z } from 'zod';
import { AgentTool, ToolContext } from '../base/agent-tool.interface';

export const getCurrentTimeSchema = z.object({
  timezone: z
    .string()
    .optional()
    .describe('IANA timezone name (e.g., "UTC", "America/New_York", "Asia/Kolkata", "Europe/London"). Defaults to system local timezone.'),
});

export type GetCurrentTimeInput = z.infer<typeof getCurrentTimeSchema>;

export interface GetCurrentTimeOutput {
  iso: string;
  formatted: string;
  dayOfWeek: string;
  timezone: string;
  timestampMs: number;
}

export const getCurrentTimeTool: AgentTool<GetCurrentTimeInput, GetCurrentTimeOutput> = {
  name: 'get_current_time',
  description: 'Get the current date and time in a specified or default timezone. Useful for scheduling, reminders, and time-aware queries.',
  riskLevel: 'READ',
  inputSchema: getCurrentTimeSchema,

  async execute(input: GetCurrentTimeInput, _context: ToolContext): Promise<GetCurrentTimeOutput> {
    const now = new Date();
    const timeZone = input.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

    try {
      const formatted = new Intl.DateTimeFormat('en-US', {
        dateStyle: 'full',
        timeStyle: 'long',
        timeZone,
      }).format(now);

      const dayOfWeek = new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        timeZone,
      }).format(now);

      return {
        iso: now.toISOString(),
        formatted,
        dayOfWeek,
        timezone: timeZone,
        timestampMs: now.getTime(),
      };
    } catch {
      // Fallback if timezone is unrecognized
      return {
        iso: now.toISOString(),
        formatted: now.toUTCString(),
        dayOfWeek: new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(now),
        timezone: 'UTC',
        timestampMs: now.getTime(),
      };
    }
  },
};
