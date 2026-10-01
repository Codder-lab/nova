import React, { useState, useEffect } from "react";
import {
  History,
  Clock,
  Wrench,
  ChevronDown,
  ChevronRight,
  Loader2,
  Sparkles,
  Bot,
  Terminal,
  TrendingUp,
  CheckCircle,
  XCircle,
  Timer,
} from "lucide-react";
import { api } from "../services/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const RunsView: React.FC = () => {
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  const loadRuns = async () => {
    setLoading(true);
    try {
      const res = await api.listRuns();
      if (res.runs) setRuns(res.runs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRuns();
  }, []);

  const toggleExpand = (runId: string) => {
    setExpandedRunId(expandedRunId === runId ? null : runId);
  };

  const getStatusVariant = (status: string) => {
    const map: Record<string, any> = {
      completed: "success",
      failed: "destructive",
      waiting_for_approval: "warning",
      running: "default",
    };
    return map[status] || "secondary";
  };

  const stats = {
    total: runs.length,
    completed: runs.filter((r) => r.status === "completed").length,
    failed: runs.filter((r) => r.status === "failed").length,
    avgDuration: runs.length
      ? Math.round(
          runs.reduce((acc, r) => acc + (r.durationMs || 0), 0) / runs.length,
        )
      : 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <History className="w-5 h-5 text-foreground" />
        <div>
          <h2 className="text-lg font-semibold text-foreground tracking-tight">
            Execution Runs & Audit Log
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Trace execution history, token latency, tool invocations, and agent
            steps.
          </p>
        </div>
      </div>

      {/* Stats Row */}
      {!loading && runs.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total Runs", value: stats.total, icon: TrendingUp },
            { label: "Completed", value: stats.completed, icon: CheckCircle },
            { label: "Failed", value: stats.failed, icon: XCircle },
            {
              label: "Avg Duration",
              value: `${stats.avgDuration}ms`,
              icon: Timer,
            },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <Card
                key={stat.label}
                className="p-4 bg-card border-border shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    {stat.label}
                  </span>
                  <Icon className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="mt-2 text-2xl font-bold text-foreground">
                  {stat.value}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mb-2" />
          <p className="text-xs">Loading execution runs...</p>
        </div>
      ) : runs.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-14 text-center border-dashed bg-card/50">
          <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center mb-3">
            <History className="w-5 h-5 text-muted-foreground" />
          </div>
          <h3 className="text-sm font-semibold text-foreground mb-1">
            No execution history
          </h3>
          <p className="text-xs text-muted-foreground max-w-xs">
            Agent runs, tool call logs, and audit trails will appear here once
            actions are triggered in Chat.
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {runs.map((r) => {
            const isExpanded = expandedRunId === r.runId;
            return (
              <div
                key={r.id || r.runId}
                className="rounded-md border border-border bg-card hover:bg-muted/20 transition-colors overflow-hidden"
              >
                {/* Run Header */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none hover:bg-muted/40 transition-colors"
                  onClick={() => toggleExpand(r.runId)}
                >
                  <div className="p-1 rounded bg-secondary text-muted-foreground shrink-0">
                    {isExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-xs sm:text-sm font-medium text-foreground truncate mb-1">
                      {r.goal}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                      <span className="font-mono text-xs">
                        {r.runId?.substring(0, 8)}…
                      </span>
                      <span>·</span>
                      <span>
                        {new Date(r.createdAt || r.startedAt).toLocaleString()}
                      </span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {r.durationMs || 0}ms
                      </span>
                      <span className="flex items-center gap-1">
                        <Wrench className="w-3 h-3" /> {r.toolCallsCount || 0}{" "}
                        tools
                      </span>
                      {r.model && (
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-muted text-foreground border border-border">
                          {r.provider ? `${r.provider}/` : ""}
                          {r.model}
                        </span>
                      )}
                      {Boolean(r.totalTokens) && (
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {r.totalTokens} tokens
                        </span>
                      )}
                    </div>
                  </div>

                  <Badge
                    variant={getStatusVariant(r.status)}
                    className="shrink-0 text-[10px] px-1.5 py-0"
                  >
                    {r.status}
                  </Badge>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 space-y-3 border-t border-border bg-muted/20">
                    {r.finalResponse && (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                          <Bot className="w-3 h-3 text-muted-foreground" />{" "}
                          Final Response
                        </div>
                        <div className="p-3 rounded-md bg-background border border-border text-xs text-foreground whitespace-pre-wrap leading-relaxed">
                          {r.finalResponse}
                        </div>
                      </div>
                    )}

                    {r.steps?.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                          <Terminal className="w-3 h-3 text-muted-foreground" />{" "}
                          Step Trace ({r.steps.length})
                        </div>
                        <div className="space-y-1.5">
                          {r.steps.map((step: any, i: number) => (
                            <div
                              key={i}
                              className="p-2.5 rounded-md border border-border bg-background text-xs"
                            >
                              <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-2 font-medium text-foreground">
                                  {step.type === "tool" ? (
                                    <Wrench className="w-3 h-3 text-muted-foreground" />
                                  ) : (
                                    <Sparkles className="w-3 h-3 text-muted-foreground" />
                                  )}
                                  <span>{step.title}</span>
                                </div>
                                <Badge
                                  variant={getStatusVariant(step.status)}
                                  className="text-[10px] px-1.5 py-0"
                                >
                                  {step.status}
                                </Badge>
                              </div>

                              {step.toolCall && (
                                <div className="space-y-1.5 font-mono text-[10px] mt-1.5">
                                  <pre className="p-2 rounded bg-secondary text-secondary-foreground overflow-x-auto whitespace-pre-wrap max-h-28 border border-border">
                                    {JSON.stringify(
                                      step.toolCall.arguments,
                                      null,
                                      2,
                                    )}
                                  </pre>
                                  {step.toolCall.result !== undefined && (
                                    <pre className="p-2 rounded bg-secondary text-secondary-foreground overflow-x-auto whitespace-pre-wrap max-h-28 border border-border">
                                      {JSON.stringify(
                                        step.toolCall.result,
                                        null,
                                        2,
                                      )}
                                    </pre>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
