import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { api } from '../services/api';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

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

  useEffect(() => { loadRuns(); }, []);

  const toggleExpand = (runId: string) => {
    setExpandedRunId(expandedRunId === runId ? null : runId);
  };

  const getStatusVariant = (status: string) => {
    const map: Record<string, any> = {
      completed: 'success',
      failed: 'destructive',
      waiting_for_approval: 'warning',
      running: 'default',
    };
    return map[status] || 'secondary';
  };

  const stats = {
    total: runs.length,
    completed: runs.filter((r) => r.status === 'completed').length,
    failed: runs.filter((r) => r.status === 'failed').length,
    avgDuration: runs.length
      ? Math.round(runs.reduce((acc, r) => acc + (r.durationMs || 0), 0) / runs.length)
      : 0,
  };

  return (
    <div className="space-y-6 fade-in-up">
      {/* Header */}
      <div className="flex items-start gap-2">
        <div className="p-1.5 rounded-lg bg-purple-500/15 text-purple-400 mt-0.5">
          <History className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-xl font-black tracking-tight text-white font-['Outfit',sans-serif]">
            Agent Execution History
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Full lifecycle persistence in MongoDB Atlas. Inspect thoughts, steps, and tool invocations.
          </p>
        </div>
      </div>

      {/* Stats */}
      {!loading && runs.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total Runs', value: stats.total, icon: TrendingUp, color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/20', hover: 'stat-card-indigo' },
            { label: 'Completed', value: stats.completed, icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', hover: 'stat-card-emerald' },
            { label: 'Failed', value: stats.failed, icon: XCircle, color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20', hover: 'stat-card-amber' },
            { label: 'Avg Duration', value: `${stats.avgDuration}ms`, icon: Timer, color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/20', hover: 'stat-card-cyan' },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className={cn('flex items-center gap-3 p-4 rounded-2xl border transition-all duration-200', stat.bg, stat.hover)}
              >
                <div className={cn('p-2 rounded-xl bg-white/5', stat.color)}>
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-lg font-black text-white font-['Outfit',sans-serif]">{stat.value}</div>
                  <div className="text-[11px] text-slate-400 font-medium">{stat.label}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-4">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
          </div>
          <p className="text-sm font-medium">Loading execution logs...</p>
        </div>
      ) : runs.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center border-dashed bg-transparent">
          <div className="w-14 h-14 rounded-2xl bg-slate-800/50 border border-white/5 flex items-center justify-center mb-4">
            <History className="w-7 h-7 text-slate-600" />
          </div>
          <h3 className="font-bold text-slate-300 mb-1.5">No execution history yet</h3>
          <p className="text-xs text-slate-500 max-w-xs">
            Agent runs, tool call timelines, and audit logs will appear here once you start a conversation in Chat.
          </p>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {runs.map((r, idx) => {
            const isExpanded = expandedRunId === r.runId;
            return (
              <div
                key={r.id || r.runId}
                className="rounded-2xl border border-white/[0.06] bg-slate-900/50 hover:border-indigo-500/20 transition-all duration-200 overflow-hidden fade-in-up"
                style={{ animationDelay: `${idx * 0.04}s` }}
              >
                {/* Run Header */}
                <div
                  className="flex items-center gap-4 px-5 py-4 cursor-pointer select-none hover:bg-white/[0.02] transition-colors"
                  onClick={() => toggleExpand(r.runId)}
                >
                  <div className={cn(
                    "p-2 rounded-xl shrink-0",
                    isExpanded ? "bg-indigo-500/20 text-indigo-400" : "bg-slate-800 text-slate-500"
                  )}>
                    {isExpanded
                      ? <ChevronDown className="w-4 h-4" />
                      : <ChevronRight className="w-4 h-4" />
                    }
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-100 truncate mb-1.5">
                      {r.goal}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500 flex-wrap">
                      <span className="font-mono">{r.runId?.substring(0, 10)}…</span>
                      <span>·</span>
                      <span>{new Date(r.createdAt || r.startedAt).toLocaleString()}</span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {r.durationMs || 0}ms
                      </span>
                      <span className="flex items-center gap-1">
                        <Wrench className="w-3 h-3" /> {r.toolCallsCount || 0} tools
                      </span>
                    </div>
                  </div>

                  <Badge variant={getStatusVariant(r.status)} className="shrink-0">{r.status}</Badge>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-5 pb-5 pt-1 space-y-4 border-t border-white/[0.05] bg-black/20">
                    {r.finalResponse && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          <Bot className="w-3 h-3 text-indigo-400" /> Final Response
                        </div>
                        <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
                          {r.finalResponse}
                        </div>
                      </div>
                    )}

                    {r.steps?.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          <Terminal className="w-3 h-3 text-cyan-400" /> Step Trace ({r.steps.length})
                        </div>
                        <div className="space-y-1.5">
                          {r.steps.map((step: any, i: number) => (
                            <div
                              key={i}
                              className={cn(
                                "p-3 rounded-xl border text-xs",
                                step.type === 'tool'
                                  ? "bg-indigo-950/30 border-indigo-500/15"
                                  : "bg-cyan-950/20 border-cyan-500/10"
                              )}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2 font-medium text-slate-200">
                                  {step.type === 'tool'
                                    ? <Wrench className="w-3 h-3 text-indigo-400" />
                                    : <Sparkles className="w-3 h-3 text-cyan-400" />
                                  }
                                  <span>{step.title}</span>
                                </div>
                                <Badge variant={getStatusVariant(step.status)}>{step.status}</Badge>
                              </div>

                              {step.toolCall && (
                                <div className="space-y-1.5 font-mono text-[10px]">
                                  <pre className="p-2 rounded bg-black/50 text-indigo-300 overflow-x-auto whitespace-pre-wrap max-h-[100px]">
                                    {JSON.stringify(step.toolCall.arguments, null, 2)}
                                  </pre>
                                  {step.toolCall.result !== undefined && (
                                    <pre className="p-2 rounded bg-black/50 text-emerald-300 overflow-x-auto whitespace-pre-wrap max-h-[100px]">
                                      {JSON.stringify(step.toolCall.result, null, 2)}
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
