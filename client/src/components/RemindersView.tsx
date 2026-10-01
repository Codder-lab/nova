import React, { useState, useEffect } from "react";
import {
  Bell,
  Plus,
  Trash2,
  Clock,
  Loader2,
  Ban,
  Calendar,
} from "lucide-react";
import { api } from "../services/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export const RemindersView: React.FC = () => {
  const [reminders, setReminders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const [title, setTitle] = useState("");
  const [remindAt, setRemindAt] = useState("");
  const [description, setDescription] = useState("");

  const loadReminders = async () => {
    setLoading(true);
    try {
      const res = await api.listReminders();
      if (res.reminders) {
        setReminders(res.reminders);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReminders();
  }, []);

  const handleCancel = async (id: string) => {
    try {
      await api.cancelReminder(id);
      loadReminders();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    setReminders((prev) => prev.filter((r) => r.id !== id));
    try {
      await api.deleteReminder(id);
    } catch (err) {
      loadReminders();
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !remindAt) return;

    try {
      await api.createReminder({
        title: title.trim(),
        remindAt: new Date(remindAt).toISOString(),
        description: description.trim() || undefined,
      });
      setShowModal(false);
      setTitle("");
      setRemindAt("");
      setDescription("");
      loadReminders();
    } catch (err: any) {
      alert(`Failed to create reminder: ${err.message}`);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "scheduled":
        return (
          <Badge variant="warning" className="text-[10px] px-1.5 py-0">
            Scheduled
          </Badge>
        );
      case "sent":
        return (
          <Badge variant="success" className="text-[10px] px-1.5 py-0">
            Sent
          </Badge>
        );
      case "cancelled":
        return (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            Cancelled
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {status}
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Bell className="w-5 h-5 text-foreground" />
            <h2 className="text-lg font-semibold text-foreground tracking-tight">
              Scheduled Reminders
            </h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Automated alerts, timed tasks, and scheduled notifications.
          </p>
        </div>

        <Button
          onClick={() => setShowModal(true)}
          size="sm"
          className="shrink-0 h-9"
        >
          <Plus className="w-4 h-4 mr-1.5" /> New Reminder
        </Button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mb-2" />
          <span className="text-xs">Loading reminders...</span>
        </div>
      ) : reminders.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-14 text-center border-dashed bg-card/50">
          <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center mb-3">
            <Bell className="w-5 h-5 text-muted-foreground" />
          </div>
          <h3 className="text-sm font-semibold text-foreground mb-1">
            No reminders scheduled
          </h3>
          <p className="text-xs text-muted-foreground max-w-xs mb-4">
            Create a reminder or ask Nova in chat to remind you at a specific
            time.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowModal(true)}
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Add Reminder
          </Button>
        </Card>
      ) : (
        <div className="space-y-2">
          {reminders.map((r) => (
            <div
              key={r.id}
              className="p-3.5 rounded-md border border-border bg-card hover:bg-muted/30 flex items-center justify-between gap-4 transition-colors"
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className="p-2 rounded-md bg-secondary text-secondary-foreground mt-0.5 shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-medium text-foreground truncate">
                    {r.title}
                  </div>
                  {r.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                      {r.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1 font-medium">
                      <Calendar className="w-3 h-3" />
                      {new Date(r.remindAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {getStatusBadge(r.status)}
                {r.status === "scheduled" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => handleCancel(r.id)}
                    title="Cancel reminder"
                  >
                    <Ban className="w-3.5 h-3.5 mr-1" /> Cancel
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md"
                  onClick={() => handleDelete(r.id)}
                  title="Delete reminder"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Dialog */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogHeader>
          <DialogTitle onClose={() => setShowModal(false)}>
            Create Reminder
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleCreate} className="space-y-3.5 pt-2">
          <div>
            <label className="text-xs font-medium text-foreground block mb-1">
              Title *
            </label>
            <Input
              type="text"
              required
              placeholder="e.g. Follow up on database migration"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs font-medium text-foreground block mb-1">
              Trigger Date & Time *
            </label>
            <Input
              type="datetime-local"
              required
              value={remindAt}
              onChange={(e) => setRemindAt(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-foreground block mb-1">
              Description (optional)
            </label>
            <Textarea
              rows={2}
              placeholder="Context or notes..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
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
              Save Reminder
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  );
};
