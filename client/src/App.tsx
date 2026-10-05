import React, { useState, useEffect } from "react";
import { Sidebar, type TabType } from "./components/Sidebar";
import { ChatView } from "./components/ChatView";
import { TasksView } from "./components/TasksView";
import { RemindersView } from "./components/RemindersView";
import { MemoryView } from "./components/MemoryView";
import { SchedulesView } from "./components/SchedulesView";
import { RunsView } from "./components/RunsView";
import { ResearchView } from "./components/ResearchView";
import { SettingsView } from "./components/SettingsView";
import { IntegrationsView } from "./components/IntegrationsView";
import { AnalyticsView } from "./components/AnalyticsView";
import { LoginPage } from "./components/LoginPage";
import { ThemeToggle } from "./components/ThemeToggle";
import { ModelPicker } from "./components/ModelPicker";
import { socketClient } from "./services/socket";
import { useSession, signOut } from "./lib/auth-client";
import { ShieldAlert, LogIn, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>("chat");
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState<number>(0);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);

  // Better Auth session hook
  const { data: sessionData } = useSession();
  const currentUser = sessionData?.user || null;

  useEffect(() => {
    const userId = currentUser?.id || "cli-user";
    const socket = socketClient.connect(userId);
    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);
    socket?.on("connect", handleConnect);
    socket?.on("disconnect", handleDisconnect);
    if (socket?.connected) setIsConnected(true);
    return () => {
      socket?.off("connect", handleConnect);
      socket?.off("disconnect", handleDisconnect);
    };
  }, [currentUser?.id]);

  // When user signs in, signs out, or switches accounts, reset active chat session
  useEffect(() => {
    setActiveSessionId(null);
  }, [currentUser?.id]);

  const getPageTitle = (tab: TabType) => {
    const map: Record<TabType, string> = {
      chat: "Autonomous Assistant",
      tasks: "Tasks & Goals",
      reminders: "Reminders",
      memory: "Memory Bank",
      schedules: "Automated Schedulers",
      runs: "Execution Runs",
      research: "Web & Browser",
      integrations: "Integrations Hub",
      analytics: "Analytics & Observability",
      settings: "System & Policy",
    };
    return map[tab];
  };

  const getPageSubtitle = (tab: TabType) => {
    const map: Record<TabType, string> = {
      chat: "Interactive conversational agent with persistent sessions and safety approvals",
      tasks: "Manage goals, track execution progress and organize priorities",
      reminders: "Time-based automated reminders and proactive notifications",
      memory: "Long-term associative knowledge bank and user preferences",
      schedules: "Recurring jobs, cron schedules, and periodic agent actions",
      runs: "Audit logs, execution traces, token usage, and latency metrics",
      research:
        "Automated web research, headless browser navigation, and content extraction",
      integrations:
        "Connect Nova to GitHub, Slack, Discord, Notion, Telegram, or build custom REST/Webhook integrations",
      analytics:
        "Deep execution traces, token consumption velocity, tool latency, and agent complexity",
      settings: "System diagnostics, security policies, and tool configuration",
    };
    return map[tab];
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        pendingApprovalsCount={pendingApprovalsCount}
        isConnected={isConnected}
        currentUser={currentUser}
        onOpenLogin={() => setShowLoginModal(true)}
        onSignOut={() => signOut()}
      />

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Minimal Professional Topbar */}
        <header className="h-14 px-6 border-b border-border bg-card/80 backdrop-blur-md flex items-center justify-between shrink-0 z-10">
          {/* Left: Page Title & Breadcrumb */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Nova
                </span>
                <span className="text-xs text-muted-foreground">/</span>
                <h1 className="text-sm font-semibold text-foreground tracking-tight">
                  {getPageTitle(activeTab)}
                </h1>
              </div>
              <p className="text-xs text-muted-foreground hidden lg:block truncate max-w-[500px]">
                {getPageSubtitle(activeTab)}
              </p>
            </div>
          </div>

          {/* Right: Status Indicators & Controls */}
          <div className="flex items-center gap-2">
            {/* Interactive Multi-Model Picker */}
            <ModelPicker />

            {/* Approval alert if pending */}
            {pendingApprovalsCount > 0 ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setActiveTab("chat")}
                className="h-8 gap-1.5 px-2.5 text-xs font-semibold"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>{pendingApprovalsCount} Approval Needed</span>
              </Button>
            ) : (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-secondary text-secondary-foreground text-xs font-medium border border-border">
                <span
                  className={cn(
                    "w-2 h-2 rounded-full",
                    isConnected ? "bg-emerald-500" : "bg-rose-500",
                  )}
                />
                <span className="text-xs">
                  {isConnected ? "Online" : "Offline"}
                </span>
              </div>
            )}

            {/* User Session Badge / Sign In Button */}
            {currentUser ? (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-secondary text-secondary-foreground text-xs font-medium border border-border">
                <Avatar
                  size="sm"
                  className="w-5 h-5 text-[10px] bg-primary text-primary-foreground font-semibold"
                >
                  {currentUser.name ? currentUser.name[0].toUpperCase() : "U"}
                </Avatar>
                <span className="truncate max-w-[120px] hidden md:inline text-xs">
                  {currentUser.name || currentUser.email}
                </span>
                <button
                  onClick={() => signOut()}
                  className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-rose-500 transition-colors cursor-pointer"
                  title="Sign Out"
                >
                  <LogOut className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowLoginModal(true)}
                className="h-8 gap-1.5 px-2.5 text-xs font-semibold shadow-2xs cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </Button>
            )}

            {/* Theme Switcher */}
            <div className="border-l border-border pl-2 ml-1">
              <ThemeToggle />
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-background">
          {activeTab === "chat" ? (
            <div className="flex-1 w-full h-full min-h-0 flex flex-col overflow-hidden">
              <ChatView
                key={currentUser?.id || "guest"}
                onPendingCountChange={setPendingApprovalsCount}
                activeSessionId={activeSessionId}
                onSessionChange={setActiveSessionId}
              />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 mx-auto w-full max-w-7xl">
              {activeTab === "tasks" && <TasksView />}
              {activeTab === "reminders" && <RemindersView />}
              {activeTab === "memory" && <MemoryView />}
              {activeTab === "schedules" && <SchedulesView />}
              {activeTab === "runs" && <RunsView />}
              {activeTab === "research" && <ResearchView />}
              {activeTab === "integrations" && <IntegrationsView />}
              {activeTab === "analytics" && <AnalyticsView />}
              {activeTab === "settings" && <SettingsView />}
            </div>
          )}
        </main>
      </div>

      {/* Better Auth Login / Registration Modal */}
      {showLoginModal && (
        <LoginPage
          isModal={true}
          onClose={() => setShowLoginModal(false)}
          onSuccess={() => setShowLoginModal(false)}
        />
      )}
    </div>
  );
};

export default App;
