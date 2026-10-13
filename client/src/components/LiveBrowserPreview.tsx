import React, { useState } from "react";
import {
  X,
  Maximize2,
  Minimize2,
  Minus,
  ExternalLink,
  Shield,
  Sparkles,
  Monitor,
  Power,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface BrowserPreviewData {
  imageBase64: string;
  url?: string;
  title?: string;
  timestamp?: string;
}

interface LiveBrowserPreviewProps {
  preview: BrowserPreviewData | null;
  isOpen: boolean;
  onClose: () => void;
  onMinimize?: () => void;
  onTerminate?: () => void;
}

export const LiveBrowserPreview: React.FC<LiveBrowserPreviewProps> = ({
  preview,
  isOpen,
  onClose,
  onMinimize,
  onTerminate,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!isOpen || !preview) {
    return null;
  }

  const handleCloseSession = onTerminate || onClose;
  const handleMinimize = onMinimize || onClose;

  const imageUrl = preview.imageBase64.startsWith("data:")
    ? preview.imageBase64
    : `data:image/png;base64,${preview.imageBase64}`;

  return (
    <div
      className={cn(
        "fixed z-50 transition-all duration-200 shadow-2xl border border-border/80 bg-background/95 backdrop-blur-md rounded-xl overflow-hidden flex flex-col",
        isExpanded
          ? "inset-4 sm:inset-10 max-w-5xl mx-auto"
          : "bottom-4 right-4 w-96 sm:w-[440px] max-h-[480px]",
      )}
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/60 border-b border-border select-none shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <div className="flex items-center gap-1.5 min-w-0">
            <Monitor className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="text-xs font-semibold text-foreground truncate">
              {preview.title || "Live Browser"}
            </span>
          </div>
          {preview.timestamp && (
            <Badge
              variant="outline"
              className="text-[9px] px-1 py-0 h-4 hidden sm:inline-flex text-muted-foreground"
            >
              {preview.timestamp}
            </Badge>
          )}
        </div>

        {/* Window controls */}
        <div className="flex items-center gap-1 shrink-0">
          {preview.url && preview.url.startsWith("http") && (
            <a
              href={preview.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              title="Open in real browser tab"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            title={isExpanded ? "Restore size" : "Expand preview"}
          >
            {isExpanded ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            onClick={handleMinimize}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            title="Minimize to badge"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleCloseSession}
            className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
            title="Close & terminate browser session completely"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Simulated Browser URL bar */}
      <div className="px-3 py-1.5 bg-card/80 border-b border-border flex items-center gap-2 shrink-0">
        <div className="flex items-center gap-1.5 flex-1 bg-muted/50 rounded-md px-2 py-1 text-[11px] font-mono text-muted-foreground truncate border border-border/50">
          <Shield className="w-3 h-3 text-emerald-500 shrink-0" />
          <span className="truncate select-all text-foreground/90">
            {preview.url || "about:blank"}
          </span>
        </div>
      </div>

      {/* Screenshot Display */}
      <div className="flex-1 overflow-auto bg-black/90 p-2 flex items-center justify-center min-h-[220px]">
        <img
          src={imageUrl}
          alt={preview.title || "Browser viewport"}
          className="max-w-full max-h-full object-contain rounded border border-white/10 shadow-md"
        />
      </div>

      {/* Footer Bar */}
      <div className="px-3 py-1.5 bg-muted/40 border-t border-border flex items-center justify-between text-[10px] text-muted-foreground shrink-0">
        <span className="flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-amber-500" />
          <span>Playwright Autonomous Session</span>
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleMinimize}
            className="text-[10px] text-muted-foreground hover:text-foreground cursor-pointer px-1.5 py-0.5 rounded hover:bg-muted/80 transition-colors"
          >
            Minimize
          </button>
          <button
            onClick={handleCloseSession}
            className="flex items-center gap-1 text-[10px] font-medium text-rose-500 hover:text-rose-600 bg-rose-500/10 hover:bg-rose-500/20 px-2 py-0.5 rounded transition-colors cursor-pointer"
            title="Stop Playwright browser and close session"
          >
            <Power className="w-3 h-3" />
            <span>Close Session</span>
          </button>
        </div>
      </div>
    </div>
  );
};

