import React, { useState, useEffect } from 'react';
import {
  Clock,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Loader2,
  Calendar,
  Globe,
  Sparkles,
} from 'lucide-react';
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

export const SchedulesView: React.FC = () => {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const [prompt, setPrompt] = useState('');
  const [scheduleExpr, setScheduleExpr] = useState('daily at 9am');
  const [timezone, setTimezone] = useState('UTC');

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
      prev.map((s) => (s.id === id ? { ...s, enabled: !currentEnabled } : s))
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
      setPrompt('');
      setScheduleExpr('daily at 9am');
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
          <h2 className="text-2xl font-bold tracking-tight text-white font-['Outfit',sans-serif]">
            Automations & Schedulers
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Autonomous background agents executed automatically according to cron expressions or natural language.
          </p>
        </div>

        <Button onClick={() => setShowModal(true)} variant="glow" className="shrink-0">
          <Plus className="w-4 h-4 mr-1.5" /> New Automation
        </Button>
      </div>

      {/* Schedules List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-16 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-500 mb-2" />
          <span className="text-sm font-medium">Loading background schedules...</span>
        </div>
      ) : schedules.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center text-slate-400 border-dashed">
          <Clock className="w-12 h-12 text-slate-500/50 mb-3" />
          <h3 className="font-semibold text-slate-300 mb-1">No automations scheduled</h3>
          <p className="text-xs text-slate-400 max-w-sm mb-4">
            Set up recurring daily reports, system health checks, or automated database backups.
          </p>
          <Button variant="outline" size="sm" onClick={() => setShowModal(true)}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Add Automation
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {schedules.map((s) => (
            <Card
              key={s.id}
              className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-200 hover:border-indigo-500/30 hover:bg-slate-900/80"
            >
              <div className="space-y-2 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="text-sm font-semibold text-slate-100 font-mono">
                    "{s.prompt}"
                  </div>
                  <Badge variant={s.enabled ? 'success' : 'secondary'}>
                    {s.enabled ? 'Active' : 'Paused'}
                  </Badge>
                </div>

                <div className="flex items-center gap-4 text-xs text-slate-400 flex-wrap">
                  <span className="flex items-center gap-1 font-mono text-indigo-400">
                    <Clock className="w-3.5 h-3.5" /> {s.schedule}
                  </span>
                  <span className="flex items-center gap-1">
                    <Globe className="w-3.5 h-3.5 text-slate-500" /> {s.timezone || 'UTC'}
                  </span>
                  {s.nextRunAt && (
                    <span className="flex items-center gap-1 text-slate-400">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" /> Next:{' '}
                      {new Date(s.nextRunAt).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                <button
                  onClick={() => handleToggle(s.id, s.enabled)}
                  className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border border-white/10 hover:bg-white/5 transition-colors cursor-pointer"
                >
                  {s.enabled ? (
                    <ToggleRight className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <ToggleLeft className="w-5 h-5 text-slate-500" />
                  )}
                  <span className={s.enabled ? 'text-emerald-400 font-medium' : 'text-slate-500'}>
                    {s.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg"
                  onClick={() => handleDelete(s.id)}
                  title="Delete schedule"
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
            Create Automation Schedule
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleCreate} className="space-y-4 pt-3">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Goal / Prompt for Autonomous Agent *
            </label>
            <Textarea
              rows={2}
              required
              placeholder="e.g. Check system metrics and summarize database growth"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Frequency / Recurrence *
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
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Timezone
              </label>
              <select
                className="w-full h-11 rounded-xl border border-white/10 bg-slate-900/80 px-3 text-sm text-slate-100 shadow-sm focus:outline-none focus:border-indigo-500"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              >
                <option value="UTC">UTC</option>
                <option value="America/New_York">America/New_York (EST)</option>
                <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
                <option value="Europe/London">Europe/London (GMT)</option>
                <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
              </select>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300 flex items-center gap-2">
            <Sparkles className="w-4 h-4 shrink-0 text-indigo-400" />
            <span>
              Nova parses natural language intervals (e.g., "every 30m", "daily at 10:00") into standard cron syntax automatically.
            </span>
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
              Register Automation
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  );
};
