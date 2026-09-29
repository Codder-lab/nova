export type RiskLevel = 'READ' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type AgentRunStatus =
  | 'queued'
  | 'planning'
  | 'running'
  | 'waiting_for_approval'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type AgentStepType = 'planning' | 'tool' | 'observation' | 'response';

export type AgentStepStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface ToolCallRecord {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
  error?: string;
  durationMs?: number;
  status: 'pending' | 'executing' | 'completed' | 'failed';
}

export interface AgentStep {
  id: string;
  stepNumber: number;
  type: AgentStepType;
  title: string;
  description?: string;
  toolCall?: ToolCallRecord;
  status: AgentStepStatus;
  startedAt: Date;
  completedAt?: Date;
}

export interface AgentRun {
  id: string;
  userId: string;
  conversationId?: string;
  goal: string;
  status: AgentRunStatus;
  steps: AgentStep[];
  finalResponse?: string;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface AgentInput {
  userId: string;
  goal: string;
  conversationId?: string;
  runId?: string;
  maxSteps?: number;
  timeoutMs?: number;
}

export interface AgentResult {
  runId: string;
  status: AgentRunStatus;
  goal: string;
  response: string;
  steps: AgentStep[];
  toolCallsCount: number;
  durationMs: number;
  error?: string;
}
