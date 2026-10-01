import React, { useState, useEffect, useRef } from "react";
import {
  Cpu,
  Zap,
  Brain,
  Sparkles,
  ChevronDown,
  Check,
  Settings,
  Loader2,
} from "lucide-react";
import { api } from "../services/api";
import { ModelConfigModal } from "./ModelConfigModal";
import { Badge } from "@/components/ui/badge";
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
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchModels = async () => {
    setLoading(true);
    try {
      const res = await api.listModels();
      if (res?.catalog) setCatalog(res.catalog);
      if (res?.active) {
        setActiveProvider(res.active.provider);
        setActiveModel(res.active.model);
      }
    } catch (err) {
      console.error("Failed fetching model catalog:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModels();
  }, []);

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

  const handleSelectModel = async (provider: string, modelId: string) => {
    if (provider === activeProvider && modelId === activeModel) {
      setIsOpen(false);
      return;
    }

    setSwitching(true);
    try {
      const res = await api.setActiveModel(provider, modelId);
      if (res?.success) {
        setActiveProvider(provider);
        setActiveModel(modelId);
        onModelChanged?.(provider, modelId);
      }
    } catch (err) {
      console.error("Failed switching model:", err);
    } finally {
      setSwitching(false);
      setIsOpen(false);
    }
  };

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case "ollama":
        return <Cpu className="w-3.5 h-3.5 text-emerald-500" />;
      case "openai":
        return <Zap className="w-3.5 h-3.5 text-sky-500" />;
      case "anthropic":
        return <Brain className="w-3.5 h-3.5 text-amber-500" />;
      case "gemini":
        return <Sparkles className="w-3.5 h-3.5 text-purple-500" />;
      case "groq":
        return <Zap className="w-3.5 h-3.5 text-orange-500" />;
      default:
        return <Cpu className="w-3.5 h-3.5 text-muted-foreground" />;
    }
  };

  const currentModelInfo = catalog.find(
    (m) => m.provider === activeProvider && m.id === activeModel,
  );

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
            getProviderIcon(activeProvider)
          )}

          <div className="flex items-center gap-1.5">
            <span className="capitalize text-foreground font-semibold">
              {currentModelInfo ? currentModelInfo.name : activeModel}
            </span>
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
          <div className="absolute right-0 mt-2 w-72 origin-top-right rounded-lg border border-border bg-popover text-popover-foreground shadow-lg z-50 animate-in fade-in-0 zoom-in-95 duration-100 p-1 divide-y divide-border">
            <div className="px-2.5 py-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">
                  Select AI Model
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {catalog.length} available
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Switch models dynamically per session or globally.
              </p>
            </div>

            <div className="py-1 max-h-64 overflow-y-auto space-y-0.5">
              {catalog.map((m) => {
                const isSelected =
                  m.id === activeModel && m.provider === activeProvider;
                return (
                  <button
                    key={`${m.provider}-${m.id}`}
                    type="button"
                    onClick={() => handleSelectModel(m.provider, m.id)}
                    className={cn(
                      "w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs text-left transition-colors cursor-pointer",
                      isSelected
                        ? "bg-primary/10 text-primary font-medium"
                        : "hover:bg-muted text-foreground",
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {getProviderIcon(m.provider)}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate">{m.name}</span>
                          {m.isLocal ? (
                            <Badge
                              variant="outline"
                              className="text-[8px] px-1 py-0 bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                            >
                              Local
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-[8px] px-1 py-0 text-muted-foreground"
                            >
                              Cloud
                            </Badge>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground block font-mono truncate">
                          {m.id}
                        </span>
                      </div>
                    </div>

                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-primary shrink-0 ml-2" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="p-1.5">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setIsConfigOpen(true);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Configure Keys & Benchmarks...</span>
              </button>
            </div>
          </div>
        )}
      </div>

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
