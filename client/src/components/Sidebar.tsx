import {
  MessageSquare,
  CheckSquare,
  Bell,
  Brain,
  Clock,
  History,
  Globe,
  Settings,
  Bot,
  ShieldAlert,
  ChevronRight,
  LogIn,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";

export type TabType =
  | "chat"
  | "tasks"
  | "reminders"
  | "memory"
  | "schedules"
  | "runs"
  | "research"
  | "settings";

interface SidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  pendingApprovalsCount: number;
  isConnected: boolean;
  currentUser?: { name?: string; email?: string } | null;
  onOpenLogin?: () => void;
  onSignOut?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  pendingApprovalsCount,
  isConnected,
  currentUser,
  onOpenLogin,
  onSignOut,
}) => {
  const navItems = [
    {
      id: "chat" as TabType,
      label: "Assistant Chat",
      icon: MessageSquare,
      badge: pendingApprovalsCount > 0 ? `${pendingApprovalsCount}` : null,
      badgeVariant: "warning" as const,
      group: "Core",
    },
    {
      id: "tasks" as TabType,
      label: "Tasks Board",
      icon: CheckSquare,
      group: "Core",
    },
    {
      id: "reminders" as TabType,
      label: "Reminders",
      icon: Bell,
      group: "Core",
    },
    {
      id: "memory" as TabType,
      label: "Memory Bank",
      icon: Brain,
      group: "Core",
    },
    {
      id: "schedules" as TabType,
      label: "Automations",
      icon: Clock,
      group: "Operations",
    },
    {
      id: "runs" as TabType,
      label: "Run History",
      icon: History,
      group: "Operations",
    },
    {
      id: "research" as TabType,
      label: "Web & Browser",
      icon: Globe,
      group: "Operations",
    },
    {
      id: "settings" as TabType,
      label: "System & Policy",
      icon: Settings,
      group: "Operations",
    },
  ];

  const coreItems = navItems.filter((i) => i.group === "Core");
  const operationItems = navItems.filter((i) => i.group === "Operations");

  return (
    <aside className="w-60 h-screen flex flex-col border-r border-border bg-card text-card-foreground select-none shrink-0 z-20">
      {/* Brand Header */}
      <div className="h-14 px-4 flex items-center gap-3 border-b border-border">
        <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary text-primary-foreground font-bold shadow-xs">
          <Bot className="w-4 h-4" />
        </div>
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm tracking-tight text-foreground">
              Nova AI
            </span>
            <Badge
              variant="secondary"
              className="text-[10px] px-1 py-0 h-4 font-normal"
            >
              v1.0
            </Badge>
          </div>
          <span className="text-[11px] text-muted-foreground truncate">
            Autonomous Agent
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6 no-scrollbar">
        {/* Core Group */}
        <div>
          <div className="px-2 mb-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Workspace
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
                    "w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer text-left",
                    isActive
                      ? "bg-secondary text-foreground font-semibold shadow-2xs"
                      : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon
                      className={cn(
                        "w-4 h-4 shrink-0",
                        isActive ? "text-foreground" : "text-muted-foreground",
                      )}
                    />
                    <span className="truncate">{item.label}</span>
                  </div>

                  {item.badge ? (
                    <Badge
                      variant="warning"
                      className="text-[10px] px-1.5 py-0 h-4 font-semibold"
                    >
                      {item.badge}
                    </Badge>
                  ) : (
                    isActive && (
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                    )
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Operations Group */}
        <div>
          <div className="px-2 mb-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Operations
          </div>
          <nav className="space-y-0.5">
            {operationItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={cn(
                    "w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer text-left",
                    isActive
                      ? "bg-secondary text-foreground font-semibold shadow-2xs"
                      : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon
                      className={cn(
                        "w-4 h-4 shrink-0",
                        isActive ? "text-foreground" : "text-muted-foreground",
                      )}
                    />
                    <span className="truncate">{item.label}</span>
                  </div>

                  {isActive && (
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* User Status Footer */}
      <div className="p-3 border-t border-border">
        <div className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md bg-muted/40">
          <div
            onClick={!currentUser ? onOpenLogin : undefined}
            className={cn(
              "flex items-center gap-2.5 min-w-0 flex-1",
              !currentUser && "cursor-pointer hover:opacity-85",
            )}
          >
            <div className="relative shrink-0">
              <Avatar
                size="sm"
                className="bg-primary text-primary-foreground font-semibold"
              >
                {currentUser?.name ? currentUser.name[0].toUpperCase() : "U"}
              </Avatar>
              <span
                className={cn(
                  "absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-card",
                  isConnected ? "bg-emerald-500" : "bg-rose-500",
                )}
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-foreground truncate">
                {currentUser?.name ||
                  (currentUser?.email
                    ? currentUser.email.split("@")[0]
                    : "cli-user")}
              </div>
              <div className="text-[10px] text-muted-foreground truncate">
                {currentUser
                  ? currentUser.email || "Better Auth"
                  : isConnected
                    ? "Online · Sign In"
                    : "Disconnected"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {currentUser ? (
              <button
                onClick={onSignOut}
                className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-rose-500 transition-colors cursor-pointer"
                title="Sign out of Nova"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={onOpenLogin}
                className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                title="Sign in with Better Auth"
              >
                <LogIn className="w-3.5 h-3.5" />
              </button>
            )}

            {pendingApprovalsCount > 0 && (
              <button
                onClick={() => setActiveTab("chat")}
                className="flex items-center justify-center w-6 h-6 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25 transition-colors cursor-pointer"
                title={`${pendingApprovalsCount} authorization needed`}
              >
                <ShieldAlert className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};
