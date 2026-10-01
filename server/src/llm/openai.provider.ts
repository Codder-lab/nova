import { LLMProvider, ProviderConnectionTestResult } from "./provider";
import {
  LLMRequest,
  LLMResponse,
  LLMChunk,
  ToolCallItem,
  ChatMessage,
  ToolDefinition,
} from "@nova/shared";
import { logger } from "../utils/logger";

export class OpenAIProvider implements LLMProvider {
  public readonly name: string;
  public readonly model: string;
  public readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(options: {
    name?: string;
    apiKey?: string;
    baseUrl?: string;
    model?: string;
  }) {
    this.name = options.name || "openai";
    this.apiKey = options.apiKey || process.env.OPENAI_API_KEY || "";
    this.baseUrl = (
      options.baseUrl ||
      process.env.OPENAI_BASE_URL ||
      "https://api.openai.com/v1"
    ).replace(/\/+$/, "");
    this.model = options.model || "gpt-4o-mini";
  }

  public supportsToolCalling(): boolean {
    return true;
  }

  public async testConnection(): Promise<ProviderConnectionTestResult> {
    const start = Date.now();
    if (!this.apiKey) {
      return {
        success: false,
        latencyMs: 0,
        error: `API key is not configured for ${this.name}. Please enter your API key in Settings.`,
        model: this.model,
      };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(`${this.baseUrl}/models`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const latencyMs = Date.now() - start;
      if (!res.ok) {
        const errorText = await res.text().catch(() => "");
        return {
          success: false,
          latencyMs,
          error: `HTTP ${res.status}: ${errorText || res.statusText}`,
          model: this.model,
        };
      }

      return {
        success: true,
        latencyMs,
        model: this.model,
      };
    } catch (err: any) {
      return {
        success: false,
        latencyMs: Date.now() - start,
        error:
          err.name === "AbortError"
            ? "Connection timed out (6s)"
            : err.message || `Failed to connect to ${this.baseUrl}`,
        model: this.model,
      };
    }
  }

  public async generate(request: LLMRequest): Promise<LLMResponse> {
    if (!this.apiKey) {
      throw new Error(
        `API key is missing for provider '${this.name}'. Please configure your key in Model Settings.`,
      );
    }

    const formattedMessages = this.formatMessages(request.messages);
    const formattedTools =
      request.tools && request.tools.length > 0
        ? this.formatTools(request.tools)
        : undefined;

    const payload: Record<string, any> = {
      model: this.model,
      messages: formattedMessages,
      temperature: request.temperature ?? 0.2,
      stream: false,
    };

    if (request.maxTokens) {
      payload.max_tokens = request.maxTokens;
    }

    if (formattedTools && formattedTools.length > 0) {
      payload.tools = formattedTools;
      payload.tool_choice = "auto";
    }

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `${this.name} API error (${response.status}): ${errorText}`,
        );
      }

      const data: any = await response.json();
      const choice = data.choices?.[0] || {};
      const message = choice.message || {};
      const content = message.content || "";
      const toolCalls: ToolCallItem[] = [];

      if (Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
        for (const tc of message.tool_calls) {
          const fn = tc.function || tc;
          let args = fn.arguments;
          if (typeof args === "string") {
            try {
              args = JSON.parse(args);
            } catch {
              logger.warn({ args }, "Failed parsing tool call arguments JSON");
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

      // Fallback text JSON tool call if LLM returned JSON in markdown
      if (
        toolCalls.length === 0 &&
        request.tools &&
        request.tools.length > 0 &&
        content
      ) {
        const fallback = this.parseFallbackToolCall(content, request.tools);
        if (fallback) toolCalls.push(fallback);
      }

      return {
        content,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        finishReason: toolCalls.length > 0 ? "tool_calls" : "stop",
        usage: {
          promptTokens: data.usage?.prompt_tokens || 0,
          completionTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0,
        },
      };
    } catch (error: any) {
      logger.error(
        { error: error.message, model: this.model, provider: this.name },
        "OpenAI compatible generate failed",
      );
      throw error;
    }
  }

  public async *stream(request: LLMRequest): AsyncIterable<LLMChunk> {
    if (!this.apiKey) {
      throw new Error(
        `API key is missing for provider '${this.name}'. Please configure your key in Model Settings.`,
      );
    }

    const formattedMessages = this.formatMessages(request.messages);
    const formattedTools =
      request.tools && request.tools.length > 0
        ? this.formatTools(request.tools)
        : undefined;

    const payload: Record<string, any> = {
      model: this.model,
      messages: formattedMessages,
      temperature: request.temperature ?? 0.2,
      stream: true,
    };

    if (request.maxTokens) {
      payload.max_tokens = request.maxTokens;
    }

    if (formattedTools && formattedTools.length > 0) {
      payload.tools = formattedTools;
      payload.tool_choice = "auto";
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok || !response.body) {
      const errText = await response.text().catch(() => "");
      throw new Error(
        `${this.name} stream error (${response.status}): ${errText || response.statusText}`,
      );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(":")) continue;
          if (trimmed === "data: [DONE]") {
            yield { isDone: true };
            return;
          }

          if (trimmed.startsWith("data: ")) {
            const raw = trimmed.slice(6);
            try {
              const parsed = JSON.parse(raw);
              const delta = parsed.choices?.[0]?.delta;
              const contentChunk = delta?.content || "";
              let toolCallsChunk: ToolCallItem[] | undefined;

              if (Array.isArray(delta?.tool_calls)) {
                toolCallsChunk = delta.tool_calls.map((tc: any) => ({
                  id: tc.id,
                  name: tc.function?.name || "",
                  arguments: tc.function?.arguments || {},
                }));
              }

              if (
                contentChunk ||
                (toolCallsChunk && toolCallsChunk.length > 0)
              ) {
                yield {
                  contentChunk,
                  toolCallsChunk,
                  isDone: false,
                };
              }
            } catch {
              // Ignore partial JSON
            }
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
          type: "function",
          function: {
            name: tc.name,
            arguments:
              typeof tc.arguments === "string"
                ? tc.arguments
                : JSON.stringify(tc.arguments),
          },
        }));
      }

      if (msg.role === "tool") {
        out.tool_call_id = msg.toolCallId || "call_unknown";
      }

      return out;
    });
  }

  private formatTools(tools: ToolDefinition[]): any[] {
    return tools.map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }

  private parseFallbackToolCall(
    content: string,
    availableTools: ToolDefinition[],
  ): ToolCallItem | null {
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [
        null,
        content,
      ];
      const rawJson = (jsonMatch[1] || content).trim();
      const parsed = JSON.parse(rawJson);

      const toolName = parsed.name || parsed.tool;
      const toolArgs = parsed.arguments || parsed.parameters || parsed.input;

      if (toolName && availableTools.some((t) => t.name === toolName)) {
        return {
          id: `call_${Math.random().toString(36).substring(2, 9)}`,
          name: toolName,
          arguments:
            typeof toolArgs === "object" && toolArgs !== null ? toolArgs : {},
        };
      }
    } catch {
      // Not json
    }
    return null;
  }
}
