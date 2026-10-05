import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Cpu,
  Zap,
  ChevronDown,
  Check,
  Settings,
  Loader2,
  Search,
  RefreshCw,
  Gift,
  ExternalLink,
  Key,
} from "lucide-react";
import { api } from "../services/api";
import { ModelConfigModal } from "./ModelConfigModal";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ModelInfo } from "@nova/shared";
import { cn } from "@/lib/utils";

interface ModelPickerProps {
  compact?: boolean;
  className?: string;
  onModelChanged?: (provider: string, model: string) => void;
}

export const ModelPicker: React.FC<ModelPickerProps> = ({
  compact = false,
  className,
  onModelChanged,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [catalog, setCatalog] = useState<ModelInfo[]>([]);
  const [activeProvider, setActiveProvider] = useState<string>("ollama");
  const [activeModel, setActiveModel] = useState<string>("qwen2.5:7b");
  const [isOpenRouterConfigured, setIsOpenRouterConfigured] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [switching, setSwitching] = useState(false);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "free" | "local" | "paid">("all");

  // Prompt for API key when paid model is clicked without key
  const [keyPromptModel, setKeyPromptModel] = useState<ModelInfo | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [savingKey, setSavingKey] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const fetchModels = async () => {
    setLoading(true);
    try {
      const res = await api.listModels();
      if (res?.catalog) setCatalog(res.catalog);
      if (res?.active) {
        setActiveProvider(res.active.provider);
        setActiveModel(res.active.model);
      }
      setIsOpenRouterConfigured(Boolean(res?.isOpenRouterConfigured));
    } catch (err) {
      console.error("Failed fetching model catalog:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleManualRefresh = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setRefreshing(true);
    try {
      await api.refreshModels();
      await fetchModels();
    } catch (err) {
      console.error("Failed refreshing models from OpenRouter:", err);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchModels();
  }, []);

  // Auto-focus search input on dropdown open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setSearchQuery("");
      setFilterType("all");
    }
  }, [isOpen]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectModel = async (model: ModelInfo) => {
    // If selecting a paid OpenRouter model and key is not set, prompt for key
    if (model.provider === "openrouter" && !model.isFree && !isOpenRouterConfigured) {
      setKeyPromptModel(model);
      setIsOpen(false);
      return;
    }

    if (model.provider === activeProvider && model.id === activeModel) {
      setIsOpen(false);
      return;
    }

    setSwitching(true);
    try {
      const res = await api.setActiveModel(model.provider, model.id);
      if (res?.success) {
        setActiveProvider(model.provider);
        setActiveModel(model.id);
        onModelChanged?.(model.provider, model.id);
      }
    } catch (err) {
      console.error("Failed switching model:", err);
    } finally {
      setSwitching(false);
      setIsOpen(false);
    }
  };

  const handleSaveApiKeyAndSelect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKeyInput.trim() || !keyPromptModel) return;

    setSavingKey(true);
    try {
      await api.updateModelConfig({
        apiKeys: { openrouter: apiKeyInput.trim() },
      });
      setIsOpenRouterConfigured(true);

      // Now activate the chosen model
      const res = await api.setActiveModel(keyPromptModel.provider, keyPromptModel.id);
      if (res?.success) {
        setActiveProvider(keyPromptModel.provider);
        setActiveModel(keyPromptModel.id);
        onModelChanged?.(keyPromptModel.provider, keyPromptModel.id);
      }

      setKeyPromptModel(null);
      setApiKeyInput("");
      await fetchModels();
    } catch (err) {
      console.error("Failed saving API key:", err);
    } finally {
      setSavingKey(false);
    }
  };

  const getProviderIcon = (provider: string, isFree?: boolean) => {
    if (provider === "ollama") {
      return <Cpu className="w-3.5 h-3.5 text-emerald-500" />;
    }
    if (isFree) {
      return <Gift className="w-3.5 h-3.5 text-amber-500" />;
    }
    return <Zap className="w-3.5 h-3.5 text-sky-500" />;
  };

  const currentModelInfo = catalog.find(
    (m) => m.provider === activeProvider && m.id === activeModel,
  );

  const filteredCatalog = useMemo(() => {
    return catalog.filter((m) => {
      // Filter by type
      if (filterType === "free" && !m.isFree) return false;
      if (filterType === "local" && !m.isLocal) return false;
      if (filterType === "paid" && (m.isFree || m.isLocal)) return false;

      // Filter by search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = m.name.toLowerCase().includes(query);
        const matchesId = m.id.toLowerCase().includes(query);
        const matchesDesc = m.description.toLowerCase().includes(query);
        const matchesProvider = m.providerName.toLowerCase().includes(query);
        return matchesName || matchesId || matchesDesc || matchesProvider;
      }

      return true;
    });
  }, [catalog, filterType, searchQuery]);

  return (
    <>
      <div
        className={cn("relative inline-block text-left", className)}
        ref={dropdownRef}
      >
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-border bg-secondary/80 hover:bg-secondary text-secondary-foreground text-xs font-medium transition-colors cursor-pointer select-none",
            isOpen && "ring-1 ring-ring border-transparent",
          )}
          title="Switch Active AI Model"
        >
          {switching || loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
          ) : (
            getProviderIcon(activeProvider, currentModelInfo?.isFree)
          )}

          <div className="flex items-center gap-1.5">
            <span className="capitalize text-foreground font-semibold">
              {currentModelInfo ? currentModelInfo.name : activeModel}
            </span>
            {currentModelInfo?.isFree && (
              <Badge
                variant="outline"
                className="text-[8px] px-1 py-0 bg-amber-500/10 text-amber-600 border-amber-500/30"
              >
                Free
              </Badge>
            )}
            {!compact && (
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-mono">
                ({activeProvider})
              </span>
            )}
          </div>

          <ChevronDown className="w-3 h-3 text-muted-foreground ml-0.5" />
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute right-0 mt-2 w-80 origin-top-right rounded-lg border border-border bg-popover text-popover-foreground shadow-xl z-50 animate-in fade-in-0 zoom-in-95 duration-100 p-1 divide-y divide-border">
            {/* Header & Search */}
            <div className="p-2 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">
                  Select AI Model
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {filteredCatalog.length}/{catalog.length}
                  </span>
                  <button
                    type="button"
                    onClick={handleManualRefresh}
                    title="Refresh OpenRouter catalog"
                    className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    <RefreshCw
                      className={cn("w-3 h-3", refreshing && "animate-spin text-primary")}
                    />
                  </button>
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-2 top-2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search models, vendors, or IDs..."
                  className="h-7 pl-7 text-xs bg-background"
                />
              </div>

              {/* Category Filter Chips */}
              <div className="flex items-center gap-1">
                {(["all", "free", "local", "paid"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setFilterType(tab)}
                    className={cn(
                      "px-2 py-0.5 rounded text-[10px] font-medium capitalize transition-colors cursor-pointer",
                      filterType === tab
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "bg-secondary text-secondary-foreground hover:bg-muted",
                    )}
                  >
                    {tab === "free" ? "Free 🎁" : tab}
                  </button>
                ))}
              </div>
            </div>

            {/* Models List */}
            <div className="py-1 max-h-72 overflow-y-auto space-y-0.5">
              {filteredCatalog.length === 0 ? (
                <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                  No matching models found.
                </div>
              ) : (
                filteredCatalog.map((m) => {
                  const isSelected =
                    m.id === activeModel && m.provider === activeProvider;
                  const isPaidNoKey =
                    m.provider === "openrouter" && !m.isFree && !isOpenRouterConfigured;

                  return (
                    <button
                      key={`${m.provider}-${m.id}`}
                      type="button"
                      onClick={() => handleSelectModel(m)}
                      className={cn(
                        "w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs text-left transition-colors cursor-pointer",
                        isSelected
                          ? "bg-primary/10 text-primary font-medium"
                          : "hover:bg-muted text-foreground",
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {getProviderIcon(m.provider, m.isFree)}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="truncate font-medium">{m.name}</span>
                            {m.isLocal ? (
                              <Badge
                                variant="outline"
                                className="text-[8px] px-1 py-0 bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                              >
                                Local
                              </Badge>
                            ) : m.isFree ? (
                              <Badge
                                variant="outline"
                                className="text-[8px] px-1 py-0 bg-amber-500/10 text-amber-600 border-amber-500/30"
                              >
                                Free
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-[8px] px-1 py-0 text-muted-foreground"
                              >
                                {m.costPer1kInput !== undefined && m.costPer1kInput > 0
                                  ? `$${m.costPer1kInput}/1k`
                                  : "Paid"}
                              </Badge>
                            )}

                            {m.supportsTools && (
                              <Badge
                                variant="outline"
                                className="text-[8px] px-1 py-0 bg-blue-500/10 text-blue-600 border-blue-500/30"
                              >
                                Tools
                              </Badge>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground block font-mono truncate">
                            {m.id}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        {isPaidNoKey && (
                          <span
                            title="OpenRouter API Key Required"
                            className="text-[9px] text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1 py-0.5 rounded border border-amber-500/30 font-medium"
                          >
                            Key needed
                          </span>
                        )}
                        {isSelected && (
                          <Check className="w-3.5 h-3.5 text-primary" />
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="p-1.5">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setIsConfigOpen(true);
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Settings className="w-3.5 h-3.5" />
                  <span>Model Settings & Keys...</span>
                </div>
                {!isOpenRouterConfigured && (
                  <Badge
                    variant="outline"
                    className="text-[8px] px-1 py-0 text-amber-600 border-amber-500/30 bg-amber-500/10"
                  >
                    OpenRouter Not Set
                  </Badge>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Direct OpenRouter Key Prompt Modal for Paid Models */}
      <Dialog
        open={Boolean(keyPromptModel)}
        onOpenChange={(open) => {
          if (!open) {
            setKeyPromptModel(null);
            setApiKeyInput("");
          }
        }}
        className="max-w-md p-5"
      >
        <DialogHeader>
          <DialogTitle onClose={() => setKeyPromptModel(null)}>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-600">
                <Key className="w-4 h-4" />
              </div>
              <span>OpenRouter API Key Required</span>
            </div>
          </DialogTitle>
        </DialogHeader>

        {keyPromptModel && (
          <form onSubmit={handleSaveApiKeyAndSelect} className="mt-4 space-y-4">
            <div className="p-3 rounded-lg border border-border bg-card/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">
                  {keyPromptModel.name}
                </span>
                <Badge variant="outline" className="text-[9px]">
                  {keyPromptModel.costPer1kInput
                    ? `$${keyPromptModel.costPer1kInput}/1k tokens`
                    : "Paid Model"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                This is a paid cloud model on OpenRouter. To execute tasks with it, please provide your OpenRouter API key.
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-foreground">
                  OpenRouter API Key
                </label>
                <a
                  href="https://openrouter.ai/keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] text-primary hover:underline flex items-center gap-1"
                >
                  <span>Get API Key</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
              <Input
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="sk-or-v1-..."
                required
                className="h-8 text-xs font-mono"
                autoFocus
              />
              <p className="text-[10px] text-muted-foreground">
                Your key will be securely stored in your local configuration.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setKeyPromptModel(null);
                  setApiKeyInput("");
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={savingKey || !apiKeyInput.trim()}
                className="gap-1.5"
              >
                {savingKey ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Key className="w-3.5 h-3.5" />
                )}
                <span>Save Key & Select Model</span>
              </Button>
            </div>
          </form>
        )}
      </Dialog>

      <ModelConfigModal
        open={isConfigOpen}
        onOpenChange={setIsConfigOpen}
        catalog={catalog}
        activeModel={activeModel}
        activeProvider={activeProvider}
        onModelSwitched={() => {
          fetchModels();
          onModelChanged?.(activeProvider, activeModel);
        }}
      />
    </>
  );
};
