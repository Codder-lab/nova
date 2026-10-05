import React, { useState, useEffect } from "react";
import type {
  AnalyticsOverview,
  AnalyticsTimeRange,
  GoalComplexitySummary,
  ModelUsageStat,
  TimeSeriesDataPoint,
  ToolPerformanceStat,
} from "@nova/shared";
import {
  fetchAnalyticsOverview,
  fetchAnalyticsTimeline,
  fetchAnalyticsModels,
  fetchAnalyticsTools,
  fetchAnalyticsComplexity,
  downloadReportCsv,
} from "@/services/analytics.service";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  BarChart3,
  TrendingUp,
  Coins,
  Cpu,
  Zap,
  Clock,
  CheckCircle2,
  Download,
  RefreshCw,
  Search,
  Activity,
  Layers,
  Wrench,
  Sparkles,
} from "lucide-react";

export const AnalyticsView: React.FC = () => {
  const [timeRange, setTimeRange] = useState<AnalyticsTimeRange>("7d");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [timeline, setTimeline] = useState<TimeSeriesDataPoint[]>([]);
  const [models, setModels] = useState<ModelUsageStat[]>([]);
  const [tools, setTools] = useState<ToolPerformanceStat[]>([]);
  const [complexity, setComplexity] = useState<GoalComplexitySummary | null>(null);
  const [toolSearch, setToolSearch] = useState("");

  const loadData = async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) setRefreshing(true);
      else setLoading(true);

      const [ov, tl, md, tlList, comp] = await Promise.all([
        fetchAnalyticsOverview(timeRange),
        fetchAnalyticsTimeline(timeRange),
        fetchAnalyticsModels(timeRange),
        fetchAnalyticsTools(timeRange),
        fetchAnalyticsComplexity(timeRange),
      ]);

      setOverview(ov);
      setTimeline(tl);
      setModels(md);
      setTools(tlList);
      setComplexity(comp);
    } catch (err) {
      console.error("Failed to load analytics data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [timeRange]);

  const handleExport = async () => {
    try {
      await downloadReportCsv(timeRange);
    } catch (err) {
      console.error("Failed to export analytics report:", err);
    }
  };

  // Format token counts cleanly (e.g. 1.2M, 45.2K)
  const formatTokens = (num = 0) => {
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  // Format milliseconds to seconds or ms
  const formatDuration = (ms = 0) => {
    if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
    return `${ms}ms`;
  };

  const filteredTools = tools.filter((t) =>
    t.name.toLowerCase().includes(toolSearch.toLowerCase())
  );

  // SVG Chart Dimensions & Helpers
  const chartHeight = 180;
  const chartWidth = 560;
  const padding = { top: 20, right: 20, bottom: 30, left: 40 };

  const maxTokens = Math.max(...timeline.map((d) => d.totalTokens), 100);
  const plotWidth = chartWidth - padding.left - padding.right;
  const plotHeight = chartHeight - padding.top - padding.bottom;

  const points = timeline.map((d, i) => {
    const x =
      padding.left +
      (timeline.length > 1 ? (i / (timeline.length - 1)) * plotWidth : plotWidth / 2);
    const y =
      padding.top + plotHeight - (d.totalTokens / maxTokens) * plotHeight;
    return { x, y, ...d };
  });

  const svgPath =
    points.length > 0
      ? `M ${points[0].x} ${points[0].y} ` +
        points.slice(1).map((p) => `L ${p.x} ${p.y}`).join(" ")
      : "";

  const areaPath =
    points.length > 0
      ? `${svgPath} L ${points[points.length - 1].x} ${
          padding.top + plotHeight
        } L ${points[0].x} ${padding.top + plotHeight} Z`
      : "";

  if (loading && !overview) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3 text-muted-foreground">
        <RefreshCw className="w-6 h-6 animate-spin text-primary" />
        <p className="text-xs">Computing analytics and execution metrics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Agent Analytics & Observability
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Deep execution traces, token economy, tool performance, and complexity profiles.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Time Range Pills */}
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border">
            {(
              [
                { id: "24h", label: "24h" },
                { id: "7d", label: "7d" },
                { id: "30d", label: "30d" },
                { id: "all", label: "All" },
              ] as const
            ).map((r) => (
              <button
                key={r.id}
                onClick={() => setTimeRange(r.id)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  timeRange === r.id
                    ? "bg-card text-foreground shadow-2xs border border-border/80"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="h-8 gap-1.5 text-xs cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            className="h-8 gap-1.5 text-xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </Button>
        </div>
      </div>

      {/* 6 Top-Level KPI Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* 1. Total Runs */}
        <Card className="bg-card border-border shadow-xs">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-medium uppercase tracking-wider">
                Total Runs
              </span>
              <Layers className="w-4 h-4 text-primary" />
            </div>
            <div className="text-2xl font-bold text-foreground tracking-tight">
              {overview?.totalRuns ?? 0}
            </div>
            <div className="text-[11px] text-muted-foreground flex items-center gap-1">
              <span className="text-emerald-500 font-semibold">
                {overview?.completedRuns ?? 0} ok
              </span>
              <span>·</span>
              <span className="text-rose-500 font-semibold">
                {overview?.failedRuns ?? 0} failed
              </span>
            </div>
          </CardContent>
        </Card>

        {/* 2. Success Rate */}
        <Card className="bg-card border-border shadow-xs">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-medium uppercase tracking-wider">
                Success Rate
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold text-foreground tracking-tight flex items-baseline gap-1">
              <span>{overview?.successRate ?? 100}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${overview?.successRate ?? 100}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* 3. Total Tokens */}
        <Card className="bg-card border-border shadow-xs">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-medium uppercase tracking-wider">
                Tokens Used
              </span>
              <Zap className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold text-foreground tracking-tight">
              {formatTokens(overview?.totalTokens)}
            </div>
            <div className="text-[11px] text-muted-foreground truncate">
              {formatTokens(overview?.promptTokens)} in /{" "}
              {formatTokens(overview?.completionTokens)} out
            </div>
          </CardContent>
        </Card>

        {/* 4. Estimated Cost */}
        <Card className="bg-card border-border shadow-xs">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-medium uppercase tracking-wider">
                Est. Spend
              </span>
              <Coins className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold text-foreground tracking-tight">
              ${overview?.estimatedCostUsd?.toFixed(3) ?? "0.000"}
            </div>
            <div className="text-[11px] text-muted-foreground flex items-center gap-1">
              <span className="text-emerald-500">Live Token Matrix</span>
            </div>
          </CardContent>
        </Card>

        {/* 5. Avg Latency */}
        <Card className="bg-card border-border shadow-xs">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-medium uppercase tracking-wider">
                Avg Latency
              </span>
              <Clock className="w-4 h-4 text-cyan-500" />
            </div>
            <div className="text-2xl font-bold text-foreground tracking-tight">
              {formatDuration(overview?.avgRunDurationMs)}
            </div>
            <div className="text-[11px] text-muted-foreground">
              p50: {formatDuration(complexity?.p50DurationMs)}
            </div>
          </CardContent>
        </Card>

        {/* 6. Tool Calls Total */}
        <Card className="bg-card border-border shadow-xs">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-medium uppercase tracking-wider">
                Tool Calls
              </span>
              <Wrench className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-2xl font-bold text-foreground tracking-tight">
              {overview?.totalToolCalls ?? 0}
            </div>
            <div className="text-[11px] text-muted-foreground">
              across {tools.length} active tools
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section: Token Velocity & Model Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Token Velocity SVG Area Chart (2 cols) */}
        <Card className="lg:col-span-2 bg-card border-border shadow-xs">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  Token Consumption & Activity Velocity
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Daily token output and inference runs over time.
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-[10px] font-mono">
                Max: {formatTokens(maxTokens)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            {timeline.length === 0 ? (
              <div className="h-44 flex flex-col items-center justify-center text-muted-foreground gap-1.5 text-xs">
                <BarChart3 className="w-6 h-6 opacity-40" />
                <span>No execution activity in this time window</span>
              </div>
            ) : (
              <div className="relative w-full overflow-hidden">
                <svg
                  viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                  className="w-full h-44 overflow-visible"
                >
                  <defs>
                    <linearGradient id="tokenGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-primary, #6366f1)" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="var(--color-primary, #6366f1)" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Grid Lines */}
                  {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
                    const y = padding.top + plotHeight * (1 - pct);
                    return (
                      <g key={idx}>
                        <line
                          x1={padding.left}
                          y1={y}
                          x2={chartWidth - padding.right}
                          y2={y}
                          stroke="currentColor"
                          className="text-border/40"
                          strokeDasharray="3 3"
                        />
                        <text
                          x={padding.left - 6}
                          y={y + 3}
                          textAnchor="end"
                          className="text-[9px] fill-muted-foreground"
                        >
                          {formatTokens(Math.round(maxTokens * pct))}
                        </text>
                      </g>
                    );
                  })}

                  {/* Area Fill */}
                  {areaPath && (
                    <path d={areaPath} fill="url(#tokenGradient)" />
                  )}

                  {/* Line Stroke */}
                  {svgPath && (
                    <path
                      d={svgPath}
                      fill="none"
                      stroke="var(--color-primary, #6366f1)"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}

                  {/* Data Points */}
                  {points.map((p, idx) => (
                    <g key={idx} className="group">
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r="3.5"
                        fill="var(--color-primary, #6366f1)"
                        className="transition-all hover:r-5 cursor-pointer stroke-background stroke-2"
                      />
                      <title>{`${p.date}: ${formatTokens(p.totalTokens)} tokens (${p.runs} runs)`}</title>
                    </g>
                  ))}

                  {/* Date labels at bottom */}
                  {points.map((p, idx) => {
                    if (
                      points.length > 7 &&
                      idx % Math.ceil(points.length / 5) !== 0 &&
                      idx !== points.length - 1
                    ) {
                      return null;
                    }
                    return (
                      <text
                        key={idx}
                        x={p.x}
                        y={chartHeight - 8}
                        textAnchor="middle"
                        className="text-[9px] fill-muted-foreground"
                      >
                        {p.date.split(" ")[0].slice(5)}
                      </text>
                    );
                  })}
                </svg>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Model Distribution & Provider Breakdown (1 col) */}
        <Card className="bg-card border-border shadow-xs flex flex-col justify-between">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Cpu className="w-4 h-4 text-cyan-400" />
              Model & Provider Share
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Usage breakdown across configured LLMs.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2 space-y-3">
            {models.length === 0 ? (
              <div className="h-44 flex flex-col items-center justify-center text-muted-foreground gap-1.5 text-xs">
                <Cpu className="w-6 h-6 opacity-40" />
                <span>No models invoked in this period</span>
              </div>
            ) : (
              <div className="space-y-3">
                {models.map((m, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-semibold text-foreground truncate max-w-[130px]">
                          {m.model}
                        </span>
                        <Badge
                          variant="secondary"
                          className="text-[9px] px-1 py-0 h-3.5 uppercase font-medium"
                        >
                          {m.provider}
                        </Badge>
                      </div>
                      <span className="text-muted-foreground font-mono text-[11px]">
                        {m.percentage}% ({m.runsCount})
                      </span>
                    </div>

                    <div className="w-full bg-muted rounded-full h-2 overflow-hidden flex">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{ width: `${m.percentage}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>{formatTokens(m.totalTokens)} tokens</span>
                      <span>
                        {m.estimatedCostUsd === 0
                          ? "Free (Ollama)"
                          : `$${m.estimatedCostUsd.toFixed(4)}`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Goal Complexity Distribution */}
      <Card className="bg-card border-border shadow-xs">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                Goal Complexity & Autonomous Chaining
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Distribution of steps required by Nova to solve user requests.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">
                Avg Steps: {complexity?.avgStepsPerRun ?? 1}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                p90: {formatDuration(complexity?.p90DurationMs)}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {complexity?.buckets.map((b, idx) => (
              <div
                key={idx}
                className="p-3 rounded-lg border border-border bg-card/60 space-y-1.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">{b.range}</span>
                  <span className="text-muted-foreground font-mono">
                    {b.percentage}%
                  </span>
                </div>
                <div className="text-xl font-bold text-foreground">
                  {b.count} runs
                </div>
                <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-purple-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${b.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tool Performance & Heatmap Matrix */}
      <Card className="bg-card border-border shadow-xs">
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Wrench className="w-4 h-4 text-primary" />
                Tool Performance & Latency Matrix
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Execution frequency, success rates, and latency profiling per registered tool.
              </CardDescription>
            </div>

            <div className="relative w-full sm:w-56">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input
                placeholder="Filter tools..."
                value={toolSearch}
                onChange={(e) => setToolSearch(e.target.value)}
                className="pl-8 h-8 text-xs bg-background"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          {filteredTools.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-muted-foreground gap-2 text-xs">
              <Wrench className="w-6 h-6 opacity-40" />
              <span>No tool executions recorded in this timeframe</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="text-[11px] text-muted-foreground uppercase border-b border-border bg-muted/30">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">Tool Name</th>
                    <th className="py-2.5 px-3 font-semibold text-center">Risk</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Invocations</th>
                    <th className="py-2.5 px-3 font-semibold">Success Rate</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Avg Latency</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Min / Max</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredTools.map((t, idx) => (
                    <tr key={idx} className="hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-medium text-foreground">
                        {t.name}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <Badge
                          variant="outline"
                          className={`text-[9px] px-1.5 py-0 h-4 font-normal ${
                            t.riskLevel === "HIGH"
                              ? "border-rose-500/30 text-rose-500 bg-rose-500/10"
                              : t.riskLevel === "MEDIUM"
                              ? "border-amber-500/30 text-amber-500 bg-amber-500/10"
                              : "border-border text-muted-foreground"
                          }`}
                        >
                          {t.riskLevel}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold">
                        {t.totalCalls}
                      </td>
                      <td className="py-2.5 px-3 min-w-[140px]">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                t.successRate >= 90
                                  ? "bg-emerald-500"
                                  : t.successRate >= 70
                                  ? "bg-amber-500"
                                  : "bg-rose-500"
                              }`}
                              style={{ width: `${t.successRate}%` }}
                            />
                          </div>
                          <span className="font-mono text-[11px] text-muted-foreground w-10 text-right">
                            {t.successRate}%
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-foreground font-semibold">
                        {formatDuration(t.avgDurationMs)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-[11px] text-muted-foreground">
                        {formatDuration(t.minDurationMs)} / {formatDuration(t.maxDurationMs)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
