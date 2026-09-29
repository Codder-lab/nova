import { z } from 'zod';
import * as cheerio from 'cheerio';
import { AgentTool, ToolContext } from '../base/agent-tool.interface';
import { logger } from '../../utils/logger';

export interface SearchResultItem {
  title: string;
  url: string;
  snippet: string;
}

function extractActualUrl(rawHref: string): string {
  try {
    if (rawHref.includes('uddg=')) {
      const parsed = new URL(rawHref, 'https://duckduckgo.com');
      const uddg = parsed.searchParams.get('uddg');
      if (uddg) return decodeURIComponent(uddg);
    }
    if (rawHref.startsWith('http://') || rawHref.startsWith('https://')) {
      return rawHref;
    }
    return `https://${rawHref.replace(/^\/\//, '')}`;
  } catch {
    return rawHref;
  }
}

export const webSearchTool: AgentTool = {
  name: 'web_search',
  description: 'Searches the live web to retrieve real-time search results, documentation, articles, or news.',
  riskLevel: 'READ',
  inputSchema: z.object({
    query: z.string().min(1).describe('The web search query terms or question'),
    maxResults: z.number().min(1).max(20).optional().default(5).describe('Maximum number of results to return (default 5)'),
  }),
  async execute(input, _context: ToolContext) {
    const { query, maxResults = 5 } = input;
    const results: SearchResultItem[] = [];

    try {
      const response = await fetch(
        `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
          },
          signal: AbortSignal.timeout(8000),
        }
      );

      if (response.ok) {
        const html = await response.text();
        const $ = cheerio.load(html);

        $('.result').each((_idx, el) => {
          if (results.length >= maxResults) return;

          const titleEl = $(el).find('.result__title a');
          const title = titleEl.text().trim();
          const rawHref = titleEl.attr('href') || '';
          const snippet = $(el).find('.result__snippet').text().trim();

          if (title && rawHref) {
            const url = extractActualUrl(rawHref);
            results.push({ title, url, snippet });
          }
        });
      }
    } catch (err: any) {
      logger.warn({ error: err.message, query }, 'HTML search failed, trying instant answer API');
    }

    // Fallback: If HTML scraping returned empty or failed, try DuckDuckGo Instant Answer API
    if (results.length === 0) {
      try {
        const fallbackRes = await fetch(
          `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`,
          {
            headers: { 'User-Agent': 'NovaAI-Agent/1.0' },
            signal: AbortSignal.timeout(6000),
          }
        );

        if (fallbackRes.ok) {
          const data = (await fallbackRes.json()) as any;
          if (data.AbstractText) {
            results.push({
              title: data.Heading || query,
              url: data.AbstractURL || '',
              snippet: data.AbstractText,
            });
          }

          if (Array.isArray(data.RelatedTopics)) {
            for (const topic of data.RelatedTopics) {
              if (results.length >= maxResults) break;
              if (topic.Text && topic.FirstURL) {
                results.push({
                  title: topic.Text.split(' - ')[0] || topic.Text,
                  url: topic.FirstURL,
                  snippet: topic.Text,
                });
              }
            }
          }
        }
      } catch (fallbackErr: any) {
        logger.error({ error: fallbackErr.message }, 'Search fallback failed');
      }
    }

    return {
      query,
      count: results.length,
      results,
    };
  },
};
