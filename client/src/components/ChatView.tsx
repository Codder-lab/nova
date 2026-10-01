import React, { useState, useEffect, useRef } from "react";
import {
  Send,
  Bot,
  User,
  Clock,
  Wrench,
  ShieldAlert,
  Check,
  X,
  Loader2,
  ChevronRight,
  ChevronDown,
  Sparkles,
  Zap,
  Database,
  Globe,
  Calendar,
  Copy,
  CheckCheck,
  Brain,
  Search,
  CheckCircle2,
  PanelLeft,
  PanelLeftClose,
  Plus,
  Trash2,
  Edit2,
  MessagesSquare,
  MessageSquare,
  RotateCcw,
} from "lucide-react";
import { api } from "../services/api";
import { socketClient } from "../services/socket";
import type { AgentStep } from "@nova/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { ModelPicker } from "./ModelPicker";
import { cn } from "@/lib/utils";

export interface ChatSessionItem {
  id: string;
  userId: string;
  title: string;
  lastMessage?: string;
  messageCount: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  runId?: string;
  steps?: AgentStep[];
  pendingApproval?: {
    toolName: string;
    riskLevel: string;
    explanation: string;
    arguments: Record<string, unknown>;
  };
  durationMs?: number;
  toolCallsCount?: number;
  status?: string;
  isStreaming?: boolean;
}

interface ChatViewProps {
  onPendingCountChange: (count: number) => void;
  activeSessionId?: string | null;
  onSessionChange?: (sessionId: string | null) => void;
}

const quickActions = [
  {
    icon: Zap,
    label: "Calculate & Time",
    prompt: "Calculate (45 * 18) / 3 and tell me current time in UTC",
  },
  {
    icon: Database,
    label: "Create Task",
    prompt: 'Create a high priority task titled "Review Security Audit"',
  },
  {
    icon: Calendar,
    label: "Schedule Action",
    prompt: "Schedule a task to check server metrics daily at 9am",
  },
  {
    icon: Globe,
    label: "Web Research",
    prompt: 'Search the web for "latest advancements in agentic AI 2026"',
  },
];

/**
 * Converts technical tool steps into clear, human-understandable reasoning explanations
 */
function getHumanFriendlyStep(step: AgentStep): {
  title: string;
  detail?: string;
  icon: React.ComponentType<{ className?: string }>;
} {
  if (step.type === "tool" && step.toolCall) {
    const name = step.toolCall.name;
    const args = (step.toolCall.arguments as Record<string, any>) || {};

    if (name === "calculate") {
      return {
        title: `Evaluating calculation: ${args.expression || ""}`,
        detail:
          step.toolCall.result !== undefined
            ? `Result: ${JSON.stringify(step.toolCall.result)}`
            : undefined,
        icon: Zap,
      };
    }
    if (name === "get_current_time") {
      return {
        title: "Checking current system & UTC clock",
        detail:
          step.toolCall.result !== undefined
            ? `Time: ${JSON.stringify(step.toolCall.result)}`
            : undefined,
        icon: Clock,
      };
    }
    if (name === "web_search") {
      const resData = step.toolCall.result as any;
      return {
        title: `Searching the web for: "${args.query || ""}"`,
        detail: resData?.results?.length
          ? `Found ${resData.results.length} search results`
          : undefined,
        icon: Search,
      };
    }
    if (name === "fetch_web_page") {
      return {
        title: `Fetching & reading web page: ${args.url || ""}`,
        icon: Globe,
      };
    }
    if (name === "create_task") {
      return {
        title: `Creating database task: "${args.title || ""}"`,
        detail: args.priority ? `Priority: ${args.priority}` : undefined,
        icon: Database,
      };
    }
    if (name === "list_tasks") {
      return {
        title: "Retrieving tasks from database",
        icon: Database,
      };
    }
    if (name === "create_reminder") {
      return {
        title: `Setting automated reminder: "${args.title || ""}"`,
        detail: args.remindAt
          ? `Trigger time: ${new Date(args.remindAt).toLocaleString()}`
          : undefined,
        icon: Calendar,
      };
    }
    if (name === "remember") {
      return {
        title: `Storing fact to memory bank: "${args.content || ""}"`,
        icon: Brain,
      };
    }
    if (name === "search_memories") {
      return {
        title: `Querying long-term memory for: "${args.query || ""}"`,
        icon: Brain,
      };
    }
    if (name === "create_schedule") {
      return {
        title: `Registering background automation: "${args.prompt || ""}"`,
        detail: `Cron recurrence: ${args.schedule || ""}`,
        icon: Calendar,
      };
    }

    return {
      title: `Executing tool: ${name}`,
      detail: Object.keys(args).length ? JSON.stringify(args) : undefined,
      icon: Wrench,
    };
  }

  // General planning / thinking step
  return {
    title: step.title || "Analyzing goal and planning execution strategy...",
    icon: Sparkles,
  };
}

