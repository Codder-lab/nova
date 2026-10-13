import React, { useState, useEffect, useRef } from "react";
import type { HydratedBot } from "@nova/shared";
import { api } from "@/services/api";
import { BotCustomizeModal } from "./BotCustomizeModal";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  CheckSquare,
  Search,
  PenTool,
  ChevronDown,
  Settings2,
  Check,
  SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface BotPickerProps {
  activeBotSlug?: string;
  onBotChanged?: (bot: HydratedBot) => void;
  className?: string;
}

export function getBotVisual(slug: string) {
  switch (slug) {
    case "nova-taskmaster":
      return {
        icon: CheckSquare,
        color: "text-emerald-500",
        bg: "bg-emerald-500/10",
        border: "border-emerald-500/30",
        badge: "TaskMaster",
        badgeColor: "bg-emerald-500/15 text-emerald-500 border-emerald-500/20",
      };
    case "nova-scout":
      return {
        icon: Search,
        color: "text-blue-500",
        bg: "bg-blue-500/10",
        border: "border-blue-500/30",
        badge: "Scout",
        badgeColor: "bg-blue-500/15 text-blue-500 border-blue-500/20",
      };
    case "nova-scribe":
      return {
        icon: PenTool,
        color: "text-purple-500",
        bg: "bg-purple-500/10",
        border: "border-purple-500/30",
        badge: "Scribe",
        badgeColor: "bg-purple-500/15 text-purple-500 border-purple-500/20",
      };
    default:
      return {
        icon: Sparkles,
        color: "text-indigo-500",
        bg: "bg-indigo-500/10",
        border: "border-indigo-500/30",
        badge: "Core",
        badgeColor: "bg-indigo-500/15 text-indigo-500 border-indigo-500/20",
      };
  }
}

export const BotPicker: React.FC<BotPickerProps> = ({
  activeBotSlug = "nova-core",
  onBotChanged,
  className,
}) => {
  const [bots, setBots] = useState<HydratedBot[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string>(activeBotSlug);
  const [isOpen, setIsOpen] = useState(false);
  const [customizingBot, setCustomizingBot] = useState<HydratedBot | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    api
      .listBots()
      .then((res) => {
        if (mounted && res?.bots && res.bots.length > 0) {
          setBots(res.bots);
          const found = res.bots.find((b) => b.slug === activeBotSlug);
          if (found && onBotChanged) {
            onBotChanged(found);
          }
        }
      })
      .catch((err) => console.error("Failed loading platform bots:", err));

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setSelectedSlug(activeBotSlug);
  }, [activeBotSlug]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isOpen]);

  const activeBot =
    bots.find((b) => b.slug === selectedSlug) ||
    bots[0] ||
    null;

  const visual = getBotVisual(activeBot?.slug || "nova-core");
  const ActiveIcon = visual.icon;

  const handleSelectBot = (bot: HydratedBot) => {
    setSelectedSlug(bot.slug);
    setIsOpen(false);
    if (onBotChanged) onBotChanged(bot);
  };

  const handleBotUpdated = (updated: HydratedBot) => {
    setBots((prev) =>
      prev.map((b) => (b.slug === updated.slug ? updated : b)),
    );
    if (updated.slug === selectedSlug && onBotChanged) {
      onBotChanged(updated);
    }
  };

  return (
    <>
      <div className={cn("relative inline-block text-left", className)} ref={dropdownRef}>
        <div className="flex items-center gap-1">
          {/* Main Bot Selector Trigger */}
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-2 h-7 px-2.5 rounded-md border border-border bg-card/80 hover:bg-muted/80 text-foreground text-xs font-medium transition-colors cursor-pointer shadow-2xs"
            title="Switch Active Platform Bot"
          >
            <div className={cn("p-0.5 rounded-sm shrink-0", visual.color)}>
              <ActiveIcon className="w-3.5 h-3.5" />
            </div>
            <span className="truncate max-w-[120px] font-semibold">
              {activeBot?.name || "Nova Core"}
            </span>
            <ChevronDown className="w-3 h-3 text-muted-foreground ml-0.5 opacity-70" />
          </button>

          {/* Quick Customize Preferences Gear */}
          <button
            type="button"
            onClick={() => setCustomizingBot(activeBot)}
            className="h-7 w-7 flex items-center justify-center rounded-md border border-border bg-card/80 hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title={`Customize ${activeBot?.name || "Bot"} Preferences`}
          >
            <Settings2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute left-0 mt-1.5 w-72 rounded-xl border border-border bg-popover/95 backdrop-blur-md shadow-xl z-50 p-1.5 animate-in fade-in-0 zoom-in-95">
            <div className="px-2 py-1.5 border-b border-border/60 mb-1 flex items-center justify-between">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Platform Bots ({bots.length})
              </span>
              <span className="text-[10px] text-muted-foreground">
                First-Party Curated
              </span>
            </div>

            <div className="space-y-1">
              {bots.map((bot) => {
                const bVisual = getBotVisual(bot.slug);
                const BIcon = bVisual.icon;
                const isSelected = bot.slug === selectedSlug;

                return (
                  <div
                    key={bot.slug}
                    className={cn(
                      "group flex items-center justify-between p-2 rounded-lg text-left transition-colors cursor-pointer",
                      isSelected
                        ? "bg-primary/10 border border-primary/20 text-foreground"
                        : "hover:bg-muted/60 text-muted-foreground hover:text-foreground border border-transparent",
                    )}
                    onClick={() => handleSelectBot(bot)}
                  >
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <div
                        className={cn(
                          "p-1.5 rounded-md shrink-0 mt-0.5",
                          bVisual.bg,
                          bVisual.color,
                        )}
                      >
                        <BIcon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-foreground truncate">
                            {bot.name}
                          </span>
                          {bot.userPreference.tone !== "default" && (
                            <Badge
                              variant="outline"
                              className="text-[9px] px-1 py-0 h-4 capitalize"
                            >
                              {bot.userPreference.tone}
                            </Badge>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground line-clamp-1 leading-snug mt-0.5">
                          {bot.tagline}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCustomizingBot(bot);
                          setIsOpen(false);
                        }}
                        className="p-1 rounded hover:bg-background/80 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        title="Customize Preferences"
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                      </button>
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Preference Customization Modal */}
      <BotCustomizeModal
        bot={customizingBot}
        isOpen={Boolean(customizingBot)}
        onClose={() => setCustomizingBot(null)}
        onBotUpdated={handleBotUpdated}
      />
    </>
  );
};
