export type AnalyticsTimeRange = "24h" | "7d" | "30d" | "all";

export interface AnalyticsOverview {
  totalRuns: number;
  completedRuns: number;
  failedRuns: number;
  waitingApprovalRuns: number;
  successRate: number; // 0 - 100
  avgRunDurationMs: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  estimatedCostUsd: number;
  totalToolCalls: number;
  pendingApprovalsCount: number;
  approvalRate: number; // 0 - 100
  totalMemories: number;
  totalTasks: number;
}

export interface TimeSeriesDataPoint {
  date: string; // ISO date or "YYYY-MM-DD" or "HH:00"
  runs: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
}

export interface ModelUsageStat {
  model: string;
  provider: string;
  runsCount: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  estimatedCostUsd: number;
  percentage: number;
}

export interface ToolPerformanceStat {
  name: string;
  totalCalls: number;
  successCalls: number;
  failedCalls: number;
  successRate: number; // 0 - 100
  avgDurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
  riskLevel: string;
}

export interface GoalComplexityBucket {
  range: string;
  count: number;
  percentage: number;
}

export interface GoalComplexitySummary {
  buckets: GoalComplexityBucket[];
  p50DurationMs: number;
  p90DurationMs: number;
  avgStepsPerRun: number;
}

export interface AnalyticsFullReport {
  overview: AnalyticsOverview;
  timeline: TimeSeriesDataPoint[];
  models: ModelUsageStat[];
  tools: ToolPerformanceStat[];
  complexity: GoalComplexitySummary;
  timeRange: AnalyticsTimeRange;
}
