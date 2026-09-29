import { LLMProvider } from './provider';
import {
  LLMRequest,
  LLMResponse,
  LLMChunk,
  ToolCallItem,
  ChatMessage,
  ToolDefinition,
} from '@nova/shared';
import { logger } from '../utils/logger';

export class OllamaProvider implements LLMProvider {
  public readonly name = 'ollama';

  constructor(
    private readonly baseUrl: string = 'http://localhost:11434',
    private readonly model: string = 'qwen2.5:7b'
  ) {}

  public supportsToolCalling(): boolean {
    return true;
  }

  public async generate(request: LLMRequest): Promise<LLMResponse> {
    const formattedMessages = this.formatMessages(request.messages);
    const formattedTools = request.tools ? this.formatTools(request.tools) : undefined;

    const payload: Record<string, any> = {
      model: this.model,
      messages: formattedMessages,
      stream: false,
      options: {
        temperature: request.temperature ?? 0.2,
      },
    };

    if (formattedTools && formattedTools.length > 0) {
      payload.tools = formattedTools;
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API error (${response.status}): ${errorText}`);
      }

      const data: any = await response.json();
      const message = data.message || {};
      const content = message.content || '';

      const toolCalls: ToolCallItem[] = [];

      // 1. Native Ollama tool_calls
      if (Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
        for (const tc of message.tool_calls) {
          const fn = tc.function || tc;
          let args = fn.arguments;
          if (typeof args === 'string') {
            try {
              args = JSON.parse(args);
            } catch {
              logger.warn({ args }, 'Failed to parse tool call arguments string');
              args = {};
            }
          }
          toolCalls.push({
            id: tc.id || `call_${Math.random().toString(36).substring(2, 9)}`,
            name: fn.name,
            arguments: args || {},
          });
        }
      }

      // 2. Text fallback: if no native tool calls were parsed but tools were requested, check if LLM wrote JSON
      if (toolCalls.length === 0 && request.tools && request.tools.length > 0 && content) {
        const fallbackCall = this.parseFallbackToolCall(content, request.tools);
        if (fallbackCall) {
          toolCalls.push(fallbackCall);
        }
      }

      return {
        content,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        finishReason: toolCalls.length > 0 ? 'tool_calls' : 'stop',
        usage: {
          promptTokens: data.prompt_eval_count || 0,
          completionTokens: data.eval_count || 0,
          totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
        },
      };
    } catch (error: any) {
      logger.error({ error: error.message, model: this.model }, 'Ollama generate failed');
      throw error;
    }
  }

  public async *stream(request: LLMRequest): AsyncIterable<LLMChunk> {
    const formattedMessages = this.formatMessages(request.messages);
    const formattedTools = request.tools ? this.formatTools(request.tools) : undefined;

    const payload: Record<string, any> = {
      model: this.model,
      messages: formattedMessages,
      stream: true,
      options: {
        temperature: request.temperature ?? 0.2,
      },
    };

    if (formattedTools && formattedTools.length > 0) {
      payload.tools = formattedTools;
    }

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok || !response.body) {
      throw new Error(`Ollama stream error: ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          try {
            const parsed = JSON.parse(trimmed);
            const chunkContent = parsed.message?.content || '';
            const isDone = Boolean(parsed.done);

            let toolCalls: ToolCallItem[] | undefined;
            if (Array.isArray(parsed.message?.tool_calls)) {
              toolCalls = parsed.message.tool_calls.map((tc: any) => ({
                id: tc.id || `call_${Math.random().toString(36).substring(2, 9)}`,
                name: tc.function?.name || tc.name,
                arguments: typeof tc.function?.arguments === 'string'
                  ? JSON.parse(tc.function.arguments)
                  : tc.function?.arguments || {},
              }));
            }

            yield {
              contentChunk: chunkContent,
              toolCallsChunk: toolCalls,
              isDone,
            };
          } catch {
            // Partial JSON line, continue
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private formatMessages(messages: ChatMessage[]): any[] {
    return messages.map((msg) => {
      const out: any = {
        role: msg.role,
        content: msg.content,
      };

      if (msg.toolCalls && msg.toolCalls.length > 0) {
        out.tool_calls = msg.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: {
            name: tc.name,
            arguments: tc.arguments,
          },
        }));
      }

      if (msg.role === 'tool') {
        out.role = 'tool';
      }

      return out;
    });
  }

  private formatTools(tools: ToolDefinition[]): any[] {
    return tools.map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }

  private parseFallbackToolCall(content: string, availableTools: ToolDefinition[]): ToolCallItem | null {
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, content];
      const rawJson = (jsonMatch[1] || content).trim();
      const parsed = JSON.parse(rawJson);

      const toolName = parsed.name || parsed.tool;
      const toolArgs = parsed.arguments || parsed.parameters || parsed.input;

      if (toolName && availableTools.some((t) => t.name === toolName)) {
        return {
          id: `call_${Math.random().toString(36).substring(2, 9)}`,
          name: toolName,
          arguments: typeof toolArgs === 'object' && toolArgs !== null ? toolArgs : {},
        };
      }
    } catch {
      // Not JSON
    }
    return null;
  }
}
