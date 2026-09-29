import { Request, Response } from 'express';
import { z } from 'zod';
import { AgentEngine } from '../agents/agent.engine';
import { globalToolRegistry } from '../tools/base/tool-registry';
import { logger } from '../utils/logger';

const runAgentSchema = z.object({
  goal: z.string().min(1, 'Goal is required'),
  conversationId: z.string().optional(),
  maxSteps: z.number().int().positive().optional(),
  timeoutMs: z.number().int().positive().optional(),
});

export async function runAgent(req: Request, res: Response): Promise<void> {
  const parseResult = runAgentSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Validation failed', details: parseResult.error.format() });
    return;
  }

  const userId = req.user?.userId || 'anonymous-user';
  const { goal, conversationId, maxSteps, timeoutMs } = parseResult.data;

  try {
    // Instantiate per-request so there is no shared mutable state across concurrent calls
    const engine = new AgentEngine();
    const result = await engine.run({
      userId,
      goal,
      conversationId,
      maxSteps,
      timeoutMs,
    });

    res.status(200).json(result);
  } catch (error: any) {
    logger.error({ error: error.message }, 'Agent controller execution failed');
    res.status(500).json({ error: 'Agent execution failed', details: error.message });
  }
}

export function listTools(_req: Request, res: Response): void {
  const tools = globalToolRegistry.getAll().map((tool) => ({
    name: tool.name,
    description: tool.description,
    riskLevel: tool.riskLevel,
  }));

  res.status(200).json({ tools });
}