/**
 * Typewriter response component that streams markdown text letter-by-letter
 */
const StreamedMarkdownResponse: React.FC<{
  text: string;
  isStreaming?: boolean;
  onStreamComplete?: () => void;
  onScroll?: () => void;
}> = ({ text, isStreaming = false, onStreamComplete, onScroll }) => {
  const [displayedText, setDisplayedText] = useState(isStreaming ? "" : text);
  const [typing, setTyping] = useState(isStreaming);
  const onStreamCompleteRef = useRef(onStreamComplete);
  onStreamCompleteRef.current = onStreamComplete;
  const onScrollRef = useRef(onScroll);
  onScrollRef.current = onScroll;

  useEffect(() => {
    if (!isStreaming) {
      setDisplayedText(text);
      setTyping(false);
      return;
    }

    let currentIndex = 0;
    setDisplayedText("");
    setTyping(true);

    const chunk = text.length > 500 ? 6 : text.length > 200 ? 3 : 2;
    const intervalMs = 12;

    const timer = setInterval(() => {
      currentIndex += chunk;
      if (currentIndex >= text.length) {
        setDisplayedText(text);
        setTyping(false);
        clearInterval(timer);
        onStreamCompleteRef.current?.();
      } else {
        setDisplayedText(text.slice(0, currentIndex));
      }
      onScrollRef.current?.();
    }, intervalMs);

    return () => clearInterval(timer);
  }, [text, isStreaming]);

  return (
    <div>
      <MarkdownRenderer content={displayedText} showReferences={!typing} />
      {typing && (
        <span className="inline-block w-1.5 h-3.5 bg-foreground/80 align-middle ml-0.5 animate-pulse" />
      )}
    </div>
  );
};

/**
 * Human-friendly live thinking block and collapsed thought summary
 */
