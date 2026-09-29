import React, { useState, useEffect } from 'react';
import { Sidebar, type TabType } from './components/Sidebar';
import { ChatView } from './components/ChatView';
import { TasksView } from './components/TasksView';
import { RemindersView } from './components/RemindersView';
import { MemoryView } from './components/MemoryView';
import { SchedulesView } from './components/SchedulesView';
import { RunsView } from './components/RunsView';
import { ResearchView } from './components/ResearchView';
import { SettingsView } from './components/SettingsView';
import { socketClient } from './services/socket';
import { ShieldAlert, Cpu, Wifi, WifiOff } from 'lucide-react';

import { cn } from '@/lib/utils';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('chat');
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState<number>(0);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  useEffect(() => {
    const socket = socketClient.connect('cli-user');
    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);
    socket?.on('connect', handleConnect);
    socket?.on('disconnect', handleDisconnect);
    if (socket?.connected) setIsConnected(true);
    return () => {
      socket?.off('connect', handleConnect);
      socket?.off('disconnect', handleDisconnect);
    };
  }, []);

  const getPageTitle = (tab: TabType) => {
    const map: Record<TabType, string> = {
      chat: 'Autonomous Assistant',
      tasks: 'Tasks & Goals',
      reminders: 'Scheduled Reminders',
      memory: 'Long-Term Memory Bank',
      schedules: 'Automated Schedulers',
      runs: 'Agent Runs History',
      research: 'Web & Browser Automation',
      settings: 'System & Policies',
    };
    return map[tab];
  };

  const getPageSubtitle = (tab: TabType) => {
    const map: Record<TabType, string> = {
      chat: 'Conversational agent with tool orchestration and human-in-the-loop approvals',
      tasks: 'Persistent MongoDB Atlas task tracker with multi-criteria filters and AI assistance',
      reminders: 'Time-aware scheduling with automated agent-triggered and manual alerts',
      memory: 'Associative semantic memories and user preference store for persistent context',
      schedules: 'Background cron expressions & natural language recurrence automation engine',
      runs: 'Audit logging, token metrics, step traces and execution timeline persistence',
      research: 'Autonomous Playwright web automation, DuckDuckGo search & live screenshots',
      settings: 'Permission rules, policy guards, LLM configurations and tool registry',
    };
    return map[tab];
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#070a13] text-slate-100 dot-grid">
      {/* Ambient background gradients */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-[600px] h-[400px] bg-indigo-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[400px] bg-purple-600/8 rounded-full blur-[100px]" />
        <div className="absolute top-1/2 left-0 w-[300px] h-[300px] bg-cyan-600/5 rounded-full blur-[80px]" />
      </div>

      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        pendingApprovalsCount={pendingApprovalsCount}
        isConnected={isConnected}
      />

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative z-10">
        {/* Premium Topbar */}
        <header className="h-[60px] px-8 border-b border-white/[0.06] bg-slate-950/70 backdrop-blur-2xl flex items-center justify-between shrink-0 relative">
          {/* Left: Page Info */}
          <div className="flex flex-col justify-center">
            <h1 className="text-[15px] font-bold text-white tracking-tight font-['Outfit',sans-serif] leading-none mb-0.5">
              {getPageTitle(activeTab)}
            </h1>
            <p className="text-[11px] text-slate-400 hidden md:block truncate max-w-[500px] leading-none">
              {getPageSubtitle(activeTab)}
            </p>
          </div>

          {/* Right: Status indicators */}
          <div className="flex items-center gap-2.5">
            {/* Model chip */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-white/[0.07] text-xs font-medium text-slate-300">
              <Cpu className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span className="hidden sm:inline">Ollama</span>
              <span className="font-mono text-indigo-300 text-[11px]">qwen2.5:7b</span>
            </div>

            {/* Connection status */}
            {pendingApprovalsCount > 0 ? (
              <button
                onClick={() => setActiveTab('chat')}
                className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold hover:bg-amber-500/15 transition-all animate-pulse"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>{pendingApprovalsCount} Approval</span>
              </button>
            ) : (
              <div className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all",
                isConnected
                  ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-300"
                  : "bg-rose-500/10 border-rose-500/25 text-rose-300"
              )}>
                {isConnected ? (
                  <Wifi className="w-3.5 h-3.5" />
                ) : (
                  <WifiOff className="w-3.5 h-3.5" />
                )}
                <span>{isConnected ? 'Live' : 'Offline'}</span>
                {isConnected && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                )}
              </div>
            )}
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto relative">
          <div className={cn(
            "p-8 mx-auto",
            activeTab === 'chat' ? "h-full flex flex-col max-w-5xl" : "max-w-7xl"
          )}>
            {activeTab === 'chat' && (
              <ChatView onPendingCountChange={setPendingApprovalsCount} />
            )}
            {activeTab === 'tasks' && <TasksView />}
            {activeTab === 'reminders' && <RemindersView />}
            {activeTab === 'memory' && <MemoryView />}
            {activeTab === 'schedules' && <SchedulesView />}
            {activeTab === 'runs' && <RunsView />}
            {activeTab === 'research' && <ResearchView />}
            {activeTab === 'settings' && <SettingsView />}
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
