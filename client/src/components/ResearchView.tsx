import React, { useState } from "react";
import {
  Globe,
  Search,
  ExternalLink,
  Compass,
  FileText,
  Loader2,
} from "lucide-react";
import { api } from "../services/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const ResearchView: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const [fetchUrl, setFetchUrl] = useState("");
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
      const searchStep = res.steps?.find(
        (s: any) => s.toolCall?.name === "web_search",
      );
      if (searchStep?.toolCall?.result?.results) {
        setSearchResults(searchStep.toolCall.result.results);
      } else {
        setSearchResults([
          { title: "Agent Research Summary", snippet: res.response, url: "" },
        ]);
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
      const fetchStep = res.steps?.find(
        (s: any) => s.toolCall?.name === "fetch_web_page",
      );
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
        <div className="flex items-center gap-2 mb-1">
          <Globe className="w-5 h-5 text-foreground" />
          <h2 className="text-lg font-semibold text-foreground tracking-tight">
            Web & Browser Automation
          </h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Autonomous search, content extraction, and browser navigation tooling.
        </p>
      </div>

      {/* Browser Engine Info Banner */}
      <Card className="p-4 bg-card border-border shadow-xs">
        <div className="flex items-start gap-3.5">
          <div className="p-2 rounded-md bg-secondary text-secondary-foreground shrink-0 mt-0.5">
            <Compass className="w-4 h-4" />
          </div>
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-xs sm:text-sm font-semibold text-foreground">
                Playwright Headless Browser Engine
              </h3>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                Headless Mode
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Available tools:{" "}
              <code className="text-foreground font-mono">open_browser</code>,{" "}
              <code className="text-foreground font-mono">navigate_to</code>,{" "}
              <code className="text-destructive font-mono">click_element</code>{" "}
              [HIGH RISK],{" "}
              <code className="text-destructive font-mono">type_into</code>{" "}
              [HIGH RISK], and{" "}
              <code className="text-foreground font-mono">
                extract_page_content
              </code>
              . High-risk interactive actions require human authorization.
            </p>
          </div>
        </div>
      </Card>

      {/* Split Research Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Web Search Card */}
        <Card className="flex flex-col justify-between">
          <CardHeader className="pb-3 border-b border-border flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-foreground" />
              <CardTitle className="text-sm font-semibold">
                Web Search
              </CardTitle>
            </div>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              DuckDuckGo
            </Badge>
          </CardHeader>

          <CardContent className="p-4 space-y-3">
            <form onSubmit={handleSearch} className="flex gap-2">
              <Input
                type="text"
                placeholder="e.g. latest advancements in agentic AI 2026"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                disabled={searchLoading}
                className="h-8 text-xs"
              />
              <Button
                type="submit"
                size="sm"
                className="h-8 px-3"
                disabled={searchLoading || !searchQuery.trim()}
              >
                {searchLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Search className="w-3.5 h-3.5" />
                )}
              </Button>
            </form>

            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {searchLoading ? (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin mb-1.5" />
                  <span className="text-xs">
                    Dispatching web search agent...
                  </span>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-xs">
                  Enter a research query above to search web pages.
                </div>
              ) : (
                searchResults.map((res, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-md border border-border bg-muted/30 space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-xs text-foreground">
                        {res.title}
                      </span>
                      {res.url && (
                        <a
                          href={res.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {res.snippet}
                    </p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Page Content Extraction */}
        <Card className="flex flex-col justify-between">
          <CardHeader className="pb-3 border-b border-border flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-foreground" />
              <CardTitle className="text-sm font-semibold">
                Content Extractor
              </CardTitle>
            </div>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              Cheerio Scraper
            </Badge>
          </CardHeader>

          <CardContent className="p-4 space-y-3">
            <form onSubmit={handleFetch} className="flex gap-2">
              <Input
                type="url"
                placeholder="https://example.com"
                value={fetchUrl}
                onChange={(e) => setFetchUrl(e.target.value)}
                disabled={fetchLoading}
                className="h-8 text-xs"
              />
              <Button
                type="submit"
                size="sm"
                className="h-8 px-3"
                disabled={fetchLoading || !fetchUrl.trim()}
              >
                {fetchLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  "Fetch"
                )}
              </Button>
            </form>

            <div className="max-h-96 overflow-y-auto pr-1">
              {fetchLoading ? (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin mb-1.5" />
                  <span className="text-xs">
                    Fetching & extracting content...
                  </span>
                </div>
              ) : !fetchResult ? (
                <div className="text-center py-8 text-muted-foreground text-xs">
                  Enter a URL to fetch clean plaintext or Markdown content.
                </div>
              ) : (
                <div className="p-3 rounded-md border border-border bg-muted/30 space-y-1.5">
                  <div className="font-medium text-xs text-foreground">
                    {fetchResult.title || fetchUrl}
                  </div>
                  <pre className="text-[11px] text-foreground font-mono whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto p-2 bg-secondary rounded border border-border">
                    {fetchResult.content ||
                      JSON.stringify(fetchResult, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
