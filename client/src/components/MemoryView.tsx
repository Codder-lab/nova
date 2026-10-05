import React, { useState, useEffect } from "react";
import { Brain, Plus, Trash2, Search, Loader2, Star, Tag } from "lucide-react";
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

export const MemoryView: React.FC = () => {
  const [memories, setMemories] = useState<any[]>([]);
  const [category, setCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const [content, setContent] = useState("");
  const [newCat, setNewCat] = useState("general");
  const [tags, setTags] = useState("");
  const [importance, setImportance] = useState(5);

  const loadMemories = async () => {
    setLoading(true);
    try {
      if (searchQuery.trim()) {
        const res = await api.searchMemories(searchQuery.trim());
        setMemories(res.memories || []);
      } else {
        const res = await api.listMemories(category);
        setMemories(res.memories || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMemories();
  }, [category]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadMemories();
  };

  const handleDelete = async (id: string) => {
    setMemories((prev) => prev.filter((m) => m.id !== id));
    try {
      await api.deleteMemory(id);
    } catch (err) {
      loadMemories();
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    try {
      const tagList = tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      await api.createMemory({
        content: content.trim(),
        category: newCat,
        tags: tagList,
        importance,
      });

      setShowModal(false);
      setContent("");
      setTags("");
      setImportance(5);
      loadMemories();
    } catch (err: any) {
      alert(`Failed to save memory: ${err.message}`);
    }
  };

  const categories = [
    "all",
    "preference",
    "fact",
    "instruction",
    "context",
    "general",
  ];

  const getCategoryBadgeVariant = (cat: string) => {
    switch (cat) {
      case "preference":
        return "cyan";
      case "fact":
        return "default";
      case "instruction":
        return "warning";
      case "context":
        return "success";
      default:
        return "secondary";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Brain className="w-5 h-5 text-foreground" />
            <h2 className="text-lg font-semibold text-foreground tracking-tight">
              Memory Bank
            </h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Semantic facts, user preferences, and context injected into agent
            actions.
          </p>
        </div>

        <Button
          onClick={() => setShowModal(true)}
          size="sm"
          className="shrink-0 h-9"
        >
          <Plus className="w-4 h-4 mr-1.5" /> Remember Fact
        </Button>
      </div>

      {/* Category Pills & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={cn(
                "shrink-0 text-xs font-medium px-3 py-1.5 rounded-md border capitalize transition-colors cursor-pointer",
                category === cat
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground",
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        <form onSubmit={handleSearch} className="relative w-full sm:w-60">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            type="text"
            className="pl-8 h-8 text-xs"
            placeholder="Search memories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </form>
      </div>

      {/* Memories List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mb-2" />
          <span className="text-xs">Loading memories...</span>
        </div>
      ) : memories.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-14 text-center border-dashed bg-card/50">
          <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center mb-3">
            <Brain className="w-5 h-5 text-muted-foreground" />
          </div>
          <h3 className="text-sm font-semibold text-foreground mb-1">
            No memories stored
          </h3>
          <p className="text-xs text-muted-foreground max-w-xs mb-4">
            Add context or ask Nova in chat: "Remember that I prefer TypeScript
            and Jest".
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowModal(true)}
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Add Memory
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {memories.map((m) => (
            <Card
              key={m.id}
              className="p-4 flex flex-col justify-between gap-3 border border-border bg-card hover:bg-muted/30 transition-colors"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Badge
                    variant={getCategoryBadgeVariant(m.category)}
                    className="text-[10px] px-1.5 py-0 capitalize"
                  >
                    {m.category}
                  </Badge>

                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
                    <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                    <span>{m.importance}/10</span>
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-foreground leading-relaxed">
                  {m.content}
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border mt-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {m.tags &&
                    m.tags.map((t: string) => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground font-mono"
                      >
                        <Tag className="w-2.5 h-2.5 opacity-60" /> {t}
                      </span>
                    ))}
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md shrink-0"
                  onClick={() => handleDelete(m.id)}
                  title="Delete memory"
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
            Store Memory Fact
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleCreate} className="space-y-3.5 pt-2">
          <div>
            <label className="text-xs font-medium text-foreground block mb-1">
              Memory Content *
            </label>
            <Textarea
              rows={3}
              required
              placeholder="e.g. Always generate Node.js code with ES Module import/export syntax"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">
                Category
              </label>
              <select
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs text-foreground shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
                value={newCat}
                onChange={(e) => setNewCat(e.target.value)}
              >
                <option value="preference">Preference</option>
                <option value="fact">Fact</option>
                <option value="instruction">Instruction</option>
                <option value="context">Context</option>
                <option value="general">General</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-foreground block mb-1">
                Importance ({importance}/10)
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={importance}
                onChange={(e) => setImportance(parseInt(e.target.value))}
                className="w-full h-9 accent-primary cursor-pointer"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-foreground block mb-1">
              Tags (comma separated)
            </label>
            <Input
              type="text"
              placeholder="code, style, typescript"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
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
              Save Memory
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  );
};
