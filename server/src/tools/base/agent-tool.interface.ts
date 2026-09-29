import { z } from 'zod';
import { RiskLevel } from '@nova/shared';

export interface ToolContext {
  userId: string;
  conversationId?: string;
  runId?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentTool<TInput = any, TOutput = any> {
  name: string;
  description: string;
  riskLevel: RiskLevel;
  inputSchema: z.ZodType<TInput>;

  execute(input: TInput, context: ToolContext): Promise<TOutput>;
}
