import React, { useState, useEffect } from "react";
import type { HydratedBot, BotTone } from "@nova/shared";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/services/api";
import {
  Sparkles,
  CheckSquare,
  Search,
  PenTool,
  RotateCcw,
  Save,
  Loader2,
  Sliders,
  Check,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface BotCustomizeModalProps {
  bot: HydratedBot | null;
  isOpen: boolean;
  onClose: () => void;
  onBotUpdated: (updated: HydratedBot) => void;
}

const TONE_OPTIONS: { id: BotTone; label: string; desc: string; icon: string }[] = [
  { id: "default", label: "Default", desc: "Balanced and natural style", icon: "⚡" },
  { id: "concise", label: "Concise", desc: "Short, bulleted, action-focused", icon: "🎯" },
  { id: "friendly", label: "Friendly", desc: "Warm, engaging, supportive", icon: "😊" },
  { id: "formal", label: "Formal", desc: "Executive and business phrasing", icon: "👔" },
  { id: "analytical", label: "Analytical", desc: "Thorough, structured, logic-first", icon: "🔬" },
];

const TOOL_FRIENDLY_NAMES: Record<string, { label: string; desc: string }> = {
  get_current_time: { label: "System Clock & Time", desc: "Checks timezones and timestamps" },
  calculate: { label: "Math & Calculator", desc: "Calculates expressions and numbers" },
  create_task: { label: "Create Tasks", desc: "Adds items to your tasks board" },
  list_tasks: { label: "View Tasks", desc: "Retrieves tasks and status" },
  update_task: { label: "Edit Tasks", desc: "Modifies task priority or due dates" },
  complete_task: { label: "Complete Tasks", desc: "Marks action items as finished" },
  delete_task: { label: "Delete Tasks", desc: "Removes tasks from the board" },
  create_reminder: { label: "Set Reminders", desc: "Schedules automated alert notifications" },
  list_reminders: { label: "View Reminders", desc: "Checks pending alarms" },
  cancel_reminder: { label: "Cancel Reminders", desc: "Dismisses active reminders" },
  create_schedule: { label: "Create Automations", desc: "Sets up cron automation routines" },
  list_schedules: { label: "View Automations", desc: "Lists recurring background tasks" },
  cancel_schedule: { label: "Cancel Automations", desc: "Disables scheduled jobs" },
  web_search: { label: "Live Web Search", desc: "Searches real-time internet data" },
  fetch_web_page: { label: "Fetch Web Pages", desc: "Extracts readable text from URLs" },
  open_browser: { label: "Browser Automation", desc: "Controls browser for live web pages" },
  navigate_to: { label: "Web Navigation", desc: "Navigates between web pages" },
  extract_page_content: { label: "Extract Web Content", desc: "Scrapes web structures and data" },
  save_memory: { label: "Save to Memory", desc: "Stores notes into the Memory Bank" },
  recall_memory: { label: "Recall Memory", desc: "Finds past notes and user facts" },
  list_memories: { label: "View Memory Bank", desc: "Browse saved memory items" },
  list_files: { label: "List Workspace Files", desc: "Inspects local file tree" },
  read_file: { label: "Read Workspace Files", desc: "Reads source code and documents" },
  create_file: { label: "Create Files", desc: "Writes new files into workspace" },
};

function getBotIcon(slug: string) {
  switch (slug) {
    case "nova-taskmaster":
      return <CheckSquare className="w-5 h-5 text-emerald-500" />;
    case "nova-scout":
      return <Search className="w-5 h-5 text-blue-500" />;
    case "nova-scribe":
      return <PenTool className="w-5 h-5 text-purple-500" />;
    default:
      return <Sparkles className="w-5 h-5 text-indigo-500" />;
  }
}

export const BotCustomizeModal: React.FC<BotCustomizeModalProps> = ({
  bot,
  isOpen,
  onClose,
  onBotUpdated,
}) => {
  if (!bot) return null;

  const [tone, setTone] = useState<BotTone>(bot.userPreference.tone || "default");
  const [customInstructions, setCustomInstructions] = useState(
    bot.userPreference.customInstructions || "",
  );
  const [enabledTools, setEnabledTools] = useState<string[]>(
    bot.userPreference.enabledTools || bot.availableTools,
  );
  const [temperature, setTemperature] = useState<number>(
    bot.userPreference.temperature ?? 0.2,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (bot) {
      setTone(bot.userPreference.tone || "default");
      setCustomInstructions(bot.userPreference.customInstructions || "");
      setEnabledTools(bot.userPreference.enabledTools || bot.availableTools);
      setTemperature(bot.userPreference.temperature ?? 0.2);
      setSaveSuccess(false);
    }
  }, [bot, isOpen]);

  const handleToggleTool = (toolName: string) => {
    setEnabledTools((prev) =>
      prev.includes(toolName)
        ? prev.filter((t) => t !== toolName)
        : [...prev, toolName],
    );
  };

  const handleSelectAllTools = () => {
    setEnabledTools([...bot.availableTools]);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await api.updateBotPreferences(bot.slug, {
        tone,
        customInstructions,
        enabledTools,
        temperature,
      });
      if (res?.bot) {
        onBotUpdated(res.bot);
        setSaveSuccess(true);
        setTimeout(() => {
          setSaveSuccess(false);
          onClose();
        }, 600);
      }
    } catch (err) {
      console.error("Failed saving bot preferences:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    setIsResetting(true);
    try {
      const res = await api.resetBotPreferences(bot.slug);
      if (res?.bot) {
        onBotUpdated(res.bot);
        setTone(res.bot.userPreference.tone);
        setCustomInstructions(res.bot.userPreference.customInstructions);
        setEnabledTools(res.bot.userPreference.enabledTools);
        setTemperature(res.bot.userPreference.temperature);
      }
    } catch (err) {
      console.error("Failed resetting bot preferences:", err);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <div className="max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b border-border bg-card/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-secondary/80 border border-border">
              {getBotIcon(bot.slug)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <DialogTitle className="text-base font-semibold">
                  Customize {bot.name}
                </DialogTitle>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0.5">
                  Platform Bot
                </Badge>
              </div>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {bot.tagline}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Section 1: Response Tone */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <span>Communication Tone & Style</span>
              </label>
              <span className="text-[11px] text-muted-foreground">
                How this bot formats and phrases responses
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {TONE_OPTIONS.map((opt) => {
                const isSelected = tone === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setTone(opt.id)}
                    className={cn(
                      "p-3 rounded-lg border text-left transition-all cursor-pointer",
                      isSelected
                        ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary/40 shadow-xs"
                        : "border-border bg-card/40 hover:bg-muted/40 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm">{opt.icon}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-primary" />}
                    </div>
                    <div className="text-xs font-semibold">{opt.label}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                      {opt.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Enabled Tools / Skills */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                  <span>Allowed Capabilities & Tools</span>
                </label>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Toggle which approved tools {bot.name} is permitted to execute
                </p>
              </div>

              <button
                type="button"
                onClick={handleSelectAllTools}
                className="text-[11px] text-primary hover:underline cursor-pointer"
              >
                Enable All ({bot.availableTools.length})
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 border rounded-lg border-border bg-muted/20">
              {bot.availableTools.map((toolName) => {
                const info = TOOL_FRIENDLY_NAMES[toolName] || {
                  label: toolName,
                  desc: "Tool capability",
                };
                const isEnabled = enabledTools.includes(toolName);

                return (
                  <label
                    key={toolName}
                    className={cn(
                      "flex items-start gap-2.5 p-2 rounded-md border text-left cursor-pointer transition-colors text-xs",
                      isEnabled
                        ? "border-border/80 bg-card text-foreground"
                        : "border-border/30 bg-muted/10 opacity-50 text-muted-foreground",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={() => handleToggleTool(toolName)}
                      className="mt-0.5 rounded accent-primary cursor-pointer"
                    />
                    <div className="min-w-0">
                      <div className="font-medium text-[11px] truncate">
                        {info.label}
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        {info.desc}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Section 3: Custom Instructions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground">
                Personal Instructions & Guidelines
              </label>
              <span className="text-[10px] text-muted-foreground">
                {customInstructions.length}/1000 characters
              </span>
            </div>
            <textarea
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value.slice(0, 1000))}
              placeholder={`Tell ${bot.name} how you like things done (e.g. "Always respond with markdown checklists", "Our company timezone is EST", "Focus on Node.js and TypeScript")...`}
              rows={3}
              className="w-full text-xs p-3 rounded-lg border border-border bg-background focus:outline-hidden focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground resize-none"
            />
          </div>

          {/* Section 4: Creativity / Temperature */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-primary" />
                <span>Creativity & Precision</span>
              </label>
              <span className="text-[11px] text-muted-foreground font-mono">
                {temperature === 0.1
                  ? "Precise (0.1)"
                  : temperature === 0.3
                  ? "Balanced (0.3)"
                  : temperature >= 0.6
                  ? "Creative (0.7)"
                  : `${temperature}`}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {[
                { val: 0.1, label: "Precise" },
                { val: 0.3, label: "Balanced" },
                { val: 0.7, label: "Creative" },
              ].map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => setTemperature(opt.val)}
                  className={cn(
                    "flex-1 py-1.5 px-3 rounded-md border text-xs font-medium transition-colors cursor-pointer text-center",
                    Math.abs(temperature - opt.val) < 0.05
                      ? "border-primary bg-primary text-primary-foreground shadow-xs"
                      : "border-border bg-card/60 hover:bg-muted text-muted-foreground hover:text-foreground",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="p-4 px-6 border-t border-border bg-card/60 flex items-center justify-between sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleReset}
            disabled={isResetting || isSaving}
            className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
          >
            {isResetting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
            ) : (
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            )}
            Reset to Default
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSaving}
              className="text-xs cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={isSaving || saveSuccess}
              className="text-xs cursor-pointer min-w-[110px]"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  Saving...
                </>
              ) : saveSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
                  Saved!
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </div>
    </Dialog>
  );
};