const ThinkingProcess: React.FC<{
  steps?: AgentStep[];
  status?: string;
  durationMs?: number;
}> = ({ steps = [], status, durationMs }) => {
  const isRunning = status === "running";
  const [expanded, setExpanded] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [inspectedStepId, setInspectedStepId] = useState<string | null>(null);

  useEffect(() => {
    if (!isRunning) return;
    setElapsedSec(0);
    const start = Date.now();
    const interval = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - start) / 100) / 10);
    }, 100);
    return () => clearInterval(interval);
  }, [isRunning]);

  const durationSec = durationMs
    ? (durationMs / 1000).toFixed(1)
    : elapsedSec.toFixed(1);

  if (!isRunning && (!steps || steps.length === 0)) {
    return null;
  }

  return (
    <div className="mb-3">
      {isRunning ? (
        <div className="rounded-md border border-border bg-muted/40 p-3 space-y-2.5 animate-in fade-in-0 duration-150">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-primary animate-pulse" />
              <span className="text-xs font-semibold text-foreground">
                Thinking ({durationSec}s)
              </span>
            </div>
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin text-primary" />
              <span>
                Running {steps.length} {steps.length === 1 ? "step" : "steps"}
              </span>
            </span>
          </div>

          <div className="space-y-1.5 pt-1 border-t border-border">
            {steps.map((step, idx) => {
              const friendly = getHumanFriendlyStep(step);
              const Icon = friendly.icon;
              const isStepRunning = step.status === "running";

              return (
                <div
                  key={step.id || idx}
                  className={cn(
                    "p-2 rounded-md text-xs border transition-colors",
                    isStepRunning
                      ? "bg-background border-primary/40 shadow-xs"
                      : "bg-muted/30 border-border/60",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-medium text-foreground min-w-0">
                      <Icon
                        className={cn(
                          "w-3.5 h-3.5 shrink-0",
                          isStepRunning
                            ? "text-primary"
                            : "text-muted-foreground",
                        )}
                      />
                      <span className="truncate">{friendly.title}</span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {isStepRunning ? (
                        <span className="flex items-center gap-1 text-[10px] text-primary font-medium">
                          <Loader2 className="w-2.5 h-2.5 animate-spin" /> In
                          progress
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                          <CheckCircle2 className="w-3 h-3" /> Done
                        </span>
                      )}
                    </div>
                  </div>

                  {friendly.detail && (
                    <div className="text-[11px] text-muted-foreground mt-1 pl-5.5 font-mono truncate">
                      {friendly.detail}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-md border border-border/60 bg-muted/20">
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between p-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 rounded-md transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-primary/70" />
              <span>
                Thought process ({steps.length}{" "}
                {steps.length === 1 ? "step" : "steps"}
                {durationMs ? ` in ${(durationMs / 1000).toFixed(1)}s` : ""})
              </span>
            </div>
            {expanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </button>

          {expanded && (
            <div className="p-2 pt-0 space-y-1.5 border-t border-border/40 mt-1">
              {steps.map((step, idx) => {
                const friendly = getHumanFriendlyStep(step);
                const Icon = friendly.icon;
                const isInspected = inspectedStepId === (step.id || `${idx}`);

                return (
                  <div
                    key={step.id || idx}
                    className="p-1.5 rounded text-xs bg-card border border-border/40"
                  >
                    <div
                      onClick={() =>
                        setInspectedStepId(
                          isInspected ? null : step.id || `${idx}`,
                        )
                      }
                      className="flex items-center justify-between gap-2 cursor-pointer hover:opacity-80"
                    >
                      <div className="flex items-center gap-1.5 font-medium text-foreground min-w-0">
                        <Icon className="w-3 h-3 text-muted-foreground shrink-0" />
                        <span className="truncate">{friendly.title}</span>
                      </div>

                      {step.toolCall && (
                        <span className="text-[10px] text-muted-foreground">
                          {isInspected ? (
                            <ChevronDown className="w-3 h-3" />
                          ) : (
                            <ChevronRight className="w-3 h-3" />
                          )}
                        </span>
                      )}
                    </div>

                    {friendly.detail && (
                      <div className="text-[11px] text-muted-foreground pl-5 font-mono">
                        {friendly.detail}
                      </div>
                    )}

                    {step.toolCall && isInspected && (
                      <div className="mt-1.5 pl-5 space-y-1.5 font-mono text-[10px]">
                        {step.toolCall.arguments && (
                          <div className="p-2 rounded bg-secondary text-foreground overflow-x-auto border border-border">
                            <span className="text-muted-foreground text-[9px] uppercase font-sans font-semibold block mb-0.5">
                              Input arguments:
                            </span>
                            {JSON.stringify(step.toolCall.arguments, null, 2)}
                          </div>
                        )}
                        {step.toolCall.result !== undefined && (
                          <div className="p-2 rounded bg-secondary text-foreground overflow-x-auto border border-border max-h-32">
                            <span className="text-muted-foreground text-[9px] uppercase font-sans font-semibold block mb-0.5">
                              Output result:
                            </span>
                            {JSON.stringify(step.toolCall.result, null, 2)}
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
      )}
    </div>
  );
};

function formatSessionTime(dateStr: string) {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export const ChatView: React.FC<ChatViewProps> = ({
  onPendingCountChange,
  activeSessionId: propActiveSessionId,
  onSessionChange,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputGoal, setInputGoal] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Session state
  const [sessions, setSessions] = useState<ChatSessionItem[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(
    propActiveSessionId || null,
  );
  const [currentSessionTitle, setCurrentSessionTitle] = useState("New Chat");
  const [sessionsSidebarOpen, setSessionsSidebarOpen] = useState(true);
  const [sessionSearch, setSessionSearch] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState("");
  const [isSessionLoading, setIsSessionLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  useEffect(() => {
    const pendingCount = messages.filter((m) =>
      Boolean(m.pendingApproval),
    ).length;
    onPendingCountChange(pendingCount);
  }, [messages, onPendingCountChange]);

  // Load all sessions list
  const loadSessionsList = async () => {
    try {
      const res = await api.listSessions(sessionSearch);
      if (res.success && res.sessions) {
        setSessions(res.sessions);
      }
    } catch (err) {
      console.error("Failed to load sessions list:", err);
    }
  };

  useEffect(() => {
    loadSessionsList();
  }, [sessionSearch]);

  // Load specific session messages
  const loadSession = async (sessionId: string) => {
    setIsSessionLoading(true);
    setCurrentSessionId(sessionId);
    onSessionChange?.(sessionId);

    try {
      const res = await api.getSession(sessionId);
      if (res.success) {
        setCurrentSessionTitle(res.session?.title || "Chat Session");
        if (res.messages && Array.isArray(res.messages)) {
          const loaded: ChatMessage[] = res.messages.map((m: any) => ({
            id: m.id || m._id,
            role: m.role,
            content: m.content || "",
            runId: m.runId,
            steps: m.steps || [],
            durationMs: m.durationMs,
            toolCallsCount: m.toolCallsCount,
            status: m.status,
            pendingApproval: m.pendingApproval,
            isStreaming: false,
          }));
          setMessages(loaded);
        } else {
          setMessages([]);
        }
      }
    } catch (err) {
      console.error("Failed to fetch session messages:", err);
    } finally {
      setIsSessionLoading(false);
    }
  };

  // Sync with propActiveSessionId if changed from parent
  useEffect(() => {
    if (propActiveSessionId && propActiveSessionId !== currentSessionId) {
      loadSession(propActiveSessionId);
    }
  }, [propActiveSessionId]);

  // Handle Socket events
  useEffect(() => {
    const socket = socketClient.getSocket();
    if (!socket) return;

    const handleStep = (data: any) => {
      const step = data?.payload || data?.step || data;
      const runId = data?.runId;
      if (!step || !step.id) return;

      setMessages((prev) =>
        prev.map((msg) => {
          if (
            (runId && msg.runId === runId) ||
            (msg.status === "running" && msg.role === "assistant")
          ) {
            const steps = msg.steps || [];
            const existingIdx = steps.findIndex((s) => s.id === step.id);
            let updatedSteps = [...steps];
            if (existingIdx >= 0) updatedSteps[existingIdx] = step;
            else updatedSteps.push(step);
            return { ...msg, runId: runId || msg.runId, steps: updatedSteps };
          }
          return msg;
        }),
      );
    };

    const handleApprovalRequired = (data: any) => {
      const payload = data?.payload || data;
      const runId = data?.runId;
      setMessages((prev) =>
        prev.map((msg) => {
          if (
            msg.runId === runId ||
            msg.id === runId ||
            (msg.status === "running" && msg.role === "assistant")
          ) {
            return {
              ...msg,
              status: "waiting_for_approval",
              pendingApproval: payload,
            };
          }
          return msg;
        }),
      );
    };

    const handleApprovalResolved = (data: any) => {
      const runId = data?.runId;
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.runId === runId)
            return { ...msg, pendingApproval: undefined };
          return msg;
        }),
      );
    };

    const handleToken = (data: any) => {
      const token = data?.payload?.token || data?.token || "";
      const runId = data?.runId;
      if (!token) return;

      setMessages((prev) =>
        prev.map((msg) => {
          if (
            (runId && msg.runId === runId) ||
            (msg.status === "running" && msg.role === "assistant")
          ) {
            return {
              ...msg,
              runId: runId || msg.runId,
              content: (msg.content || "") + token,
              isStreaming: true,
            };
          }
          return msg;
        }),
      );
    };

    socket.on("agent:step", handleStep);
    socket.on("agent:tool:call", handleStep);
    socket.on("agent:approval_required", handleApprovalRequired);
    socket.on("agent:approval_resolved", handleApprovalResolved);
    socket.on("agent:token", handleToken);

    return () => {
      socket.off("agent:step", handleStep);
      socket.off("agent:tool:call", handleStep);
      socket.off("agent:approval_required", handleApprovalRequired);
      socket.off("agent:approval_resolved", handleApprovalResolved);
      socket.off("agent:token", handleToken);
    };
  }, []);

  const handleStartNewChat = () => {
    setCurrentSessionId(null);
    setCurrentSessionTitle("New Chat");
    setMessages([]);
    onSessionChange?.(null);
    inputRef.current?.focus();
  };

  const handleRenameSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTitleValue.trim() || !currentSessionId) return;

    try {
      const res = await api.updateSession(currentSessionId, {
        title: editTitleValue.trim(),
      });
      if (res.success) {
        setCurrentSessionTitle(editTitleValue.trim());
        loadSessionsList();
      }
    } catch (err) {
      console.error("Failed to rename session:", err);
    } finally {
      setIsEditingTitle(false);
    }
  };

  const handleDeleteSession = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm("Delete this chat session and its saved conversation?"))
      return;

    try {
      const res = await api.deleteSession(id);
      if (res.success) {
        if (currentSessionId === id) {
          handleStartNewChat();
        }
        loadSessionsList();
      }
    } catch (err) {
      console.error("Failed to delete session:", err);
    }
  };

  const handleClearSession = async () => {
    if (!currentSessionId) {
      setMessages([]);
      return;
    }
    if (!confirm("Clear all messages in this session?")) return;

    try {
      const res = await api.clearSession(currentSessionId);
      if (res.success) {
        setMessages([]);
        loadSessionsList();
      }
    } catch (err) {
      console.error("Failed to clear session:", err);
    }
  };

  const handleSend = async (goalToSend?: string) => {
    const goal = (goalToSend || inputGoal).trim();
    if (!goal || loading) return;

    setInputGoal("");
    const userMsgId = `user-${Date.now()}`;
    const assistantMsgId = `asst-${Date.now()}`;

    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: "user", content: goal },
      {
        id: assistantMsgId,
        role: "assistant",
        content: "",
        status: "running",
        steps: [],
        isStreaming: false,
      },
    ]);
    setLoading(true);

    try {
      const response = await api.runAgent({
        goal,
        conversationId: currentSessionId || undefined,
      });

      // If a session was assigned/created by server, remember it
      if (
        response.conversationId &&
        response.conversationId !== currentSessionId
      ) {
        setCurrentSessionId(response.conversationId);
        onSessionChange?.(response.conversationId);
        setCurrentSessionTitle(
          goal.length > 40 ? `${goal.slice(0, 38)}...` : goal,
        );
      }

      setMessages((prev) =>
        prev.map((m) => {
          if (m.id === assistantMsgId) {
            return {
              ...m,
              runId: response.runId,
              content: response.response,
              status: response.status,
              steps:
                response.steps && response.steps.length > 0
                  ? response.steps
                  : m.steps,
              durationMs: response.durationMs,
              toolCallsCount: response.toolCallsCount,
              pendingApproval: response.pendingApproval,
              isStreaming: true,
            };
          }
          return m;
        }),
      );

      // Refresh sidebar sessions to show latest message & turn count
      loadSessionsList();
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? {
                ...m,
                content: `Error: ${err.message}`,
                status: "failed",
                isStreaming: false,
              }
            : m,
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (runId: string) => {
    setLoading(true);
    try {
      const res = await api.approveAction(runId);
      if (res.success && res.result) {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.runId === runId) {
              return {
                ...m,
                status: "completed",
                content: res.result.response,
                steps: res.result.steps,
                pendingApproval: undefined,
                isStreaming: true,
              };
            }
            return m;
          }),
        );
        loadSessionsList();
      }
    } catch (err: any) {
      alert(`Approval failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (runId: string) => {
    setLoading(true);
    try {
      const res = await api.rejectAction(runId);
      if (res.success && res.result) {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.runId === runId) {
              return {
                ...m,
                status: "completed",
                content: res.result.response,
                steps: res.result.steps,
                pendingApproval: undefined,
                isStreaming: true,
              };
            }
            return m;
          }),
        );
        loadSessionsList();
      }
    } catch (err: any) {
      alert(`Reject failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleStreamComplete = (msgId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, isStreaming: false } : m)),
    );
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex h-full w-full bg-card overflow-hidden">
      {/* Collapsible Left Sessions Drawer */}
      {sessionsSidebarOpen && (
        <aside className="w-64 border-r border-border flex flex-col h-full bg-secondary/30 shrink-0 select-none animate-in slide-in-from-left-2 duration-150">
          {/* Sessions Drawer Header */}
          <div className="p-3 border-b border-border flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <MessagesSquare className="w-4 h-4 text-primary shrink-0" />
              <span className="text-xs font-semibold text-foreground tracking-tight">
                Chat Sessions
              </span>
              <Badge
                variant="secondary"
                className="text-[10px] px-1 py-0 h-4 font-normal"
              >
                {sessions.length}
              </Badge>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={handleStartNewChat}
              className="h-7 px-2 text-xs gap-1 font-medium bg-card"
              title="Start a new chat session"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New</span>
            </Button>
          </div>

          {/* Search Filter */}
          <div className="p-2.5 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Search sessions..."
                value={sessionSearch}
                onChange={(e) => setSessionSearch(e.target.value)}
                className="pl-8 h-7 text-xs bg-background"
              />
            </div>
          </div>

          {/* Sessions List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1 no-scrollbar">
            {sessions.length === 0 ? (
              <div className="text-center py-8 px-3 text-muted-foreground">
                <MessageSquare className="w-5 h-5 mx-auto mb-1.5 opacity-40" />
                <p className="text-[11px]">No chat sessions found</p>
                <button
                  onClick={handleStartNewChat}
                  className="mt-2 text-xs text-primary font-medium hover:underline cursor-pointer"
                >
                  Create new session
                </button>
              </div>
            ) : (
              sessions.map((s) => {
                const isActive = currentSessionId === s.id;
                return (
                  <div
                    key={s.id}
                    onClick={() => loadSession(s.id)}
                    className={cn(
                      "group relative flex flex-col gap-1 p-2 rounded-lg text-left transition-all cursor-pointer border text-xs",
                      isActive
                        ? "bg-card border-border shadow-xs font-medium text-foreground"
                        : "border-transparent text-muted-foreground hover:bg-card/70 hover:text-foreground",
                    )}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <MessageSquare
                          className={cn(
                            "w-3.5 h-3.5 shrink-0",
                            isActive ? "text-primary" : "text-muted-foreground",
                          )}
                        />
                        <span className="truncate font-semibold text-xs leading-none">
                          {s.title || "Untitled Session"}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={(e) => handleDeleteSession(s.id, e)}
                          className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-rose-500 transition-opacity cursor-pointer"
                          title="Delete session"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-muted-foreground pl-5">
                      <span className="truncate max-w-[120px]">
                        {s.lastMessage ? s.lastMessage : "No messages"}
                      </span>
                      <span className="shrink-0">
                        {formatSessionTime(s.updatedAt)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>
      )}

      {/* Main Chat Panel */}
      <div className="flex-1 flex flex-col h-full min-w-0 bg-card">
        {/* Chat Header Bar */}
        <header className="h-12 px-4 border-b border-border flex items-center justify-between shrink-0 bg-card/60 backdrop-blur-xs">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <button
              onClick={() => setSessionsSidebarOpen(!sessionsSidebarOpen)}
              className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title={
                sessionsSidebarOpen
                  ? "Collapse Sessions sidebar"
                  : "Expand Sessions sidebar"
              }
            >
              {sessionsSidebarOpen ? (
                <PanelLeftClose className="w-4 h-4" />
              ) : (
                <PanelLeft className="w-4 h-4" />
              )}
            </button>

            {/* Current Session Title & Rename */}
            {isEditingTitle ? (
              <form
                onSubmit={handleRenameSession}
                className="flex items-center gap-1.5 flex-1 max-w-sm"
              >
                <Input
                  autoFocus
                  value={editTitleValue}
                  onChange={(e) => setEditTitleValue(e.target.value)}
                  className="h-7 text-xs py-0 px-2"
                />
                <button
                  type="submit"
                  className="p-1 rounded hover:bg-muted text-emerald-600 dark:text-emerald-400 cursor-pointer"
                  title="Save title"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingTitle(false)}
                  className="p-1 rounded hover:bg-muted text-muted-foreground cursor-pointer"
                  title="Cancel"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </form>
            ) : (
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-semibold text-foreground truncate max-w-[300px]">
                  {currentSessionTitle}
                </span>

                {currentSessionId && (
                  <button
                    onClick={() => {
                      setEditTitleValue(currentSessionTitle);
                      setIsEditingTitle(true);
                    }}
                    className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    title="Rename current session"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <ModelPicker compact />

            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearSession}
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                title="Clear current session messages"
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                <span>Clear</span>
              </Button>
            )}

            <Button
              size="sm"
              variant="outline"
              onClick={handleStartNewChat}
              className="h-7 px-2.5 text-xs gap-1 font-medium shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Chat</span>
            </Button>
          </div>
        </header>

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto min-h-0 px-6">
          {isSessionLoading ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin mb-2 text-primary" />
              <p className="text-xs">Loading session history...</p>
            </div>
          ) : isEmpty ? (
            /* Empty State — Clean, Minimal, Professional */
            <div className="flex flex-col items-center justify-center min-h-full py-8 text-center max-w-2xl mx-auto">
              <div className="w-12 h-12 rounded-lg bg-primary text-primary-foreground flex items-center justify-center mb-4 shadow-xs">
                <Bot className="w-6 h-6" />
              </div>

              <h2 className="text-xl font-semibold text-foreground mb-1 tracking-tight">
                Nova Autonomous Agent
              </h2>
              <p className="text-muted-foreground text-xs max-w-md mb-8">
                All interactions are organized in persistent sessions. Pick a
                suggestion below or describe any goal to begin.
              </p>

              {/* Quick Action Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-lg mb-2">
                {quickActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.label}
                      onClick={() => handleSend(action.prompt)}
                      className="flex items-start gap-3 p-3.5 rounded-lg border border-border bg-card hover:bg-muted/50 hover:border-border text-left transition-colors cursor-pointer group"
                    >
                      <div className="p-2 rounded-md bg-secondary text-foreground shrink-0 mt-0.5">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-foreground group-hover:text-primary mb-0.5">
                          {action.label}
                        </div>
                        <div className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                          {action.prompt}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Message Thread */
            <div className="py-4 space-y-5 w-full">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex gap-3 items-start",
                    msg.role === "user" ? "flex-row-reverse" : "flex-row",
                  )}
                >
                  <Avatar
                    size="sm"
                    className={cn(
                      "mt-0.5 font-bold",
                      msg.role === "user"
                        ? "bg-secondary text-foreground border border-border"
                        : "bg-secondary text-secondary-foreground",
                    )}
                  >
                    {msg.role === "user" ? (
                      <User className="w-3.5 h-3.5" />
                    ) : (
                      <Bot className="w-3.5 h-3.5" />
                    )}
                  </Avatar>

                  <div
                    className={cn(
                      "max-w-[85%] rounded-lg px-4 py-3 text-xs sm:text-sm shadow-xs border",
                      msg.role === "user"
                        ? "bg-secondary text-foreground border-border"
                        : "bg-card text-card-foreground border-border",
                    )}
                  >
                    {msg.role === "user" && (
                      <div className="whitespace-pre-wrap leading-relaxed font-normal text-foreground">
                        {msg.content}
                      </div>
                    )}

                    {msg.role === "assistant" && (
                      <ThinkingProcess
                        steps={msg.steps}
                        status={msg.status}
                        durationMs={msg.durationMs}
                      />
                    )}

                    {msg.pendingApproval && (
                      <div className="my-3 p-3.5 rounded-md border border-amber-500/30 bg-amber-500/10 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-semibold text-xs">
                            <ShieldAlert className="w-4 h-4" />
                            <span>Action Approval Required</span>
                          </div>
                          <Badge
                            variant="warning"
                            className="text-[10px] px-1.5 py-0"
                          >
                            {msg.pendingApproval.riskLevel} RISK
                          </Badge>
                        </div>

                        <p className="text-xs text-foreground leading-relaxed">
                          {msg.pendingApproval.explanation}
                        </p>

                        <div className="p-2 rounded-md bg-background border border-border font-mono text-[11px] text-foreground break-all">
                          <span className="text-muted-foreground font-sans">
                            Tool:{" "}
                          </span>
                          <strong>{msg.pendingApproval.toolName}</strong> (
                          {JSON.stringify(msg.pendingApproval.arguments)})
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <Button
                            variant="success"
                            size="sm"
                            onClick={() => handleApprove(msg.runId || msg.id)}
                            disabled={loading}
                            className="h-8 flex-1 text-xs"
                          >
                            <Check className="w-3.5 h-3.5 mr-1" /> Approve
                            Action
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleReject(msg.runId || msg.id)}
                            disabled={loading}
                            className="h-8 flex-1 text-xs"
                          >
                            <X className="w-3.5 h-3.5 mr-1" /> Deny
                          </Button>
                        </div>
                      </div>
                    )}

                    {msg.role === "assistant" && msg.content ? (
                      <StreamedMarkdownResponse
                        text={msg.content}
                        isStreaming={msg.isStreaming}
                        onStreamComplete={() => handleStreamComplete(msg.id)}
                        onScroll={scrollToBottom}
                      />
                    ) : null}

                    {msg.role === "assistant" && msg.content && (
                      <div className="flex items-center justify-between mt-3 pt-2 border-t border-border text-[11px] text-muted-foreground">
                        <div className="flex items-center gap-3">
                          {msg.durationMs !== undefined && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />{" "}
                              {(msg.durationMs / 1000).toFixed(1)}s
                            </span>
                          )}
                          {msg.toolCallsCount !== undefined &&
                            msg.toolCallsCount > 0 && (
                              <span className="flex items-center gap-1">
                                <Wrench className="w-3 h-3" />{" "}
                                {msg.toolCallsCount}{" "}
                                {msg.toolCallsCount === 1 ? "tool" : "tools"}
                              </span>
                            )}
                        </div>

                        <button
                          onClick={() => copyToClipboard(msg.content, msg.id)}
                          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer py-0.5 px-1.5 rounded hover:bg-muted"
                          title="Copy response"
                        >
                          {copiedId === msg.id ? (
                            <>
                              <CheckCheck className="w-3 h-3 text-emerald-500" />
                              <span className="text-[10px] text-emerald-500 font-medium">
                                Copied
                              </span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span className="text-[10px]">Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Chat Input Bar */}
        <div className="p-4 pt-2 shrink-0 border-t border-border bg-card w-full">
          <div className="w-full">
            {!isEmpty && (
              <div className="flex gap-2 overflow-x-auto pb-2.5 no-scrollbar">
                {quickActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.label}
                      onClick={() => handleSend(action.prompt)}
                      disabled={loading}
                      className="shrink-0 flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <Icon className="w-3 h-3" /> {action.label}
                    </button>
                  );
                })}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2 rounded-lg border border-border bg-secondary/30 p-1.5 pl-3 shadow-xs focus-within:ring-1 focus-within:ring-ring"
            >
              <input
                ref={inputRef}
                type="text"
                className="flex-1 bg-transparent border-none outline-none text-xs sm:text-sm text-foreground placeholder:text-muted-foreground font-sans"
                placeholder="Describe a goal or ask a question..."
                value={inputGoal}
                onChange={(e) => setInputGoal(e.target.value)}
                disabled={loading}
              />

              <Button
                type="submit"
                size="sm"
                className="h-8 px-3 text-xs"
                disabled={loading || !inputGoal.trim()}
              >
                {loading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5 mr-1" />
                )}
                <span>Run</span>
              </Button>
            </form>

            <p className="text-center text-[11px] text-muted-foreground mt-1.5">
              Nova Autonomous Agent · Multi-turn session context active ·
              High-risk actions require user approval
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
