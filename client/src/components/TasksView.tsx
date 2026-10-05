import React, { useState, useEffect } from "react";
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
import { cn } from "@/lib/utils";

export const TasksView: React.FC = () => {
  const [tasks, setTasks] = useState<any[]>([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPriority, setNewPriority] = useState("medium");
  const [newDueDate, setNewDueDate] = useState("");
  const [newTags, setNewTags] = useState("");

  const loadTasks = async () => {
    setLoading(true);
    try {
      const res = await api.listTasks("all");
      if (res.tasks) setTasks(res.tasks);
    } catch (err: any) {
      console.error("Failed loading tasks:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const handleToggleComplete = async (task: any) => {
    const nextStatus = task.status === "completed" ? "todo" : "completed";
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t)),
    );
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
      const tags = newTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
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
        setNewTitle("");
        setNewDescription("");
        setNewDueDate("");
        setNewTags("");
      }
    } catch (err: any) {
      alert(`Failed to create task: ${err.message}`);
    }
  };

  const stats = {
    total: tasks.length,
    completed: tasks.filter((t) => t.status === "completed").length,
    inProgress: tasks.filter((t) => t.status === "in_progress").length,
    urgent: tasks.filter((t) => t.priority === "urgent").length,
  };

  const filteredTasks = tasks.filter((t) => {
    const matchesFilter = filter === "all" || t.status === filter;
    const matchesSearch = t.title.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getPriorityVariant = (p: string) => {
    const map: Record<string, any> = {
      urgent: "destructive",
      high: "warning",
      medium: "default",
      low: "secondary",
    };
    return map[p] || "outline";
  };

  const getStatusVariant = (s: string) => {
    const map: Record<string, any> = {
      completed: "success",
      in_progress: "info",
      cancelled: "destructive",
    };
    return map[s] || "secondary";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <CheckSquare className="w-5 h-5 text-foreground" />
            <h2 className="text-lg font-semibold text-foreground tracking-tight">
              Tasks & Goals
            </h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Manage goals, organize priorities, and track autonomous task
            progress.
          </p>
        </div>
        <Button
          onClick={() => setShowCreateModal(true)}
          size="sm"
          className="shrink-0 h-9"
        >
          <Plus className="w-4 h-4 mr-1.5" /> New Task
        </Button>
      </div>

      {/* Stats Cards */}
      {!loading && tasks.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total Tasks", value: stats.total, icon: ListTodo },
            { label: "Completed", value: stats.completed, icon: CheckCircle2 },
            { label: "In Progress", value: stats.inProgress, icon: TrendingUp },
            { label: "Urgent", value: stats.urgent, icon: AlertTriangle },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <Card
                key={stat.label}
                className="p-4 bg-card border-border shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    {stat.label}
                  </span>
                  <Icon className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="mt-2 text-2xl font-bold text-foreground">
                  {stat.value}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {[
            { key: "all", label: "All" },
            { key: "todo", label: "Todo" },
            { key: "in_progress", label: "In Progress" },
            { key: "completed", label: "Completed" },
            { key: "cancelled", label: "Cancelled" },
          ].map((s) => (
            <button
              key={s.key}
              onClick={() => setFilter(s.key)}
              className={cn(
                "shrink-0 text-xs font-medium px-3 py-1.5 rounded-md border transition-colors cursor-pointer",
                filter === s.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-60">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            type="text"
            className="pl-8 h-8 text-xs"
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Task List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mb-2" />
          <p className="text-xs">Loading tasks...</p>
        </div>
      ) : filteredTasks.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-14 text-center border-dashed bg-card/50">
          <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center mb-3">
            <CheckSquare className="w-5 h-5 text-muted-foreground" />
          </div>
          <h3 className="text-sm font-semibold text-foreground mb-1">
            No tasks found
          </h3>
          <p className="text-xs text-muted-foreground max-w-xs mb-4">
            Create your first task or ask Nova in chat to create one for you.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Create Task
          </Button>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredTasks.map((task) => (
            <div
              key={task.id}
              className="group flex items-center justify-between gap-3 p-3.5 rounded-md border border-border bg-card hover:bg-muted/30 transition-colors"
            >
              {/* Left: Checkbox + Info */}
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => handleToggleComplete(task)}
                  className="shrink-0 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  {task.status === "completed" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Circle className="w-4 h-4" />
                  )}
                </button>

                <div className="min-w-0">
                  <div
                    className={cn(
                      "text-xs sm:text-sm font-medium text-foreground truncate",
                      task.status === "completed" &&
                        "line-through text-muted-foreground",
                    )}
                  >
                    {task.title}
                  </div>
                  {task.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                      {task.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                    {task.dueDate && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />{" "}
                        {new Date(task.dueDate).toLocaleDateString()}
                      </span>
                    )}
                    {task.tags?.length > 0 && (
                      <span className="flex items-center gap-1">
                        <Tag className="w-3 h-3" /> {task.tags.join(", ")}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Badges + Delete */}
              <div className="flex items-center gap-2 shrink-0">
                <Badge
                  variant={getPriorityVariant(task.priority)}
                  className="text-[10px] px-1.5 py-0"
                >
                  {task.priority}
                </Badge>
                <Badge
                  variant={getStatusVariant(task.status)}
                  className="text-[10px] px-1.5 py-0"
                >
                  {task.status?.replace("_", " ")}
                </Badge>
                <button
                  onClick={() => handleDelete(task.id)}
                  className="opacity-0 group-hover:opacity-100 flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all cursor-pointer"
                  title="Delete task"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Task Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogHeader>
          <DialogTitle onClose={() => setShowCreateModal(false)}>
            Create Task
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
              placeholder="e.g. Complete quarterly security audit"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs font-medium text-foreground block mb-1">
              Description
            </label>
            <Textarea
              rows={2}
              placeholder="Task details and context..."
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">
                Priority
              </label>
              <select
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs text-foreground shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
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
              <label className="text-xs font-medium text-foreground block mb-1">
                Due Date
              </label>
              <Input
                type="date"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-foreground block mb-1">
              Tags (comma separated)
            </label>
            <Input
              type="text"
              placeholder="engineering, security"
              value={newTags}
              onChange={(e) => setNewTags(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowCreateModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm">
              Create Task
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  );
};
