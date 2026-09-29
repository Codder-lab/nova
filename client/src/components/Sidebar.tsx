import React from 'react';
import {
  MessageSquare,
  CheckSquare,
  Bell,
  Brain,
  Clock,
  History,
  Globe,
  Settings,
  Sparkles,
  ShieldAlert,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type TabType =
  | 'chat'
  | 'tasks'
  | 'reminders'
  | 'memory'
  | 'schedules'
  | 'runs'
  | 'research'
  | 'settings';

interface SidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  pendingApprovalsCount: number;
  isConnected: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  pendingApprovalsCount,
  isConnected,
}) => {
  const navItems = [
    {
      id: 'chat' as TabType,
      label: 'Assistant Chat',
      icon: MessageSquare,
      badge: pendingApprovalsCount > 0 ? `${pendingApprovalsCount}` : null,
      badgeVariant: 'warning' as const,
      description: 'AI conversation & approvals',
    },
    {
      id: 'tasks' as TabType,
      label: 'Tasks Board',
      icon: CheckSquare,
      description: 'Goals & task tracking',
    },
    {
      id: 'reminders' as TabType,
      label: 'Reminders',
      icon: Bell,
      description: 'Scheduled alerts',
    },
    {
      id: 'memory' as TabType,
      label: 'Memory Bank',
      icon: Brain,
      description: 'Long-term context',
    },
    {
      id: 'schedules' as TabType,
      label: 'Automations',
      icon: Clock,
      description: 'Recurring jobs',
    },
    {
      id: 'runs' as TabType,
      label: 'Run History',
      icon: History,
      description: 'Execution audit log',
    },
    {
      id: 'research' as TabType,
      label: 'Web & Browser',
      icon: Globe,
      description: 'Search & automation',
    },
    {
      id: 'settings' as TabType,
      label: 'System & Policy',
      icon: Settings,
      description: 'Config & security',
    },
  ];

  const coreItems = navItems.slice(0, 5);
  const toolItems = navItems.slice(5);

  return (
    <aside className="w-[260px] h-screen flex flex-col border-r border-white/[0.06] bg-[#060910]/95 backdrop-blur-2xl select-none shrink-0 z-20 relative">
      {/* Subtle inner glow on left edge */}
      <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-indigo-500/20 to-transparent pointer-events-none" />

      {/* Brand Header */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center gap-3">
          {/* Logo with animated glow */}
          <div className="relative">
            <div className="absolute inset-0 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 blur-md opacity-60" />
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 shadow-lg shadow-indigo-500/30">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-black text-[15px] tracking-tight text-white font-['Outfit',sans-serif]">
                NOVA AI
              </span>
              <span className="text-[9px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded-md bg-indigo-500/15 text-indigo-400 border border-indigo-500/25">
                v1.0
              </span>
            </div>
            <span className="text-[11px] text-slate-500 font-medium">Autonomous Platform</span>
          </div>
        </div>
      </div>

      {/* Search / Divider */}
      <div className="px-3 pb-3">
        <div className="h-px bg-gradient-to-r from-transparent via-white/8 to-transparent" />
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-5 no-scrollbar">
        {/* Core Workspace */}
        <div>
          <div className="px-2 mb-2 flex items-center gap-2">
            <div className="text-[10px] font-bold tracking-[0.12em] text-slate-500 uppercase">Core Workspace</div>
            <div className="flex-1 h-px bg-white/5" />
          </div>
          <nav className="space-y-0.5">
            {coreItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group text-left cursor-pointer relative overflow-hidden',
                    isActive
                      ? 'bg-indigo-500/12 text-indigo-200 border border-indigo-500/25'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent'
                  )}
                >
                  {/* Active indicator bar */}
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-gradient-to-b from-indigo-400 to-purple-500 rounded-r-full" />
                  )}

                  <div className={cn(
                    "flex items-center justify-center w-7 h-7 rounded-lg transition-all duration-150 shrink-0",
                    isActive
                      ? "bg-indigo-500/20 text-indigo-300"
                      : "bg-white/5 text-slate-500 group-hover:bg-white/8 group-hover:text-slate-300"
                  )}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="leading-none text-[13px]">{item.label}</div>
                    {isActive && item.description && (
                      <div className="text-[10px] text-indigo-400/70 mt-0.5 leading-none">{item.description}</div>
                    )}
                  </div>

                  {item.badge ? (
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-bold shrink-0">
                      {item.badge}
                    </span>
                  ) : (
                    isActive && <ChevronRight className="w-3 h-3 text-indigo-400/60 shrink-0" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Intelligence & Tools */}
        <div>
          <div className="px-2 mb-2 flex items-center gap-2">
            <div className="text-[10px] font-bold tracking-[0.12em] text-slate-500 uppercase">Intelligence</div>
            <div className="flex-1 h-px bg-white/5" />
          </div>
          <nav className="space-y-0.5">
            {toolItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group text-left cursor-pointer relative overflow-hidden',
                    isActive
                      ? 'bg-indigo-500/12 text-indigo-200 border border-indigo-500/25'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent'
                  )}
                >
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-gradient-to-b from-indigo-400 to-purple-500 rounded-r-full" />
                  )}

                  <div className={cn(
                    "flex items-center justify-center w-7 h-7 rounded-lg transition-all duration-150 shrink-0",
                    isActive
                      ? "bg-indigo-500/20 text-indigo-300"
                      : "bg-white/5 text-slate-500 group-hover:bg-white/8 group-hover:text-slate-300"
                  )}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="leading-none text-[13px]">{item.label}</div>
                    {isActive && item.description && (
                      <div className="text-[10px] text-indigo-400/70 mt-0.5 leading-none">{item.description}</div>
                    )}
                  </div>

                  {isActive && <ChevronRight className="w-3 h-3 text-indigo-400/60 shrink-0" />}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-white/[0.05]">
        {/* Divider gradient */}
        <div className="h-px bg-gradient-to-r from-transparent via-white/8 to-transparent mb-3" />

        <div className="flex items-center justify-between gap-2 px-2 py-2 rounded-xl hover:bg-white/[0.03] transition-colors group cursor-default">
          <div className="flex items-center gap-2.5">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 via-indigo-500 to-purple-600 flex items-center justify-center font-bold text-xs text-white shadow-sm">
                U
              </div>
              <span className={cn(
                "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#060910]",
                isConnected ? "bg-emerald-400" : "bg-rose-400"
              )} />
            </div>

            <div className="min-w-0">
              <div className="text-[12px] font-semibold text-slate-200 truncate leading-none mb-0.5">cli-user</div>
              <div className="text-[10px] text-slate-500 leading-none">
                {isConnected ? 'Socket Connected' : 'Reconnecting...'}
              </div>
            </div>
          </div>

          {pendingApprovalsCount > 0 && (
            <button
              onClick={() => setActiveTab('chat')}
              className="flex items-center justify-center w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 transition-all cursor-pointer"
              title={`${pendingApprovalsCount} authorization needed`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};
