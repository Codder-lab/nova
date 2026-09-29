import React, { useState, useEffect } from 'react';
import { Bell, Plus, Trash2, Clock, Loader2, Ban, Calendar } from 'lucide-react';
import { api } from '../services/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

export const RemindersView: React.FC = () => {
  const [reminders, setReminders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const [title, setTitle] = useState('');
  const [remindAt, setRemindAt] = useState('');
  const [description, setDescription] = useState('');

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
      setTitle('');
      setRemindAt('');
      setDescription('');
      loadReminders();
    } catch (err: any) {
      alert(`Failed to create reminder: ${err.message}`);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'scheduled':
        return <Badge variant="warning">Scheduled</Badge>;
      case 'sent':
        return <Badge variant="success">Dispatched</Badge>;
      case 'cancelled':
        return <Badge variant="secondary">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white font-['Outfit',sans-serif]">
            Reminders
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Time-based alerts and triggers set manually or by Nova during autonomous agent execution.
          </p>
        </div>

        <Button onClick={() => setShowModal(true)} variant="glow" className="shrink-0">
          <Plus className="w-4 h-4 mr-1.5" /> New Reminder
        </Button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-16 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-500 mb-2" />
          <span className="text-sm font-medium">Loading reminders...</span>
        </div>
      ) : reminders.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center text-slate-400 border-dashed">
          <Bell className="w-12 h-12 text-slate-500/50 mb-3" />
          <h3 className="font-semibold text-slate-300 mb-1">No reminders yet</h3>
          <p className="text-xs text-slate-400 max-w-sm mb-4">
            Schedule a reminder or prompt Nova in Chat (e.g., "Remind me to follow up in 20 minutes").
          </p>
          <Button variant="outline" size="sm" onClick={() => setShowModal(true)}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Add Reminder
          </Button>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {reminders.map((r) => (
            <Card
              key={r.id}
              className="p-4 flex items-center justify-between gap-4 transition-all duration-200 hover:border-indigo-500/30 hover:bg-slate-900/80"
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mt-0.5">
                  <Clock className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-100 truncate">
                    {r.title}
                  </div>
                  {r.description && (
                    <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                      {r.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1 text-indigo-300 font-medium">
                      <Calendar className="w-3 h-3 text-indigo-400" />
                      {new Date(r.remindAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {getStatusBadge(r.status)}
                {r.status === 'scheduled' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs text-amber-300 hover:text-amber-200 hover:border-amber-500/40"
                    onClick={() => handleCancel(r.id)}
                    title="Cancel reminder"
                  >
                    <Ban className="w-3.5 h-3.5 mr-1" /> Cancel
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg"
                  onClick={() => handleDelete(r.id)}
                  title="Delete reminder"
                >
                  <Trash2 className="w-4 h-4" />
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
            Create Reminder
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleCreate} className="space-y-4 pt-3">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Reminder Title *
            </label>
            <Input
              type="text"
              required
              placeholder="e.g. Sync with engineering lead"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Trigger Time *
            </label>
            <Input
              type="datetime-local"
              required
              value={remindAt}
              onChange={(e) => setRemindAt(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Description (optional)
            </label>
            <Textarea
              rows={2}
              placeholder="Details, link, or meeting agenda..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="glow">
              Set Reminder
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  );
};
