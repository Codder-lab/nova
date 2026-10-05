import React, { useState, useEffect } from "react";
import {
  Clock,
  Plus,
  Trash2,
  Loader2,
  Calendar,
  Globe,
  Sparkles,
} from "lucide-react";
import { api } from "../services/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export const SchedulesView: React.FC = () => {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const [prompt, setPrompt] = useState("");
  const [scheduleExpr, setScheduleExpr] = useState("daily at 9am");
  const [timezone, setTimezone] = useState("UTC");

  const loadSchedules = async () => {
    setLoading(true);
    try {
      const res = await api.listSchedules();
      if (res.schedules) {
        setSchedules(res.schedules);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchedules();
  }, []);

  const handleToggle = async (id: string, currentEnabled: boolean) => {
    setSchedules((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !currentEnabled } : s)),
    );
    try {
      await api.toggleSchedule(id, !currentEnabled);
    } catch (err) {
      loadSchedules();
    }
  };

  const handleDelete = async (id: string) => {
    setSchedules((prev) => prev.filter((s) => s.id !== id));
    try {
      await api.deleteSchedule(id);
    } catch (err) {
      loadSchedules();
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || !scheduleExpr.trim()) return;

    try {
      await api.createSchedule({
        prompt: prompt.trim(),
        schedule: scheduleExpr.trim(),
        timezone,
      });

      setShowModal(false);
      setPrompt("");
      setScheduleExpr("daily at 9am");
      loadSchedules();
    } catch (err: any) {
      alert(`Failed to create schedule: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-5 h-5 text-foreground" />
            <h2 className="text-lg font-semibold text-foreground tracking-tight">
              Automated Schedulers
            </h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Background jobs, recurring cron tasks, and automated triggers.
          </p>
        </div>

        <Button
          onClick={() => setShowModal(true)}
          size="sm"
          className="shrink-0 h-9"
        >
          <Plus className="w-4 h-4 mr-1.5" /> New Automation
        </Button>
      </div>

      {/* Schedules List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mb-2" />
          <span className="text-xs">Loading schedules...</span>
        </div>
      ) : schedules.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-14 text-center border-dashed bg-card/50">
          <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center mb-3">
            <Clock className="w-5 h-5 text-muted-foreground" />
          </div>
          <h3 className="text-sm font-semibold text-foreground mb-1">
            No automations scheduled
          </h3>
          <p className="text-xs text-muted-foreground max-w-xs mb-4">
            Set up daily metrics summaries, scheduled research, or automated
            reminders.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowModal(true)}
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Add Automation
          </Button>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {schedules.map((s) => (
            <Card
              key={s.id}
              className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 border border-border bg-card hover:bg-muted/30 transition-colors"
            >
              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="text-xs sm:text-sm font-medium text-foreground">
                    "{s.prompt}"
                  </div>
                  <Badge
                    variant={s.enabled ? "success" : "secondary"}
                    className="text-[10px] px-1.5 py-0"
                  >
                    {s.enabled ? "Active" : "Paused"}
                  </Badge>
                </div>

                <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1 font-mono text-[11px] text-foreground">
                    <Clock className="w-3 h-3 text-muted-foreground" />{" "}
                    {s.schedule}
                  </span>
                  <span className="flex items-center gap-1">
                    <Globe className="w-3 h-3 text-muted-foreground" />{" "}
                    {s.timezone || "UTC"}
                  </span>
                  {s.nextRunAt && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-muted-foreground" />{" "}
                      Next: {new Date(s.nextRunAt).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0 self-end md:self-center pt-2 md:pt-0">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={s.enabled}
                    onCheckedChange={() => handleToggle(s.id, s.enabled)}
                  />
                  <span className="text-xs text-muted-foreground">
                    {s.enabled ? "Active" : "Paused"}
                  </span>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md"
                  onClick={() => handleDelete(s.id)}
                  title="Delete schedule"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal Dialog */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogHeader>
          <DialogTitle onClose={() => setShowModal(false)}>
            Create Automation Schedule
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleCreate} className="space-y-3.5 pt-2">
          <div>
            <label className="text-xs font-medium text-foreground block mb-1">
              Goal / Prompt for Autonomous Agent *
            </label>
            <Textarea
              rows={2}
              required
              placeholder="e.g. Check system metrics and summarize database growth"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">
                Recurrence / Cron *
              </label>
              <Input
                type="text"
                required
                placeholder="daily at 9am, every 2 hours"
                value={scheduleExpr}
                onChange={(e) => setScheduleExpr(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-foreground block mb-1">
                Timezone
              </label>
              <select
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs text-foreground shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              >
                <option value="UTC">UTC</option>
                <option value="America/New_York">America/New_York (EST)</option>
                <option value="America/Los_Angeles">
                  America/Los_Angeles (PST)
                </option>
                <option value="Europe/London">Europe/London (GMT)</option>
                <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
              </select>
            </div>
          </div>

          <div className="p-2.5 rounded-md bg-muted border border-border text-xs text-muted-foreground flex items-center gap-2">
            <Sparkles className="w-4 h-4 shrink-0 text-foreground" />
            <span>
              Nova parses natural language intervals (e.g., "every 30m", "daily
              at 10:00") into standard cron syntax automatically.
            </span>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm">
              Register Automation
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  );
};
