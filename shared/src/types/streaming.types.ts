export const AgentSocketEvents = {
  RUN_STARTED: "agent:started",
  RUN_STEP: "agent:step",
  RUN_TOOL_CALL: "agent:tool",
  RUN_COMPLETED: "agent:completed",
  RUN_FAILED: "agent:failed",
  RUN_TOKEN: "agent:token",
  APPROVAL_REQUIRED: "agent:approval_required",
  APPROVAL_RESOLVED: "agent:approval_resolved",
} as const;

export type AgentSocketEventName =
  (typeof AgentSocketEvents)[keyof typeof AgentSocketEvents];

export interface AgentStreamEvent<T = unknown> {
  runId: string;
  userId: string;
  type: string;
  timestamp: string;
  payload: T;
}
