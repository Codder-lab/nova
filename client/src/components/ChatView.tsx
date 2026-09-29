import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Sparkles,
  Bot,
  User,
  Clock,
  Wrench,
  ShieldAlert,
  Check,
  X,
  Loader2,
  ChevronDown,
  ChevronRight,
  Terminal,
  Zap,
  Database,
  Globe,
  Calendar,
} from 'lucide-react';
import { api } from '../services/api';
import { socketClient } from '../services/socket';
import type { AgentStep } from '@nova/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import { cn } from '@/lib/utils';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
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
}

const quickActions = [
  { icon: Zap, label: 'Calculate', prompt: 'Calculate (45 * 18) / 3 and tell me current time in UTC', color: 'text-amber-400' },
  { icon: Database, label: 'Create Task', prompt: 'Create a high priority task titled "Review Security Audit"', color: 'text-emerald-400' },
  { icon: Calendar, label: 'Schedule', prompt: 'Schedule a task to check server metrics daily at 9am', color: 'text-indigo-400' },
  { icon: Globe, label: 'Web Search', prompt: 'Search the web for "latest advancements in agentic AI 2026"', color: 'text-cyan-400' },
];

export const ChatView: React.FC<{
  onPendingCountChange: (count: number) => void;
}> = ({ onPendingCountChange }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputGoal, setInputGoal] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => { scrollToBottom(); }, [messages, loading]);

  useEffect(() => {
    const pendingCount = messages.filter((m) => !!m.pendingApproval).length;
    onPendingCountChange(pendingCount);
  }, [messages, onPendingCountChange]);

  useEffect(() => {
    const socket = socketClient.getSocket();
    if (!socket) return;

    const handleStep = (data: any) => {
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.runId === data.runId) {
            const steps = msg.steps || [];
            const existingIdx = steps.findIndex((s) => s.id === data.step?.id);
            let updatedSteps = [...steps];
            if (existingIdx >= 0) updatedSteps[existingIdx] = data.step;
            else if (data.step) updatedSteps.push(data.step);
            return { ...msg, steps: updatedSteps };
          }
          return msg;
        })
      );
    };

    const handleApprovalRequired = (data: any) => {
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.runId === data.runId || msg.id === data.runId) {
            return { ...msg, status: 'waiting_for_approval', pendingApproval: data };
          }
          return msg;
        })
      );
    };

    const handleApprovalResolved = (data: any) => {
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.runId === data.runId) return { ...msg, pendingApproval: undefined };
          return msg;
        })
      );
    };

    socket.on('agent:step', handleStep);
    socket.on('agent:approval_required', handleApprovalRequired);
    socket.on('agent:approval_resolved', handleApprovalResolved);

    return () => {
      socket.off('agent:step', handleStep);
      socket.off('agent:approval_required', handleApprovalRequired);
      socket.off('agent:approval_resolved', handleApprovalResolved);
    };
  }, []);

  const handleSend = async (goalToSend?: string) => {
    const goal = (goalToSend || inputGoal).trim();
    if (!goal || loading) return;

    setInputGoal('');
    const userMsgId = `user-${Date.now()}`;
    const assistantMsgId = `asst-${Date.now()}`;

    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: 'user', content: goal },
      { id: assistantMsgId, role: 'assistant', content: '', status: 'running', steps: [] },
    ]);
    setLoading(true);

    try {
      const response = await api.runAgent({ goal });
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id === assistantMsgId) {
            return {
              ...m,
              runId: response.runId,
              content: response.response,
              status: response.status,
              steps: response.steps,
              durationMs: response.durationMs,
              toolCallsCount: response.toolCallsCount,
              pendingApproval: response.pendingApproval,
            };
          }
          return m;
        })
      );
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId ? { ...m, content: `Error: ${err.message}`, status: 'failed' } : m
        )
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
              return { ...m, status: 'completed', content: res.result.response, steps: res.result.steps, pendingApproval: undefined };
            }
            return m;
          })
        );
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
              return { ...m, status: 'completed', content: res.result.response, steps: res.result.steps, pendingApproval: undefined };
            }
            return m;
          })
        );
      }
    } catch (err: any) {
      alert(`Reject failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleStepAccordion = (stepId: string) => {
    setExpandedSteps((prev) => ({ ...prev, [stepId]: !prev[stepId] }));
  };

  const getStepBadgeVariant = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'running': return 'default';
      case 'failed': return 'destructive';
      case 'pending': return 'warning';
      default: return 'secondary';
    }
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {isEmpty ? (
          /* Empty State — Premium Hero Welcome */
          <div className="flex flex-col items-center justify-center min-h-full pt-8 pb-4 fade-in-up">
            {/* Animated icon */}
            <div className="relative mb-6 float-animation">
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 blur-xl opacity-50" />
              <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center shadow-2xl shadow-indigo-500/30">
                <Bot className="w-10 h-10 text-white" />
              </div>
              {/* Orbiting sparkle */}
              <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center shadow-lg shadow-amber-400/40">
                <Sparkles className="w-3 h-3 text-white" />
              </div>
            </div>

            <h2 className="text-3xl font-black text-white mb-2 font-['Outfit',sans-serif] text-center">
              Hello, I'm{' '}
              <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                Nova
              </span>
            </h2>
            <p className="text-slate-400 text-center max-w-md text-[14px] leading-relaxed mb-10">
              Your autonomous AI assistant. I manage tasks, schedule automations, search the web, remember facts, and handle complex multi-step goals — with human approval for high-risk actions.
            </p>

            {/* Feature pills */}
            <div className="flex flex-wrap gap-2 justify-center mb-10 max-w-lg">
              {[
                { icon: Zap, label: 'Multi-step reasoning', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
                { icon: Database, label: 'MongoDB persistence', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
                { icon: Globe, label: 'Real-time web search', color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' },
                { icon: ShieldAlert, label: 'Human-in-the-loop', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
                { icon: Terminal, label: 'Background automations', color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
              ].map((f) => {
                const Icon = f.icon;
                return (
                  <span
                    key={f.label}
                    className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-semibold', f.color)}
                  >
                    <Icon className="w-3 h-3" /> {f.label}
                  </span>
                );
              })}
            </div>

            {/* Quick action cards */}
            <div className="grid grid-cols-2 gap-3 w-full max-w-xl mb-2">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.label}
                    onClick={() => handleSend(action.prompt)}
                    className="group flex items-start gap-3 p-4 rounded-2xl border border-white/[0.07] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/15 transition-all duration-200 text-left cursor-pointer"
                  >
                    <div className={cn("p-2 rounded-xl bg-white/5 border border-white/8 mt-0.5 group-hover:scale-110 transition-transform", action.color)}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-[12px] font-bold text-slate-200 mb-1">{action.label}</div>
                      <div className="text-[11px] text-slate-500 leading-snug line-clamp-2">
                        {action.prompt}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          /* Message thread */
          <div className="py-4 space-y-5 px-1">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  'flex gap-3 items-start fade-in-up',
                  msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                )}
              >
                {/* Avatar */}
                <div
                  className={cn(
                    'w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-md mt-0.5',
                    msg.role === 'user'
                      ? 'bg-gradient-to-tr from-indigo-600 to-cyan-500 text-white'
                      : 'bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 text-white shadow-indigo-500/20'
                  )}
                >
                  {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                {/* Bubble */}
                <div
                  className={cn(
                    'max-w-[80%] rounded-2xl px-5 py-4 shadow-lg',
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-tr-sm'
                      : 'bg-slate-900/90 border border-white/[0.07] text-slate-100 rounded-tl-sm backdrop-blur-xl'
                  )}
                >
                  {/* Tool Execution Steps Timeline */}
                  {msg.steps && msg.steps.length > 0 && (
                    <div className="mb-4 space-y-2">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        <Terminal className="w-3 h-3 text-indigo-400" />
                        <span>Execution Trace ({msg.steps.length} steps)</span>
                      </div>
                      <div className="space-y-1.5">
                        {msg.steps.map((step) => (
                          <div
                            key={step.id}
                            className={cn(
                              'rounded-xl border px-3 py-2.5 text-[11px] transition-all duration-150',
                              step.type === 'tool'
                                ? 'bg-indigo-950/40 border-indigo-500/15'
                                : 'bg-cyan-950/30 border-cyan-500/15'
                            )}
                          >
                            <div
                              className="flex items-center justify-between cursor-pointer"
                              onClick={() => toggleStepAccordion(step.id)}
                            >
                              <div className="flex items-center gap-2 font-medium text-slate-200">
                                {step.type === 'tool' ? (
                                  <Wrench className="w-3 h-3 text-indigo-400 shrink-0" />
                                ) : (
                                  <Sparkles className="w-3 h-3 text-cyan-400 shrink-0" />
                                )}
                                <span className="truncate max-w-[200px]">{step.title}</span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <Badge variant={getStepBadgeVariant(step.status)}>{step.status}</Badge>
                                {step.toolCall && (
                                  expandedSteps[step.id]
                                    ? <ChevronDown className="w-3 h-3 text-slate-400" />
                                    : <ChevronRight className="w-3 h-3 text-slate-400" />
                                )}
                              </div>
                            </div>

                            {step.toolCall && expandedSteps[step.id] && (
                              <div className="mt-2.5 space-y-2 pt-2 border-t border-white/5">
                                <div className="text-slate-400 text-[10px] uppercase tracking-wider">Args:</div>
                                <pre className="p-2 rounded-lg bg-black/60 border border-white/5 text-indigo-300 font-mono text-[10px] overflow-x-auto whitespace-pre-wrap max-h-[120px]">
                                  {JSON.stringify(step.toolCall.arguments, null, 2)}
                                </pre>
                                {step.toolCall.result !== undefined && (
                                  <>
                                    <div className="text-slate-400 text-[10px] uppercase tracking-wider">Result:</div>
                                    <pre className="p-2 rounded-lg bg-black/60 border border-white/5 text-emerald-300 font-mono text-[10px] overflow-x-auto whitespace-pre-wrap max-h-[120px]">
                                      {JSON.stringify(step.toolCall.result, null, 2)}
                                    </pre>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Human-in-the-Loop Authorization Card */}
                  {msg.pendingApproval && (
                    <div className="my-3 p-4 rounded-2xl border border-amber-500/35 bg-amber-950/25 shadow-lg shadow-amber-900/10 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
                          <ShieldAlert className="w-4 h-4 animate-pulse" />
                          <span>Authorization Required</span>
                        </div>
                        <Badge variant="warning">{msg.pendingApproval.riskLevel} RISK</Badge>
                      </div>

                      <p className="text-sm text-amber-100/80 leading-relaxed">
                        {msg.pendingApproval.explanation}
                      </p>

                      <div className="p-2.5 rounded-xl bg-black/40 border border-amber-500/15 font-mono text-[11px] text-amber-300 break-all">
                        <span className="text-slate-400 font-sans">Tool: </span>
                        <strong className="text-white">{msg.pendingApproval.toolName}</strong>
                        {' '}({JSON.stringify(msg.pendingApproval.arguments)})
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="success"
                          size="sm"
                          onClick={() => handleApprove(msg.runId || msg.id)}
                          disabled={loading}
                          className="flex-1"
                        >
                          <Check className="w-3.5 h-3.5 mr-1" /> Authorize & Proceed
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleReject(msg.runId || msg.id)}
                          disabled={loading}
                          className="flex-1"
                        >
                          <X className="w-3.5 h-3.5 mr-1" /> Deny Request
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Main Text Content */}
                  {msg.content ? (
                    <div className="whitespace-pre-wrap leading-relaxed text-sm">{msg.content}</div>
                  ) : msg.status === 'running' ? (
                    <div className="flex items-center gap-2 text-slate-400 text-sm">
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                      <span>Thinking and formulating response...</span>
                      {/* Typing dots */}
                      <div className="flex gap-1">
                        {[0, 1, 2].map((i) => (
                          <div
                            key={i}
                            className="w-1.5 h-1.5 rounded-full bg-indigo-400"
                            style={{ animationDelay: `${i * 0.2}s`, animation: 'pulse-subtle 1s ease-in-out infinite' }}
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {/* Meta info row */}
                  {msg.durationMs !== undefined && (
                    <div className="flex items-center gap-4 mt-3 pt-2.5 border-t border-white/[0.06] text-[11px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-500" /> {msg.durationMs}ms
                      </span>
                      <span className="flex items-center gap-1">
                        <Wrench className="w-3 h-3 text-slate-500" /> {msg.toolCallsCount || 0} tools
                      </span>
                      {msg.status && (
                        <Badge variant={msg.status === 'completed' ? 'success' : 'secondary'} className="text-[10px] py-0">
                          {msg.status}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area — always at bottom */}
      <div className="pt-4 shrink-0">
        {/* Quick suggestion pills when in conversation */}
        {!isEmpty && (
          <div className="flex gap-2 overflow-x-auto pb-3 no-scrollbar">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  onClick={() => handleSend(action.prompt)}
                  disabled={loading}
                  className={cn(
                    "shrink-0 flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-full border border-white/[0.07] bg-white/[0.03] text-slate-400 hover:text-slate-200 hover:border-white/15 hover:bg-white/[0.06] transition-all cursor-pointer disabled:opacity-50",
                    action.color
                  )}
                >
                  <Icon className="w-3 h-3" /> {action.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Main Input Bar */}
        <form
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="relative flex items-center gap-2 p-2 pl-4 rounded-2xl border border-white/[0.08] bg-slate-900/80 backdrop-blur-xl shadow-2xl focus-within:border-indigo-500/40 focus-within:shadow-indigo-500/10 transition-all duration-200"
        >
          {/* Bot indicator */}
          <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>

          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent border-none outline-none text-sm text-slate-100 placeholder:text-slate-500 font-sans"
            placeholder="Ask Nova anything or enter an autonomous goal..."
            value={inputGoal}
            onChange={(e) => setInputGoal(e.target.value)}
            disabled={loading}
          />

          <Button
            type="submit"
            variant="glow"
            size="icon"
            className="shrink-0 h-9 w-9 rounded-xl"
            disabled={loading || !inputGoal.trim()}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </form>

        <p className="text-center text-[10px] text-slate-600 mt-2">
          Nova is powered by Ollama (qwen2.5:7b) · Human approvals required for HIGH risk actions
        </p>
      </div>
    </div>
  );
};
