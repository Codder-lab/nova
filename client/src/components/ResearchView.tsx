import React, { useState } from 'react';
import { Globe, Search, ExternalLink, Compass, FileText, Loader2 } from 'lucide-react';
import { api } from '../services/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export const ResearchView: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const [fetchUrl, setFetchUrl] = useState('');
  const [fetchResult, setFetchResult] = useState<any>(null);
  const [fetchLoading, setFetchLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearchLoading(true);
    try {
      const res = await api.runAgent({
        goal: `Search the web for "${searchQuery.trim()}" and provide structured highlights with citations.`,
      });
      const searchStep = res.steps?.find((s: any) => s.toolCall?.name === 'web_search');
      if (searchStep?.toolCall?.result?.results) {
        setSearchResults(searchStep.toolCall.result.results);
      } else {
        setSearchResults([{ title: 'Agent Research Summary', snippet: res.response, url: '' }]);
      }
    } catch (err: any) {
      alert(`Search error: ${err.message}`);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleFetch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fetchUrl.trim()) return;

    setFetchLoading(true);
    try {
      const res = await api.runAgent({
        goal: `Fetch the content of "${fetchUrl.trim()}" and summarize the main text.`,
      });
      const fetchStep = res.steps?.find((s: any) => s.toolCall?.name === 'fetch_web_page');
      if (fetchStep?.toolCall?.result) {
        setFetchResult(fetchStep.toolCall.result);
      } else {
        setFetchResult({ title: fetchUrl, content: res.response });
      }
    } catch (err: any) {
      alert(`Fetch error: ${err.message}`);
    } finally {
      setFetchLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-white font-['Outfit',sans-serif]">
          Web Research & Browser Automation
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Explore real-time DuckDuckGo research, Cheerio web text extraction, and Playwright browser tools.
        </p>
      </div>

      {/* Playwright Browser Engine Banner */}
      <Card className="border-indigo-500/30 bg-gradient-to-r from-indigo-950/40 via-purple-950/20 to-slate-900/50 p-6 shadow-xl shadow-indigo-950/20">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center text-white shrink-0 shadow-lg shadow-indigo-500/30">
            <Compass className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white font-['Outfit',sans-serif]">
                Playwright Headless Browser Engine
              </h3>
              <Badge variant="cyan">Headless Mode</Badge>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
              Equipped with 5 tools:{' '}
              <code className="text-indigo-300 font-mono">open_browser</code>,{' '}
              <code className="text-indigo-300 font-mono">navigate_to</code>,{' '}
              <code className="text-rose-400 font-mono">click_element</code> [HIGH RISK],{' '}
              <code className="text-rose-400 font-mono">type_into</code> [HIGH RISK], and{' '}
              <code className="text-indigo-300 font-mono">extract_page_content</code>. Interactive actions require explicit human authorization before execution.
            </p>
          </div>
        </div>
      </Card>

      {/* Split Research Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Web Search Section */}
        <Card className="p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <div className="flex items-center gap-2 text-base font-bold text-white font-['Outfit',sans-serif]">
                <Globe className="w-5 h-5 text-cyan-400" />
                <span>Live Web Search</span>
              </div>
              <Badge variant="outline" className="text-[10px]">
                DuckDuckGo HTML
              </Badge>
            </div>

            <form onSubmit={handleSearch} className="flex gap-2">
              <Input
                type="text"
                placeholder="e.g. latest advancements in agentic AI 2026"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                disabled={searchLoading}
              />
              <Button type="submit" variant="glow" disabled={searchLoading || !searchQuery.trim()}>
                {searchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </form>

            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {searchLoading ? (
                <div className="flex flex-col items-center justify-center p-12 text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin text-cyan-400 mb-2" />
                  <span className="text-xs">Dispatching autonomous web agent...</span>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="text-center p-8 text-slate-500 text-xs">
                  Enter a research query above to fetch live web pages and summaries.
                </div>
              ) : (
                searchResults.map((res, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl border border-white/5 bg-black/30 hover:border-cyan-500/30 transition-all space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-xs text-cyan-300">
                        {res.title}
                      </span>
                      {res.url && (
                        <a
                          href={res.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-slate-400 hover:text-white"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {res.snippet}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>

        {/* Web Scraper / Content Extraction */}
        <Card className="p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <div className="flex items-center gap-2 text-base font-bold text-white font-['Outfit',sans-serif]">
                <FileText className="w-5 h-5 text-indigo-400" />
                <span>Page Content Extraction</span>
              </div>
              <Badge variant="outline" className="text-[10px]">
                Cheerio Scraper
              </Badge>
            </div>

            <form onSubmit={handleFetch} className="flex gap-2">
              <Input
                type="url"
                placeholder="https://example.com"
                value={fetchUrl}
                onChange={(e) => setFetchUrl(e.target.value)}
                disabled={fetchLoading}
              />
              <Button type="submit" variant="default" disabled={fetchLoading || !fetchUrl.trim()}>
                {fetchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Fetch'}
              </Button>
            </form>

            <div className="max-h-[420px] overflow-y-auto pr-1">
              {fetchLoading ? (
                <div className="flex flex-col items-center justify-center p-12 text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-400 mb-2" />
                  <span className="text-xs">Fetching and parsing HTML content...</span>
                </div>
              ) : !fetchResult ? (
                <div className="text-center p-8 text-slate-500 text-xs">
                  Enter a target web URL to extract stripped plain text or Markdown.
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-white/5 bg-black/40 space-y-2">
                  <div className="font-semibold text-xs text-indigo-300">
                    {fetchResult.title || fetchUrl}
                  </div>
                  <pre className="text-[11px] text-slate-300 font-mono whitespace-pre-wrap leading-relaxed max-h-[300px] overflow-y-auto">
                    {fetchResult.content || JSON.stringify(fetchResult, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
