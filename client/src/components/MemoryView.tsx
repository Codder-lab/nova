import React, { useState, useEffect } from 'react';
import { Brain, Plus, Trash2, Search, Loader2, Star, Tag } from 'lucide-react';
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

export const MemoryView: React.FC = () => {
  const [memories, setMemories] = useState<any[]>([]);
  const [category, setCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const [content, setContent] = useState('');
  const [newCat, setNewCat] = useState('general');
  const [tags, setTags] = useState('');
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
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      await api.createMemory({
        content: content.trim(),
        category: newCat,
        tags: tagList,
        importance,
      });

      setShowModal(false);
      setContent('');
      setTags('');
      setImportance(5);
      loadMemories();
    } catch (err: any) {
      alert(`Failed to save memory: ${err.message}`);
    }
  };

  const categories = ['all', 'preference', 'fact', 'instruction', 'context', 'general'];

  const getCategoryBadgeVariant = (cat: string) => {
    switch (cat) {
      case 'preference':
        return 'cyan';
      case 'fact':
        return 'default';
      case 'instruction':
        return 'warning';
      case 'context':
        return 'success';
      default:
        return 'secondary';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white font-['Outfit',sans-serif]">
            Long-Term Memory Bank
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Semantic preferences, facts, and context automatically recalled and injected into agent prompts.
          </p>
        </div>

        <Button onClick={() => setShowModal(true)} variant="glow" className="shrink-0">
          <Plus className="w-4 h-4 mr-1.5" /> Remember Fact
        </Button>
      </div>

      {/* Category Pills & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {categories.map((cat) => (
            <Button
              key={cat}
              size="sm"
              variant={category === cat ? 'default' : 'secondary'}
              onClick={() => setCategory(cat)}
              className="text-xs uppercase tracking-wider font-semibold rounded-lg"
            >
              {cat}
            </Button>
          ))}
        </div>

        <form onSubmit={handleSearch} className="relative w-full sm:w-64">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            type="text"
            className="pl-9 h-9 text-xs"
            placeholder="Search memories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </form>
      </div>

      {/* Memories List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-16 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-500 mb-2" />
          <span className="text-sm font-medium">Loading memories...</span>
        </div>
      ) : memories.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center text-slate-400 border-dashed">
          <Brain className="w-12 h-12 text-slate-500/50 mb-3" />
          <h3 className="font-semibold text-slate-300 mb-1">No memories stored</h3>
          <p className="text-xs text-slate-400 max-w-sm mb-4">
            Store critical facts or tell Nova in chat: "Remember that I prefer TypeScript and Jest".
          </p>
          <Button variant="outline" size="sm" onClick={() => setShowModal(true)}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Add Memory
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {memories.map((m) => (
            <Card
              key={m.id}
              className="p-5 flex flex-col justify-between gap-4 transition-all duration-200 hover:border-indigo-500/30 hover:bg-slate-900/80"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant={getCategoryBadgeVariant(m.category)}>
                    {m.category}
                  </Badge>

                  <div className="flex items-center gap-1 text-xs text-amber-400 font-semibold">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <span>{m.importance}/10</span>
                  </div>
                </div>

                <p className="text-sm text-slate-200 leading-relaxed font-normal">
                  {m.content}
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-white/5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {m.tags && m.tags.map((t: string) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-white/5 text-slate-400 font-mono"
                    >
                      <Tag className="w-2.5 h-2.5 text-slate-500" /> {t}
                    </span>
                  ))}
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg shrink-0"
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

        <form onSubmit={handleCreate} className="space-y-4 pt-3">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Memory Content *
            </label>
            <Textarea
              rows={3}
              required
              placeholder="e.g. Always generate Node.js code with ES Module import/export syntax"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Category
              </label>
              <select
                className="w-full h-11 rounded-xl border border-white/10 bg-slate-900/80 px-3 text-sm text-slate-100 shadow-sm focus:outline-none focus:border-indigo-500"
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
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Importance ({importance}/10)
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={importance}
                onChange={(e) => setImportance(parseInt(e.target.value))}
                className="w-full h-11 accent-indigo-500 cursor-pointer"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
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
              onClick={() => setShowModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="glow">
              Save Memory
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  );
};
