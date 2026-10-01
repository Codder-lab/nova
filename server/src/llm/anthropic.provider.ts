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

export class AnthropicProvider implements LLMProvider {
  public readonly name = "anthropic";
  public readonly model: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(options?: { apiKey?: string; model?: string; baseUrl?: string }) {
    this.apiKey = options?.apiKey || process.env.ANTHROPIC_API_KEY || "";
    this.model = options?.model || "claude-3-5-sonnet-20241022";
    this.baseUrl = (options?.baseUrl || "https://api.anthropic.com").replace(
      /\/+$/,
      "",
    );
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
        error:
          "Anthropic API key is not configured. Please add your API key in Model Settings.",
        model: this.model,
      };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      // Lightweight test request
      const res = await fetch(`${this.baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 1,
          messages: [{ role: "user", content: "ping" }],
        }),
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
            : err.message || "Failed to reach Anthropic API",
        model: this.model,
      };
    }
  }

  public async generate(request: LLMRequest): Promise<LLMResponse> {
    if (!this.apiKey) {
      throw new Error(
        "Anthropic API key is missing. Please enter your API key in Model Settings.",
      );
    }

    const { systemPrompt, anthropicMessages } = this.formatMessages(
      request.messages,
    );
    const formattedTools =
      request.tools && request.tools.length > 0
        ? this.formatTools(request.tools)
        : undefined;

    const payload: Record<string, any> = {
      model: this.model,
      max_tokens: request.maxTokens || 4096,
      messages: anthropicMessages,
      temperature: request.temperature ?? 0.2,
    };

    if (systemPrompt) {
      payload.system = systemPrompt;
    }

    if (formattedTools && formattedTools.length > 0) {
      payload.tools = formattedTools;
    }

    try {
      const response = await fetch(`${this.baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Anthropic API error (${response.status}): ${errorText}`,
        );
      }

      const data: any = await response.json();
      let textContent = "";
      const toolCalls: ToolCallItem[] = [];

      if (Array.isArray(data.content)) {
        for (const block of data.content) {
          if (block.type === "text") {
            textContent += block.text || "";
          } else if (block.type === "tool_use") {
            toolCalls.push({
              id: block.id,
              name: block.name,
              arguments: block.input || {},
            });
          }
        }
      }

      return {
        content: textContent,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        finishReason: toolCalls.length > 0 ? "tool_calls" : "stop",
        usage: {
          promptTokens: data.usage?.input_tokens || 0,
          completionTokens: data.usage?.output_tokens || 0,
          totalTokens:
            (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
        },
      };
    } catch (error: any) {
      logger.error(
        { error: error.message, model: this.model },
        "Anthropic generate failed",
      );
      throw error;
    }
  }

  public async *stream(request: LLMRequest): AsyncIterable<LLMChunk> {
    if (!this.apiKey) {
      throw new Error(
        "Anthropic API key is missing. Please configure it in Model Settings.",
      );
    }

    const { systemPrompt, anthropicMessages } = this.formatMessages(
      request.messages,
    );
    const formattedTools =
      request.tools && request.tools.length > 0
        ? this.formatTools(request.tools)
        : undefined;

    const payload: Record<string, any> = {
      model: this.model,
      max_tokens: request.maxTokens || 4096,
      messages: anthropicMessages,
      temperature: request.temperature ?? 0.2,
      stream: true,
    };

    if (systemPrompt) payload.system = systemPrompt;
    if (formattedTools && formattedTools.length > 0)
      payload.tools = formattedTools;

    const response = await fetch(`${this.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok || !response.body) {
      const errText = await response.text().catch(() => "");
      throw new Error(
        `Anthropic stream error (${response.status}): ${errText || response.statusText}`,
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
          if (!trimmed.startsWith("data: ")) continue;
          const raw = trimmed.slice(6);
          if (raw === "[DONE]") {
            yield { isDone: true };
            return;
          }

          try {
            const parsed = JSON.parse(raw);
            if (
              parsed.type === "content_block_delta" &&
              parsed.delta?.type === "text_delta"
            ) {
              yield {
                contentChunk: parsed.delta.text || "",
                isDone: false,
              };
            } else if (parsed.type === "message_stop") {
              yield { isDone: true };
              return;
            }
          } catch {
            // Partial JSON
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private formatMessages(messages: ChatMessage[]): {
    systemPrompt: string;
    anthropicMessages: any[];
  } {
    let systemPrompt = "";
    const anthropicMessages: any[] = [];

    for (const msg of messages) {
      if (msg.role === "system") {
        systemPrompt = msg.content;
      } else if (msg.role === "user") {
        anthropicMessages.push({
          role: "user",
          content: msg.content,
        });
      } else if (msg.role === "assistant") {
        const contentBlocks: any[] = [];
        if (msg.content) {
          contentBlocks.push({ type: "text", text: msg.content });
        }
        if (msg.toolCalls && msg.toolCalls.length > 0) {
          for (const tc of msg.toolCalls) {
            contentBlocks.push({
              type: "tool_use",
              id: tc.id || `call_${Math.random().toString(36).substring(2, 9)}`,
              name: tc.name,
              input: tc.arguments,
            });
          }
        }
        anthropicMessages.push({
          role: "assistant",
          content:
            contentBlocks.length === 1 && contentBlocks[0].type === "text"
              ? contentBlocks[0].text
              : contentBlocks,
        });
      } else if (msg.role === "tool") {
        anthropicMessages.push({
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: msg.toolCallId || "unknown_tool_use",
              content: msg.content,
            },
          ],
        });
      }
    }

    return { systemPrompt, anthropicMessages };
  }

  private formatTools(tools: ToolDefinition[]): any[] {
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: {
        type: "object",
        properties: tool.parameters.properties,
        required: tool.parameters.required || [],
      },
    }));
  }
}
