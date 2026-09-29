import React, { useState, useEffect } from 'react';
import {
  Shield,
  Cpu,
  Database,
  Wrench,
  RefreshCw,
  CheckCircle2,
  Loader2,
  Lock,
  Unlock,
  Activity,
  Server,
  Zap,
} from 'lucide-react';
import { api } from '../services/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export const SettingsView: React.FC = () => {
  const [health, setHealth] = useState<any>(null);
  const [tools, setTools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [hRes, tRes] = await Promise.all([api.getHealth(), api.listTools()]);
      setHealth(hRes);
      setTools(tRes.tools || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const [hRes, tRes] = await Promise.all([api.getHealth(), api.listTools()]);
      setHealth(hRes);
      setTools(tRes.tools || []);
    } catch (err) {
      console.error(err);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const getRiskVariant = (risk: string) => {
    const map: Record<string, any> = { high: 'destructive', medium: 'warning', low: 'success', read: 'cyan', critical: 'destructive' };
    return map[risk?.toLowerCase()] || 'secondary';
  };

  const getRiskIcon = (requiresApproval: boolean) =>
    requiresApproval ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400 fade-in-up">
        <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-4">
          <Loader2 className="w-7 h-7 animate-spin text-indigo-400" />
        </div>
        <p className="text-sm font-medium">Loading system status & tool registry...</p>
      </div>
    );
  }

  const toolsByRisk = {
    high: tools.filter((t) => ['HIGH', 'CRITICAL'].includes(t.riskLevel?.toUpperCase())),
    medium: tools.filter((t) => t.riskLevel?.toUpperCase() === 'MEDIUM'),
    low: tools.filter((t) => ['LOW', 'READ'].includes(t.riskLevel?.toUpperCase())),
  };

  return (
    <div className="space-y-6 fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-lg bg-amber-500/15 text-amber-400">
              <Shield className="w-4 h-4" />
            </div>
            <h2 className="text-xl font-black tracking-tight text-white font-['Outfit',sans-serif]">
              System & Security Policy
            </h2>
          </div>
          <p className="text-sm text-slate-400">
            Active LLM configuration, MongoDB Atlas connection status, and HITL authorization policy.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing} className="shrink-0">
          <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", refreshing && "animate-spin")} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {/* System Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* LLM Card */}
        <div className="group rounded-2xl border border-white/[0.07] bg-slate-900/50 p-5 hover:border-indigo-500/30 hover:bg-slate-900/70 transition-all duration-200 stat-card-indigo">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-white font-['Outfit',sans-serif]">LLM Inference</div>
              <div className="text-[11px] text-slate-500">Provider & Model</div>
            </div>
          </div>

          <div className="space-y-2 text-[12px]">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Provider</span>
              <span className="font-bold text-white bg-indigo-500/10 px-2 py-0.5 rounded text-[11px] border border-indigo-500/20">
                {health?.llmProvider?.toUpperCase() || 'OLLAMA'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Model</span>
              <span className="font-mono text-indigo-300 text-[11px]">
                {health?.model || 'qwen2.5:7b'}
              </span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-white/5 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-[11px] text-emerald-400 font-semibold">Active & Ready</span>
          </div>
        </div>

        {/* MongoDB Card */}
        <div className="group rounded-2xl border border-white/[0.07] bg-slate-900/50 p-5 hover:border-cyan-500/30 hover:bg-slate-900/70 transition-all duration-200 stat-card-cyan">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-white font-['Outfit',sans-serif]">MongoDB Atlas</div>
              <div className="text-[11px] text-slate-500">Cloud Persistence</div>
            </div>
          </div>

          <div className="space-y-2 text-[12px]">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Database</span>
              <span className="font-mono text-white text-[11px]">nova</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Cluster</span>
              <span className="font-mono text-slate-300 text-[11px]">nova.u92junl</span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-white/5 flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[11px] text-emerald-400 font-semibold">Mongoose Connected</span>
          </div>
        </div>

        {/* Permission Policy Card */}
        <div className="group rounded-2xl border border-white/[0.07] bg-slate-900/50 p-5 hover:border-amber-500/30 hover:bg-slate-900/70 transition-all duration-200 stat-card-amber">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-white font-['Outfit',sans-serif]">Permission Engine</div>
              <div className="text-[11px] text-slate-500">Security Gateways</div>
            </div>
          </div>

          <div className="space-y-2 text-[12px]">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Auto-Approve</span>
              <span className="font-semibold text-emerald-400 text-[11px]">READ & LOW</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Human Approval</span>
              <span className="font-semibold text-amber-400 text-[11px]">HIGH & DESTRUCTIVE</span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-white/5 text-[11px] text-slate-500 leading-tight">
            Task deletions and browser inputs require explicit user authorization before execution.
          </div>
        </div>
      </div>

      {/* Tool Registry */}
      <div className="rounded-2xl border border-white/[0.07] bg-slate-900/50 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-purple-500/15 text-purple-400">
              <Wrench className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white font-['Outfit',sans-serif]">
                Registered Tool Registry
              </h3>
              <p className="text-[11px] text-slate-500">{tools.length} tools available to the agent</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-[11px] text-rose-300 font-medium px-2.5 py-1 bg-rose-500/10 rounded-lg border border-rose-500/20">
              <Lock className="w-3 h-3" /> {toolsByRisk.high.length} High Risk
            </span>
            <span className="flex items-center gap-1.5 text-[11px] text-emerald-300 font-medium px-2.5 py-1 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
              <Unlock className="w-3 h-3" /> {toolsByRisk.low.length} Auto
            </span>
          </div>
        </div>

        {/* Tool List */}
        {tools.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <Server className="w-8 h-8 mb-3 opacity-40" />
            <p className="text-sm">No tools registered. Ensure the backend server is running.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {tools.map((tool, idx) => (
              <div
                key={tool.name}
                className="flex items-center justify-between px-6 py-3.5 hover:bg-white/[0.02] transition-colors group"
                style={{ animationDelay: `${idx * 0.03}s` }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Tool type icon */}
                  <div className={cn(
                    "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-bold",
                    tool.requiresApproval
                      ? "bg-rose-500/10 border border-rose-500/20 text-rose-400"
                      : "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                  )}>
                    {tool.requiresApproval ? <Lock className="w-3 h-3" /> : <Zap className="w-3 h-3" />}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[12px] font-bold text-slate-100">{tool.name}</span>
                      <Badge variant={getRiskVariant(tool.riskLevel)} className="text-[9px] py-0 px-1.5">
                        {tool.riskLevel}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate max-w-md mt-0.5">
                      {tool.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-4">
                  <span className={cn(
                    "text-[10px] font-semibold flex items-center gap-1",
                    tool.requiresApproval ? "text-amber-400" : "text-emerald-400"
                  )}>
                    {getRiskIcon(tool.requiresApproval)}
                    {tool.requiresApproval ? 'Auth Required' : 'Autonomous'}
                  </span>
                  <span className="text-[10px] text-slate-600 font-mono">
                    {Object.keys(tool.parameters?.properties || {}).length}p
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer summary */}
        {tools.length > 0 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-white/5 bg-white/[0.01]">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <Activity className="w-3.5 h-3.5 text-indigo-400" />
              <span>All tools dynamically auto-registered from the tool registry</span>
            </div>
            <span className="text-[10px] font-mono text-slate-600">{tools.length} total</span>
          </div>
        )}
      </div>
    </div>
  );
};
