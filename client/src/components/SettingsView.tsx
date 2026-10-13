import React, { useState, useEffect } from "react";
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
} from "lucide-react";
import { api } from "../services/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const SettingsView: React.FC = () => {
  const [health, setHealth] = useState<any>(null);
  const [tools, setTools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [hRes, tRes] = await Promise.allSettled([
        api.getHealth(),
        api.listTools(),
      ]);
      if (hRes.status === "fulfilled") setHealth(hRes.value);
      if (tRes.status === "fulfilled") setTools(tRes.value?.tools || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const [hRes, tRes] = await Promise.allSettled([
        api.getHealth(),
        api.listTools(),
      ]);
      if (hRes.status === "fulfilled") setHealth(hRes.value);
      if (tRes.status === "fulfilled") setTools(tRes.value?.tools || []);
    } catch (err) {
      console.error(err);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getRiskVariant = (risk: string) => {
    const map: Record<string, any> = {
      high: "destructive",
      medium: "warning",
      low: "success",
      read: "cyan",
      critical: "destructive",
    };
    return map[risk?.toLowerCase()] || "secondary";
  };

  const getRiskIcon = (requiresApproval: boolean) =>
    requiresApproval ? (
      <Lock className="w-3 h-3" />
    ) : (
      <Unlock className="w-3 h-3" />
    );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mb-2" />
        <p className="text-xs">Loading system diagnostics...</p>
      </div>
    );
  }

  const toolsByRisk = {
    high: tools.filter((t) =>
      ["HIGH", "CRITICAL"].includes(t.riskLevel?.toUpperCase()),
    ),
    medium: tools.filter((t) => t.riskLevel?.toUpperCase() === "MEDIUM"),
    low: tools.filter((t) =>
      ["LOW", "READ"].includes(t.riskLevel?.toUpperCase()),
    ),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-5 h-5 text-foreground" />
            <h2 className="text-lg font-semibold text-foreground tracking-tight">
              System Diagnostics & Security Policies
            </h2>
          </div>
          <p className="text-xs text-muted-foreground">
            LLM engine status, cloud persistence health, and human-in-the-loop
            authorization policy.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
          className="shrink-0 h-9"
        >
          <RefreshCw
            className={cn("w-3.5 h-3.5 mr-1.5", refreshing && "animate-spin")}
          />
          {refreshing ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {/* System Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* LLM Card */}
        <Card className="p-4 border border-border bg-card shadow-xs">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-md bg-secondary text-secondary-foreground">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs sm:text-sm font-semibold text-foreground">
                LLM Inference
              </div>
              <div className="text-[11px] text-muted-foreground">
                Local Model Host
              </div>
            </div>
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Provider</span>
              <span className="font-semibold text-foreground uppercase">
                {health?.llmProvider || "Ollama"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Model</span>
              <span className="font-mono text-foreground text-xs">
                {health?.model || "qwen2.5:7b"}
              </span>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-border flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
              Ready
            </span>
          </div>
        </Card>

        {/* MongoDB Card */}
        <Card className="p-4 border border-border bg-card shadow-xs">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-md bg-secondary text-secondary-foreground">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs sm:text-sm font-semibold text-foreground">
                MongoDB Atlas
              </div>
              <div className="text-[11px] text-muted-foreground">
                Cloud Storage
              </div>
            </div>
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Database</span>
              <span className="font-mono text-foreground">nova</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Status</span>
              <span className="text-foreground">Connected</span>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-border flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
              Healthy
            </span>
          </div>
        </Card>

        {/* Permission Policy Card */}
        <Card className="p-4 border border-border bg-card shadow-xs">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-md bg-secondary text-secondary-foreground">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs sm:text-sm font-semibold text-foreground">
                HITL Security Policy
              </div>
              <div className="text-[11px] text-muted-foreground">
                Safety Gateways
              </div>
            </div>
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Auto-Execute</span>
              <span className="font-medium text-emerald-600 dark:text-emerald-400">
                READ & LOW
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Human Approval</span>
              <span className="font-medium text-amber-600 dark:text-amber-400">
                HIGH & CRITICAL
              </span>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-border text-[11px] text-muted-foreground leading-tight">
            High-risk tool executions pause agent flow until user authorization
            is confirmed.
          </div>
        </Card>
      </div>

      {/* Tool Registry */}
      <Card className="border border-border bg-card overflow-hidden">
        {/* Header */}
        <CardHeader className="flex flex-row items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4 text-foreground" />
            <div>
              <CardTitle className="text-sm font-semibold">
                Registered Tools
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {tools.length} active agent tools
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
              {toolsByRisk.high.length} High Risk
            </Badge>
            <Badge variant="success" className="text-[10px] px-1.5 py-0">
              {toolsByRisk.low.length} Auto
            </Badge>
          </div>
        </CardHeader>

        {/* Tool List */}
        {tools.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Server className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-xs">
              No tools registered. Ensure the backend server is running.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {tools.map((tool) => (
              <div
                key={tool.name}
                className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={cn(
                      "w-6 h-6 rounded flex items-center justify-center shrink-0 text-xs",
                      tool.requiresApproval
                        ? "bg-destructive/10 text-destructive"
                        : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                    )}
                  >
                    {tool.requiresApproval ? (
                      <Lock className="w-3 h-3" />
                    ) : (
                      <Zap className="w-3 h-3" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-foreground">
                        {tool.name}
                      </span>
                      <Badge
                        variant={getRiskVariant(tool.riskLevel)}
                        className="text-[9px] py-0 px-1"
                      >
                        {tool.riskLevel}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate max-w-md mt-0.5">
                      {tool.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <span
                    className={cn(
                      "text-xs font-medium flex items-center gap-1",
                      tool.requiresApproval
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-emerald-600 dark:text-emerald-400",
                    )}
                  >
                    {getRiskIcon(tool.requiresApproval)}
                    {tool.requiresApproval ? "Auth Required" : "Autonomous"}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">
                    {Object.keys(tool.parameters?.properties || {}).length}{" "}
                    params
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer summary */}
        {tools.length > 0 && (
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-muted/20">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Activity className="w-3.5 h-3.5" />
              <span>
                All tools dynamically auto-registered from server schema
              </span>
            </div>
            <span className="text-xs font-mono text-muted-foreground">
              {tools.length} total
            </span>
          </div>
        )}
      </Card>
    </div>
  );
};
