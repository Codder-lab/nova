import { ToolRegistry } from '../tools/base/tool-registry';
import { LLMProvider } from '../llm/provider';

export interface AgentContext {
  userId: string;
  conversationId?: string;
  runId: string;
  toolRegistry: ToolRegistry;
  llmProvider: LLMProvider;
  workingMemory: Map<string, unknown>;
  startTime: number;
  maxSteps: number;
  timeoutMs: number;
}
