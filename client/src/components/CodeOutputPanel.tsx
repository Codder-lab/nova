import React, { useState } from "react";
import {
  Terminal,
  Check,
  Copy,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Clock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface CodeExecutionResultData {
  language: "javascript" | "typescript" | "python" | string;
  code?: string;
  stdout?: string;
  stderr?: string;
  result?: unknown;
  exitCode?: number;
  executionTimeMs?: number;
  success?: boolean;
  error?: string;
}

interface CodeOutputPanelProps {
  data: CodeExecutionResultData;
  className?: string;
}

export const CodeOutputPanel: React.FC<CodeOutputPanelProps> = ({
  data,
  className,
}) => {
  const [activeTab, setActiveTab] = useState<"output" | "code">("output");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedOutput, setCopiedOutput] = useState(false);

  const isSuccess = data.success ?? (data.exitCode === 0 && !data.error);
  const hasStdout = Boolean(data.stdout && data.stdout.trim().length > 0);
  const hasStderr = Boolean(data.stderr && data.stderr.trim().length > 0);
  const hasResult = data.result !== undefined;

  const handleCopyCode = async () => {
    if (!data.code) return;
    await navigator.clipboard.writeText(data.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyOutput = async () => {
    const textToCopy = [
      data.stdout,
      data.stderr ? `[STDERR]\n${data.stderr}` : "",
      hasResult ? `=> ${typeof data.result === "object" ? JSON.stringify(data.result, null, 2) : String(data.result)}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    if (!textToCopy) return;
    await navigator.clipboard.writeText(textToCopy);
    setCopiedOutput(true);
    setTimeout(() => setCopiedOutput(false), 2000);
  };

  return (
    <div
      className={cn(
        "rounded-lg border border-border/80 bg-card/95 text-card-foreground shadow-sm overflow-hidden my-2",
        className,
      )}
    >
      {/* Terminal Title Bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/60 border-b border-border text-xs select-none">
        <div className="flex items-center gap-2">
          {/* Mac-style terminal dots */}
          <div className="flex items-center gap-1.5 mr-1">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
          </div>

          <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold text-foreground">
            <Terminal className="w-3.5 h-3.5 text-primary" />
            <span>Sandbox Terminal</span>
          </div>

          {/* Language Badge */}
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] px-1.5 py-0 uppercase font-mono font-bold tracking-wider",
              data.language === "python"
                ? "bg-amber-500/10 text-amber-500 border-amber-500/30"
                : "bg-blue-500/10 text-blue-500 border-blue-500/30",
            )}
          >
            {data.language}
          </Badge>

          {/* Exit / Status Badge */}
          <Badge
            variant={isSuccess ? "outline" : "destructive"}
            className={cn(
              "text-[10px] px-1.5 py-0 font-mono",
              isSuccess
                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                : "bg-rose-500/10 text-rose-500 border-rose-500/30",
            )}
          >
            {isSuccess ? "exit 0" : `exit ${data.exitCode ?? 1}`}
          </Badge>

          {/* Execution Time */}
          {data.executionTimeMs !== undefined && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-mono">
              <Clock className="w-3 h-3 opacity-60" />
              {data.executionTimeMs}ms
            </span>
          )}
        </div>

        {/* Tab Switcher & Window Actions */}
        <div className="flex items-center gap-1">
          {data.code && (
            <div className="flex items-center bg-muted/90 rounded-md p-0.5 border border-border/50 text-[10px]">
              <button
                type="button"
                onClick={() => setActiveTab("output")}
                className={cn(
                  "px-2 py-0.5 rounded cursor-pointer transition-colors font-medium",
                  activeTab === "output"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Output
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("code")}
                className={cn(
                  "px-2 py-0.5 rounded cursor-pointer transition-colors font-medium",
                  activeTab === "code"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Code
              </button>
            </div>
          )}

          {activeTab === "code" && data.code ? (
            <button
              type="button"
              onClick={handleCopyCode}
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              title="Copy source code"
            >
              {copiedCode ? (
                <Check className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCopyOutput}
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              title="Copy terminal output"
            >
              {copiedOutput ? (
                <Check className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            title={isCollapsed ? "Expand terminal" : "Collapse terminal"}
          >
            {isCollapsed ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronUp className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Terminal Body */}
      {!isCollapsed && (
        <div className="bg-black/95 p-3 font-mono text-[11px] leading-relaxed overflow-x-auto max-h-[360px] text-zinc-100 selection:bg-primary/30">
          {activeTab === "code" && data.code ? (
            <div className="relative">
              <pre className="text-zinc-300 font-mono text-[11px] whitespace-pre">
                {data.code}
              </pre>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Stdout stream */}
              {hasStdout ? (
                <div className="text-emerald-400 whitespace-pre">
                  {data.stdout}
                </div>
              ) : null}

              {/* Stderr stream / errors */}
              {hasStderr ? (
                <div className="text-rose-400 bg-rose-500/10 p-2 rounded border border-rose-500/20 whitespace-pre flex items-start gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-400" />
                  <div className="flex-1">{data.stderr}</div>
                </div>
              ) : null}

              {/* Error if separate */}
              {data.error && !hasStderr ? (
                <div className="text-rose-400 bg-rose-500/10 p-2 rounded border border-rose-500/20 whitespace-pre flex items-start gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-400" />
                  <div className="flex-1">{data.error}</div>
                </div>
              ) : null}

              {/* Evaluated Return Value */}
              {hasResult ? (
                <div className="pt-1 border-t border-zinc-800 text-sky-300 flex items-baseline gap-1.5">
                  <span className="text-muted-foreground select-none">=&gt;</span>
                  <span className="font-semibold">
                    {typeof data.result === "object"
                      ? JSON.stringify(data.result, null, 2)
                      : String(data.result)}
                  </span>
                </div>
              ) : null}

              {!hasStdout && !hasStderr && !hasResult && !data.error && (
                <div className="text-zinc-500 italic">
                  [Program finished with no output]
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
