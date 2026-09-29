import React, { useState, useEffect } from 'react';
import {
  CheckSquare,
  Plus,
  Trash2,
  Calendar,
  Tag,
  Loader2,
  Search,
  CheckCircle2,
  Circle,
  ListTodo,
  TrendingUp,
  AlertTriangle,
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
import { cn } from '@/lib/utils';

export const TasksView: React.FC = () => {
  const [tasks, setTasks] = useState<any[]>([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPriority, setNewPriority] = useState('medium');
  const [newDueDate, setNewDueDate] = useState('');
  const [newTags, setNewTags] = useState('');

  const loadTasks = async () => {
    setLoading(true);
    try {
      const res = await api.listTasks('all');
      if (res.tasks) setTasks(res.tasks);
    } catch (err: any) {
      console.error('Failed loading tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTasks(); }, []);

  const handleToggleComplete = async (task: any) => {
    const nextStatus = task.status === 'completed' ? 'todo' : 'completed';
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t)));
    try {
      await api.updateTask(task.id, { status: nextStatus });
    } catch {
      loadTasks();
    }
  };

  const handleDelete = async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    try {
      await api.deleteTask(id);
    } catch {
      loadTasks();
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    try {
      const tags = newTags.split(',').map((t) => t.trim()).filter(Boolean);
      const res = await api.createTask({
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
        priority: newPriority,
        dueDate: newDueDate || undefined,
        tags,
      });
      if (res.task) {
        setTasks((prev) => [res.task, ...prev]);
        setShowCreateModal(false);
        setNewTitle(''); setNewDescription(''); setNewDueDate(''); setNewTags('');
      }
    } catch (err: any) {
      alert(`Failed to create task: ${err.message}`);
    }
  };

  const stats = {
    total: tasks.length,
    completed: tasks.filter((t) => t.status === 'completed').length,
    inProgress: tasks.filter((t) => t.status === 'in_progress').length,
    urgent: tasks.filter((t) => t.priority === 'urgent').length,
  };

  const filteredTasks = tasks.filter((t) => {
    const matchesFilter = filter === 'all' || t.status === filter;
    const matchesSearch = t.title.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getPriorityVariant = (p: string) => {
    const map: Record<string, any> = { urgent: 'destructive', high: 'warning', medium: 'default', low: 'secondary' };
    return map[p] || 'outline';
  };

  const getStatusVariant = (s: string) => {
    const map: Record<string, any> = { completed: 'success', in_progress: 'cyan', cancelled: 'destructive' };
    return map[s] || 'secondary';
  };

  return (
    <div className="space-y-6 fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-lg bg-indigo-500/15 text-indigo-400">
              <CheckSquare className="w-4 h-4" />
            </div>
            <h2 className="text-xl font-black tracking-tight text-white font-['Outfit',sans-serif]">
              Tasks Board
            </h2>
          </div>
          <p className="text-sm text-slate-400">
            Organize tasks manually or command Nova to create, assign, and complete them autonomously.
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)} variant="glow" className="shrink-0">
          <Plus className="w-4 h-4 mr-1.5" /> New Task
        </Button>
      </div>

      {/* Stats Row */}
      {!loading && tasks.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total Tasks', value: stats.total, icon: ListTodo, color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/20', hover: 'stat-card-indigo' },
            { label: 'Completed', value: stats.completed, icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', hover: 'stat-card-emerald' },
            { label: 'In Progress', value: stats.inProgress, icon: TrendingUp, color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/20', hover: 'stat-card-cyan' },
            { label: 'Urgent', value: stats.urgent, icon: AlertTriangle, color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20', hover: 'stat-card-amber' },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className={cn(
                  'flex items-center gap-3 p-4 rounded-2xl border transition-all duration-200',
                  stat.bg, stat.hover
                )}
              >
                <div className={cn('p-2 rounded-xl bg-white/5', stat.color)}>
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xl font-black text-white font-['Outfit',sans-serif]">{stat.value}</div>
                  <div className="text-[11px] text-slate-400 font-medium">{stat.label}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Filter Chips & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {[
            { key: 'all', label: 'All' },
            { key: 'todo', label: 'Todo' },
            { key: 'in_progress', label: 'In Progress' },
            { key: 'completed', label: 'Completed' },
            { key: 'cancelled', label: 'Cancelled' },
          ].map((s) => (
            <button
              key={s.key}
              onClick={() => setFilter(s.key)}
              className={cn(
                'shrink-0 text-[11px] font-bold px-3 py-1.5 rounded-lg border transition-all duration-150 cursor-pointer',
                filter === s.key
                  ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                  : 'bg-white/[0.03] border-white/[0.07] text-slate-400 hover:border-white/15 hover:text-slate-200'
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <Input
            type="text"
            className="pl-9 h-9 text-xs bg-slate-900/60"
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Task List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <div className="relative mb-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
            </div>
          </div>
          <p className="text-sm font-medium">Loading from MongoDB Atlas...</p>
        </div>
      ) : filteredTasks.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center border-dashed bg-transparent">
          <div className="w-14 h-14 rounded-2xl bg-slate-800/50 border border-white/5 flex items-center justify-center mb-4">
            <CheckSquare className="w-7 h-7 text-slate-600" />
          </div>
          <h3 className="font-bold text-slate-300 mb-1.5">No tasks found</h3>
          <p className="text-xs text-slate-500 max-w-xs mb-5">
            Create a task with the button above, or tell Nova in chat: <em>"Create a high priority task titled..."</em>
          </p>
          <Button variant="outline" size="sm" onClick={() => setShowCreateModal(true)}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Create Task
          </Button>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredTasks.map((task, idx) => (
            <div
              key={task.id}
              className="group flex items-center justify-between gap-4 p-4 rounded-2xl border border-white/[0.06] bg-slate-900/40 hover:bg-slate-900/70 hover:border-indigo-500/20 transition-all duration-200 fade-in-up"
              style={{ animationDelay: `${idx * 0.04}s` }}
            >
              {/* Left: Checkbox + Info */}
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => handleToggleComplete(task)}
                  className="shrink-0 transition-all hover:scale-110 cursor-pointer"
                >
                  {task.status === 'completed' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <Circle className="w-5 h-5 text-slate-600 hover:text-indigo-400 transition-colors" />
                  )}
                </button>

                <div className="min-w-0">
                  <div className={cn(
                    'text-sm font-semibold text-slate-100 truncate',
                    task.status === 'completed' && 'line-through text-slate-500'
                  )}>
                    {task.title}
                  </div>
                  {task.description && (
                    <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{task.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-500">
                    {task.dueDate && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> {new Date(task.dueDate).toLocaleDateString()}
                      </span>
                    )}
                    {task.tags?.length > 0 && (
                      <span className="flex items-center gap-1 text-indigo-400/80 font-medium">
                        <Tag className="w-3 h-3" /> {task.tags.join(', ')}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Badges + Delete */}
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant={getPriorityVariant(task.priority)}>{task.priority}</Badge>
                <Badge variant={getStatusVariant(task.status)}>{task.status?.replace('_', ' ')}</Badge>
                <button
                  onClick={() => handleDelete(task.id)}
                  className="opacity-0 group-hover:opacity-100 flex items-center justify-center w-7 h-7 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer"
                  title="Delete task"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Nova Hint Banner */}
      {!loading && tasks.length > 0 && (
        <div className="flex items-center gap-3 p-3.5 rounded-xl border border-indigo-500/15 bg-indigo-500/5 text-xs text-indigo-300/80">
          <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>
            Tip: Ask Nova in chat — <em>"Mark all completed tasks as cancelled"</em> or <em>"Create tasks from this meeting notes list..."</em>
          </span>
        </div>
      )}

      {/* Create Task Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogHeader>
          <DialogTitle onClose={() => setShowCreateModal(false)}>Create New Task</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleCreate} className="space-y-4 pt-3">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">Task Title *</label>
            <Input
              type="text"
              required
              placeholder="e.g. Prepare Financial Audit Report"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">Description (optional)</label>
            <Textarea
              rows={2}
              placeholder="Context, links, or meeting notes..."
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">Priority</label>
              <select
                className="w-full h-11 rounded-xl border border-white/10 bg-slate-900/80 px-3 text-sm text-slate-100 shadow-sm focus:outline-none focus:border-indigo-500"
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value)}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">Due Date</label>
              <Input type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">Tags (comma separated)</label>
            <Input type="text" placeholder="audit, finance, quarterly" value={newTags} onChange={(e) => setNewTags(e.target.value)} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button type="submit" variant="glow">Create Task</Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  );
};
