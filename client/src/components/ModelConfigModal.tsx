import React, { useState, useEffect } from "react";
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
  Brain,
  Sparkles,
  ShieldCheck,
  Save,
} from "lucide-react";
import { api } from "../services/api";
import type { ModelInfo, ModelUsageMetrics } from "@nova/shared";

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
  const [openaiKey, setOpenaiKey] = useState<string>("");
  const [anthropicKey, setAnthropicKey] = useState<string>("");
  const [geminiKey, setGeminiKey] = useState<string>("");
  const [groqKey, setGroqKey] = useState<string>("");
  const [ollamaUrl, setOllamaUrl] = useState<string>("http://localhost:11434");
  const [temperature, setTemperature] = useState<number>(0.1);
  const [maxTokens, setMaxTokens] = useState<number>(4096);
  const [maskedKeys, setMaskedKeys] = useState<Record<string, string>>({});
  const [configuredProviders, setConfiguredProviders] = useState<
    Record<string, boolean>
  >({});

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

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
      if (openaiKey.trim()) apiKeys.openai = openaiKey.trim();
      if (anthropicKey.trim()) apiKeys.anthropic = anthropicKey.trim();
      if (geminiKey.trim()) apiKeys.gemini = geminiKey.trim();
      if (groqKey.trim()) apiKeys.groq = groqKey.trim();

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
        setOpenaiKey("");
        setAnthropicKey("");
        setGeminiKey("");
        setGroqKey("");
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

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case "ollama":
        return <Cpu className="w-4 h-4 text-emerald-500" />;
      case "openai":
        return <Zap className="w-4 h-4 text-sky-500" />;
      case "anthropic":
        return <Brain className="w-4 h-4 text-amber-500" />;
      case "gemini":
        return <Sparkles className="w-4 h-4 text-purple-500" />;
      case "groq":
        return <Zap className="w-4 h-4 text-orange-500" />;
      default:
        return <Cpu className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const totalRunsAll = metrics.reduce((acc, m) => acc + m.totalRuns, 0);
  const totalTokensAll = metrics.reduce((acc, m) => acc + m.totalTokens, 0);
  const totalCostAll = metrics.reduce((acc, m) => acc + m.estimatedCostUsd, 0);

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
            <span>Multi-Model Settings & Benchmarks</span>
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
            <span>API Keys</span>
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
            <span>Catalog</span>
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
          {/* TAB 1: API Keys & Configuration */}
          <TabsContent value="providers" className="mt-0 space-y-4">
            <form onSubmit={handleSaveConfig} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Ollama URL */}
                <div className="space-y-1.5 p-3 rounded-lg border border-border bg-card/50">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Ollama Daemon URL</span>
                    </label>
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                    >
                      Local
                    </Badge>
                  </div>
                  <Input
                    value={ollamaUrl}
                    onChange={(e) => setOllamaUrl(e.target.value)}
                    placeholder="http://localhost:11434"
                    className="h-8 text-xs font-mono"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Default endpoint for local offline inference
                  </p>
                </div>

                {/* Groq API Key */}
                <div className="space-y-1.5 p-3 rounded-lg border border-border bg-card/50">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-orange-500" />
                      <span>Groq LPU Key</span>
                    </label>
                    {configuredProviders.groq ? (
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                      >
                        Configured
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-[10px] text-muted-foreground"
                      >
                        Not Set
                      </Badge>
                    )}
                  </div>
                  <Input
                    type="password"
                    value={groqKey}
                    onChange={(e) => setGroqKey(e.target.value)}
                    placeholder={maskedKeys.groq || "gsk_..."}
                    className="h-8 text-xs font-mono"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Ultra-fast sub-second LPU inference
                  </p>
                </div>

                {/* OpenAI Key */}
                <div className="space-y-1.5 p-3 rounded-lg border border-border bg-card/50">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-sky-500" />
                      <span>OpenAI API Key</span>
                    </label>
                    {configuredProviders.openai ? (
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                      >
                        Configured
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-[10px] text-muted-foreground"
                      >
                        Not Set
                      </Badge>
                    )}
                  </div>
                  <Input
                    type="password"
                    value={openaiKey}
                    onChange={(e) => setOpenaiKey(e.target.value)}
                    placeholder={maskedKeys.openai || "sk-..."}
                    className="h-8 text-xs font-mono"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    For GPT-4o, GPT-4o Mini, and o3-mini
                  </p>
                </div>

                {/* Anthropic Key */}
                <div className="space-y-1.5 p-3 rounded-lg border border-border bg-card/50">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold flex items-center gap-1.5">
                      <Brain className="w-3.5 h-3.5 text-amber-500" />
                      <span>Anthropic API Key</span>
                    </label>
                    {configuredProviders.anthropic ? (
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                      >
                        Configured
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-[10px] text-muted-foreground"
                      >
                        Not Set
                      </Badge>
                    )}
                  </div>
                  <Input
                    type="password"
                    value={anthropicKey}
                    onChange={(e) => setAnthropicKey(e.target.value)}
                    placeholder={maskedKeys.anthropic || "sk-ant-..."}
                    className="h-8 text-xs font-mono"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    For Claude 3.5 Sonnet & Haiku
                  </p>
                </div>

                {/* Gemini Key */}
                <div className="space-y-1.5 p-3 rounded-lg border border-border bg-card/50 sm:col-span-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                      <span>Google Gemini Key</span>
                    </label>
                    {configuredProviders.gemini ? (
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                      >
                        Configured
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-[10px] text-muted-foreground"
                      >
                        Not Set
                      </Badge>
                    )}
                  </div>
                  <Input
                    type="password"
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                    placeholder={maskedKeys.gemini || "AIzaSy..."}
                    className="h-8 text-xs font-mono"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    For Gemini 1.5 Flash, 1.5 Pro & 2.0 Flash
                  </p>
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
                    API keys are securely stored in your database
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
                  Send a lightweight diagnostic ping to verify whether the model
                  is accessible and calculate round-trip latency.
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
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="gemini">Google Gemini</option>
                    <option value="groq">Groq (LPU)</option>
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
          <TabsContent value="matrix" className="mt-0 space-y-2">
            <div className="border border-border rounded-lg overflow-hidden max-h-[360px] overflow-y-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted text-muted-foreground uppercase text-[10px] font-semibold tracking-wider sticky top-0">
                  <tr>
                    <th className="px-3 py-2">Model</th>
                    <th className="px-3 py-2">Provider</th>
                    <th className="px-3 py-2">Context</th>
                    <th className="px-3 py-2">Tools</th>
                    <th className="px-3 py-2">Cost / 1k</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {catalog.map((m) => {
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
                            {getProviderIcon(m.provider)}
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
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-[9px] px-1.5 py-0 text-muted-foreground"
                            >
                              Cloud
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
                          {m.costPer1kInput === 0 ? (
                            <span className="text-emerald-600 font-medium">
                              Free
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
