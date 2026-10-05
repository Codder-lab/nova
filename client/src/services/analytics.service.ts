import type {
  AnalyticsFullReport,
  AnalyticsOverview,
  AnalyticsTimeRange,
  GoalComplexitySummary,
  ModelUsageStat,
  TimeSeriesDataPoint,
  ToolPerformanceStat,
} from "@nova/shared";

const API_BASE = "/api/analytics";

export async function fetchAnalyticsOverview(
  timeRange: AnalyticsTimeRange = "7d"
): Promise<AnalyticsOverview> {
  const res = await fetch(`${API_BASE}/overview?range=${timeRange}`);
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || "Failed to fetch analytics overview");
  }
  return data.overview;
}

export async function fetchAnalyticsTimeline(
  timeRange: AnalyticsTimeRange = "7d"
): Promise<TimeSeriesDataPoint[]> {
  const res = await fetch(`${API_BASE}/timeline?range=${timeRange}`);
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || "Failed to fetch analytics timeline");
  }
  return data.timeline || [];
}

export async function fetchAnalyticsModels(
  timeRange: AnalyticsTimeRange = "7d"
): Promise<ModelUsageStat[]> {
  const res = await fetch(`${API_BASE}/models?range=${timeRange}`);
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || "Failed to fetch model stats");
  }
  return data.models || [];
}

export async function fetchAnalyticsTools(
  timeRange: AnalyticsTimeRange = "7d"
): Promise<ToolPerformanceStat[]> {
  const res = await fetch(`${API_BASE}/tools?range=${timeRange}`);
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || "Failed to fetch tool stats");
  }
  return data.tools || [];
}

export async function fetchAnalyticsComplexity(
  timeRange: AnalyticsTimeRange = "7d"
): Promise<GoalComplexitySummary> {
  const res = await fetch(`${API_BASE}/complexity?range=${timeRange}`);
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || "Failed to fetch complexity stats");
  }
  return data.complexity;
}

export async function fetchFullReport(
  timeRange: AnalyticsTimeRange = "7d"
): Promise<AnalyticsFullReport> {
  const res = await fetch(`${API_BASE}/report?range=${timeRange}`);
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || "Failed to fetch full report");
  }
  return data.report;
}

export async function downloadReportCsv(
  timeRange: AnalyticsTimeRange = "7d"
): Promise<void> {
  const url = `${API_BASE}/export?range=${timeRange}`;
  const res = await fetch(url);
  const blob = await res.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = downloadUrl;
  a.download = `nova-observability-${timeRange}-${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(downloadUrl);
}
