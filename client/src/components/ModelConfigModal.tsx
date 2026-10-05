import React, { useState, useEffect, useMemo } from "react";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Key,
  Gauge,
  Layers,
  BarChart3,
  CheckCircle2,
  XCircle,
  Loader2,
  Zap,
  Cpu,
  ShieldCheck,
  Save,
  Gift,
  ExternalLink,
  RefreshCw,
  Search,
} from "lucide-react";
import { api } from "../services/api";
import type { ModelInfo, ModelUsageMetrics } from "@nova/shared";
import { cn } from "@/lib/utils";

interface ModelConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  catalog: ModelInfo[];
  activeModel: string;
  activeProvider: string;
  onModelSwitched?: () => void;
}

export const ModelConfigModal: React.FC<ModelConfigModalProps> = ({
  open,
  onOpenChange,
  catalog,
  activeModel,
  activeProvider,
  onModelSwitched,
}) => {
  const [activeTab, setActiveTab] = useState<string>("providers");

  // Form state
  const [openrouterKey, setOpenrouterKey] = useState<string>("");
  const [ollamaUrl, setOllamaUrl] = useState<string>("http://localhost:11434");
  const [temperature, setTemperature] = useState<number>(0.1);
  const [maxTokens, setMaxTokens] = useState<number>(4096);
  const [maskedKeys, setMaskedKeys] = useState<Record<string, string>>({});
  const [configuredProviders, setConfiguredProviders] = useState<
    Record<string, boolean>
  >({});

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [refreshingCatalog, setRefreshingCatalog] = useState(false);

  // Benchmark state
  const [testProvider, setTestProvider] = useState<string>(
    activeProvider || "ollama",
  );
  const [testModel, setTestModel] = useState<string>(
    activeModel || "qwen2.5:7b",
  );
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    latencyMs: number;
    error?: string;
    model: string;
  } | null>(null);

  // Metrics state
  const [metrics, setMetrics] = useState<ModelUsageMetrics[]>([]);
  const [metricsLoading, setMetricsLoading] = useState(false);

  // Catalog search & filter state
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogFilter, setCatalogFilter] = useState<"all" | "free" | "local" | "paid">("all");

  useEffect(() => {
    if (open) {
      loadCurrentConfig();
      loadMetrics();
      setTestProvider(activeProvider || "ollama");
      setTestModel(activeModel || "qwen2.5:7b");
    }
  }, [open, activeProvider, activeModel]);

  const loadCurrentConfig = async () => {
    try {
      const res = await api.listModels();
      if (res?.settings) {
        setOllamaUrl(
          res.settings.customBaseUrls?.ollama || "http://localhost:11434",
        );
        setTemperature(res.settings.temperature ?? 0.1);
        setMaxTokens(res.settings.maxTokens ?? 4096);
        setMaskedKeys(res.settings.maskedKeys || {});
        setConfiguredProviders(res.settings.configuredProviders || {});
      }
    } catch (err) {
      console.error("Failed loading model settings:", err);
    }
  };

  const loadMetrics = async () => {
    setMetricsLoading(true);
    try {
      const res = await api.getModelMetrics();
      if (res?.metrics) {
        setMetrics(res.metrics);
      }
    } catch (err) {
      console.error("Failed loading model metrics:", err);
    } finally {
      setMetricsLoading(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);

    try {
      const apiKeys: Record<string, string> = {};
      if (openrouterKey.trim()) apiKeys.openrouter = openrouterKey.trim();

      const customBaseUrls: Record<string, string> = {};
      if (ollamaUrl.trim()) customBaseUrls.ollama = ollamaUrl.trim();

      const res = await api.updateModelConfig({
        apiKeys: Object.keys(apiKeys).length > 0 ? apiKeys : undefined,
        customBaseUrls:
          Object.keys(customBaseUrls).length > 0 ? customBaseUrls : undefined,
        temperature,
        maxTokens,
      });

      if (res?.success) {
        setSaveSuccess(true);
        setOpenrouterKey("");
        await loadCurrentConfig();
        onModelSwitched?.();
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error("Failed updating model settings:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleRefreshCatalog = async () => {
    setRefreshingCatalog(true);
    try {
      await api.refreshModels();
      onModelSwitched?.();
    } catch (err) {
      console.error("Failed refreshing models:", err);
    } finally {
      setRefreshingCatalog(false);
    }
  };

  const handleRunPingTest = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const res = await api.testModelConnection({
        provider: testProvider,
        model: testModel,
        baseUrl: testProvider === "ollama" ? ollamaUrl : undefined,
      });
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        success: false,
        latencyMs: 0,
        error: err.message || "Network request failed",
        model: testModel,
      });
    } finally {
      setTesting(false);
    }
  };

  const getProviderIcon = (provider: string, isFree?: boolean) => {
    if (provider === "ollama") {
      return <Cpu className="w-4 h-4 text-emerald-500" />;
    }
    if (isFree) {
      return <Gift className="w-4 h-4 text-amber-500" />;
    }
    return <Zap className="w-4 h-4 text-sky-500" />;
  };

  const totalRunsAll = metrics.reduce((acc, m) => acc + m.totalRuns, 0);
  const totalTokensAll = metrics.reduce((acc, m) => acc + m.totalTokens, 0);
  const totalCostAll = metrics.reduce((acc, m) => acc + m.estimatedCostUsd, 0);

  const filteredCatalog = useMemo(() => {
    return catalog.filter((m) => {
      if (catalogFilter === "free" && !m.isFree) return false;
      if (catalogFilter === "local" && !m.isLocal) return false;
      if (catalogFilter === "paid" && (m.isFree || m.isLocal)) return false;

      if (catalogSearch.trim()) {
        const query = catalogSearch.toLowerCase();
        return (
          m.name.toLowerCase().includes(query) ||
          m.id.toLowerCase().includes(query) ||
          m.providerName.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [catalog, catalogFilter, catalogSearch]);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      className="max-w-2xl max-h-[85vh] flex flex-col p-6 overflow-hidden"
    >
      <DialogHeader className="shrink-0">
        <DialogTitle onClose={() => onOpenChange(false)}>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-primary/10 text-primary">
              <Cpu className="w-4 h-4" />
            </div>
            <span>AI Model Settings & OpenRouter Catalog</span>
          </div>
        </DialogTitle>
      </DialogHeader>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="mt-4 flex-1 flex flex-col min-h-0 overflow-hidden"
      >
        <TabsList className="grid grid-cols-4 w-full h-9 shrink-0">
          <TabsTrigger
            value="providers"
            className="flex items-center gap-1.5 text-xs"
          >
            <Key className="w-3.5 h-3.5" />
            <span>Providers</span>
          </TabsTrigger>
          <TabsTrigger
            value="benchmark"
            className="flex items-center gap-1.5 text-xs"
          >
            <Gauge className="w-3.5 h-3.5" />
            <span>Ping Test</span>
          </TabsTrigger>
          <TabsTrigger
            value="matrix"
            className="flex items-center gap-1.5 text-xs"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Catalog ({catalog.length})</span>
          </TabsTrigger>
          <TabsTrigger
            value="metrics"
            className="flex items-center gap-1.5 text-xs"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Usage & Cost</span>
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto mt-4 pr-1">
          {/* TAB 1: Providers & API Keys */}
          <TabsContent value="providers" className="mt-0 space-y-4">
            <form onSubmit={handleSaveConfig} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 1. Ollama (Local) */}
                <div className="space-y-2 p-3.5 rounded-lg border border-border bg-card/60">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                      <Cpu className="w-4 h-4 text-emerald-500" />
                      <span>Ollama (Local Models)</span>
                    </label>
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                    >
                      Offline / Free
                    </Badge>
                  </div>
                  <Input
                    value={ollamaUrl}
                    onChange={(e) => setOllamaUrl(e.target.value)}
                    placeholder="http://localhost:11434"
                    className="h-8 text-xs font-mono"
                  />
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Local daemon for offline models like Qwen 2.5, Llama 3.2, and DeepSeek R1 without cloud dependencies.
                  </p>
                </div>

                {/* 2. OpenRouter (Cloud) */}
                <div className="space-y-2 p-3.5 rounded-lg border border-border bg-card/60">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                      <Zap className="w-4 h-4 text-sky-500" />
                      <span>OpenRouter API Key</span>
                    </label>
                    {configuredProviders.openrouter ? (
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                      >
                        Configured
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-[10px] text-amber-600 border-amber-500/30 bg-amber-500/10"
                      >
                        Not Set
                      </Badge>
                    )}
                  </div>
                  <Input
                    type="password"
                    value={openrouterKey}
                    onChange={(e) => setOpenrouterKey(e.target.value)}
                    placeholder={maskedKeys.openrouter || "sk-or-v1-..."}
                    className="h-8 text-xs font-mono"
                  />
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>Access 300+ models. Free models require no credits.</span>
                    <a
                      href="https://openrouter.ai/keys"
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline flex items-center gap-0.5 font-medium shrink-0"
                    >
                      <span>Get Key</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                </div>
              </div>

              {/* Hyperparameters */}
              <div className="grid grid-cols-2 gap-3 p-3 rounded-lg border border-border bg-muted/30">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Default Temperature
                  </label>
                  <Input
                    type="number"
                    step="0.05"
                    min="0"
                    max="1"
                    value={temperature}
                    onChange={(e) =>
                      setTemperature(parseFloat(e.target.value) || 0.1)
                    }
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Max Output Tokens
                  </label>
                  <Input
                    type="number"
                    step="256"
                    min="256"
                    max="16384"
                    value={maxTokens}
                    onChange={(e) =>
                      setMaxTokens(parseInt(e.target.value) || 4096)
                    }
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs text-muted-foreground">
                    Your OpenRouter key is securely stored in your local database
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {saveSuccess && (
                    <span className="text-xs font-medium text-emerald-600 flex items-center gap-1 animate-in fade-in-0">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Saved!
                    </span>
                  )}
                  <Button
                    type="submit"
                    size="sm"
                    disabled={saving}
                    className="h-8 gap-1.5 text-xs"
                  >
                    {saving ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    <span>Save Settings</span>
                  </Button>
                </div>
              </div>
            </form>
          </TabsContent>

          {/* TAB 2: Latency & Benchmark Testing */}
          <TabsContent value="benchmark" className="mt-0 space-y-4">
            <div className="p-4 rounded-lg border border-border bg-card space-y-4">
              <div className="space-y-1">
                <h4 className="text-xs font-semibold text-foreground">
                  Test Provider Latency & Connectivity
                </h4>
                <p className="text-xs text-muted-foreground">
                  Send a lightweight diagnostic ping to verify whether Ollama or OpenRouter is reachable.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Provider
                  </label>
                  <select
                    value={testProvider}
                    onChange={(e) => {
                      const p = e.target.value;
                      setTestProvider(p);
                      const first = catalog.find((m) => m.provider === p);
                      if (first) setTestModel(first.id);
                    }}
                    className="w-full h-8 text-xs px-2.5 rounded-md border border-input bg-background text-foreground"
                  >
                    <option value="ollama">Ollama (Local)</option>
                    <option value="openrouter">OpenRouter (Cloud)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Model
                  </label>
                  <select
                    value={testModel}
                    onChange={(e) => setTestModel(e.target.value)}
                    className="w-full h-8 text-xs px-2.5 rounded-md border border-input bg-background text-foreground font-mono"
                  >
                    {catalog
                      .filter((m) => m.provider === testProvider)
                      .slice(0, 50)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.id})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <Button
                type="button"
                onClick={handleRunPingTest}
                disabled={testing}
                className="w-full h-8 gap-2 text-xs"
              >
                {testing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Testing Connection...</span>
                  </>
                ) : (
                  <>
                    <Gauge className="w-3.5 h-3.5" />
                    <span>Run Ping Diagnostic</span>
                  </>
                )}
              </Button>

              {testResult && (
                <div
                  className={`p-3 rounded-lg border text-xs space-y-1.5 animate-in fade-in-0 duration-150 ${
                    testResult.success
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-200"
                      : "bg-rose-500/10 border-rose-500/30 text-rose-950 dark:text-rose-200"
                  }`}
                >
                  <div className="flex items-center justify-between font-semibold">
                    <div className="flex items-center gap-1.5">
                      {testResult.success ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-500" />
                      )}
                      <span>
                        {testResult.success
                          ? "Connection Successful"
                          : "Connection Failed"}
                      </span>
                    </div>
                    {testResult.success && (
                      <span className="font-mono text-emerald-600 dark:text-emerald-400">
                        ⚡ {testResult.latencyMs} ms
                      </span>
                    )}
                  </div>
                  {testResult.error && (
                    <p className="text-xs opacity-90">{testResult.error}</p>
                  )}
                </div>
              )}
            </div>
          </TabsContent>

          {/* TAB 3: Model Capability Catalog */}
          <TabsContent value="matrix" className="mt-0 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  placeholder="Filter models..."
                  className="h-8 pl-8 text-xs"
                />
              </div>

              <div className="flex items-center gap-1">
                {(["all", "free", "local", "paid"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setCatalogFilter(tab)}
                    className={cn(
                      "px-2 py-1 rounded text-[10px] font-medium capitalize transition-colors cursor-pointer",
                      catalogFilter === tab
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "bg-secondary text-secondary-foreground hover:bg-muted",
                    )}
                  >
                    {tab === "free" ? "Free 🎁" : tab}
                  </button>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRefreshCatalog}
                  disabled={refreshingCatalog}
                  className="h-8 px-2 gap-1 text-xs shrink-0"
                  title="Force re-fetch models from OpenRouter"
                >
                  <RefreshCw
                    className={cn("w-3.5 h-3.5", refreshingCatalog && "animate-spin")}
                  />
                  <span>Refresh</span>
                </Button>
              </div>
            </div>

            <div className="border border-border rounded-lg overflow-hidden max-h-[340px] overflow-y-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted text-muted-foreground uppercase text-[10px] font-semibold tracking-wider sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2">Model</th>
                    <th className="px-3 py-2">Provider</th>
                    <th className="px-3 py-2">Context</th>
                    <th className="px-3 py-2">Tools</th>
                    <th className="px-3 py-2">Cost / 1k</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredCatalog.map((m) => {
                    const isActive =
                      m.id === activeModel && m.provider === activeProvider;
                    return (
                      <tr
                        key={`${m.provider}-${m.id}`}
                        className={
                          isActive
                            ? "bg-primary/5 font-medium"
                            : "hover:bg-muted/40"
                        }
                      >
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            {getProviderIcon(m.provider, m.isFree)}
                            <span className="text-foreground">{m.name}</span>
                            {isActive && (
                              <Badge
                                variant="outline"
                                className="text-[9px] px-1 py-0 bg-primary/10 text-primary border-primary/30"
                              >
                                Active
                              </Badge>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground block font-mono">
                            {m.id}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {m.isLocal ? (
                            <Badge
                              variant="outline"
                              className="text-[9px] px-1.5 py-0 bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                            >
                              Local
                            </Badge>
                          ) : m.isFree ? (
                            <Badge
                              variant="outline"
                              className="text-[9px] px-1.5 py-0 bg-amber-500/10 text-amber-600 border-amber-500/30"
                            >
                              OpenRouter Free
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-[9px] px-1.5 py-0 text-muted-foreground"
                            >
                              OpenRouter
                            </Badge>
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono text-muted-foreground">
                          {Math.round(m.contextWindow / 1024)}k
                        </td>
                        <td className="px-3 py-2">
                          {m.supportsTools ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <span className="text-muted-foreground text-[10px]">
                              No
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground font-mono">
                          {m.isFree || m.costPer1kInput === 0 ? (
                            <span className="text-amber-600 dark:text-amber-400 font-semibold">
                              Free 🎁
                            </span>
                          ) : (
                            <span>${m.costPer1kInput?.toFixed(5)}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* TAB 4: Usage & Cost Metrics */}
          <TabsContent value="metrics" className="mt-0 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <Card>
                <CardContent className="p-3 text-center">
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase">
                    Total Runs
                  </span>
                  <p className="text-lg font-bold text-foreground mt-0.5">
                    {totalRunsAll}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase">
                    Total Tokens
                  </span>
                  <p className="text-lg font-bold text-foreground mt-0.5">
                    {totalTokensAll.toLocaleString()}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase">
                    Est. Cost (USD)
                  </span>
                  <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    ${totalCostAll.toFixed(4)}
                  </p>
                </CardContent>
              </Card>
            </div>

            {metricsLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : metrics.length === 0 ? (
              <div className="text-center p-6 border border-dashed border-border rounded-lg text-xs text-muted-foreground">
                No recorded execution runs with token metrics yet. Run a prompt
                to generate usage data!
              </div>
            ) : (
              <div className="border border-border rounded-lg overflow-hidden max-h-[220px] overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted text-muted-foreground uppercase text-[10px] font-semibold sticky top-0">
                    <tr>
                      <th className="px-3 py-2">Model</th>
                      <th className="px-3 py-2">Runs</th>
                      <th className="px-3 py-2">Tokens</th>
                      <th className="px-3 py-2">Avg Latency</th>
                      <th className="px-3 py-2">Est. Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {metrics.map((row) => (
                      <tr
                        key={`${row.provider}-${row.model}`}
                        className="hover:bg-muted/40"
                      >
                        <td className="px-3 py-2 font-medium">
                          <span className="text-foreground">{row.model}</span>
                          <span className="text-[10px] text-muted-foreground block capitalize">
                            {row.provider}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {row.totalRuns}
                        </td>
                        <td className="px-3 py-2 font-mono text-muted-foreground">
                          {row.totalTokens.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 font-mono text-muted-foreground">
                          {row.avgLatencyMs ? `${row.avgLatencyMs} ms` : "-"}
                        </td>
                        <td className="px-3 py-2 font-mono text-emerald-600 font-semibold">
                          ${row.estimatedCostUsd.toFixed(4)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </div>
      </Tabs>
    </Dialog>
  );
};
