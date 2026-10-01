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

export class GeminiProvider implements LLMProvider {
  public readonly name = "gemini";
  public readonly model: string;
  private readonly apiKey: string;
  private readonly baseUrl = "https://generativelanguage.googleapis.com/v1beta";

  constructor(options?: { apiKey?: string; model?: string }) {
    this.apiKey = options?.apiKey || process.env.GEMINI_API_KEY || "";
    this.model = options?.model || "gemini-1.5-flash";
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
          "Google Gemini API key is not configured. Please enter your API key in Model Settings.",
        model: this.model,
      };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(`${this.baseUrl}/models?key=${this.apiKey}`, {
        method: "GET",
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
            : err.message || "Failed to reach Google Gemini API",
        model: this.model,
      };
    }
  }

  public async generate(request: LLMRequest): Promise<LLMResponse> {
    if (!this.apiKey) {
      throw new Error(
        "Google Gemini API key is missing. Please configure it in Model Settings.",
      );
    }

    const { systemInstruction, contents } = this.formatMessages(
      request.messages,
    );
    const formattedTools =
      request.tools && request.tools.length > 0
        ? this.formatTools(request.tools)
        : undefined;

    const payload: Record<string, any> = {
      contents,
      generationConfig: {
        temperature: request.temperature ?? 0.2,
      },
    };

    if (request.maxTokens) {
      payload.generationConfig.maxOutputTokens = request.maxTokens;
    }

    if (systemInstruction) {
      payload.systemInstruction = {
        parts: [{ text: systemInstruction }],
      };
    }

    if (formattedTools && formattedTools.length > 0) {
      payload.tools = formattedTools;
    }

    try {
      const url = `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error (${response.status}): ${errorText}`);
      }

      const data: any = await response.json();
      const candidate = data.candidates?.[0];
      const parts = candidate?.content?.parts || [];

      let content = "";
      const toolCalls: ToolCallItem[] = [];

      for (const part of parts) {
        if (part.text) {
          content += part.text;
        }
        if (part.functionCall) {
          const sig =
            part.thought_signature ||
            part.thoughtSignature ||
            part.functionCall?.thought_signature ||
            part.functionCall?.thoughtSignature;

          toolCalls.push({
            id: `call_${Math.random().toString(36).substring(2, 9)}`,
            name: part.functionCall.name,
            arguments: part.functionCall.args || {},
            thought_signature: sig,
            rawPart: part,
          });
        }
      }

      return {
        content,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        finishReason: toolCalls.length > 0 ? "tool_calls" : "stop",
        usage: {
          promptTokens: data.usageMetadata?.promptTokenCount || 0,
          completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
          totalTokens: data.usageMetadata?.totalTokenCount || 0,
        },
      };
    } catch (error: any) {
      logger.error(
        { error: error.message, model: this.model },
        "Gemini generate failed",
      );
      throw error;
    }
  }

  public async *stream(request: LLMRequest): AsyncIterable<LLMChunk> {
    if (!this.apiKey) {
      throw new Error(
        "Google Gemini API key is missing. Please configure it in Model Settings.",
      );
    }

    const { systemInstruction, contents } = this.formatMessages(
      request.messages,
    );
    const formattedTools =
      request.tools && request.tools.length > 0
        ? this.formatTools(request.tools)
        : undefined;

    const payload: Record<string, any> = {
      contents,
      generationConfig: {
        temperature: request.temperature ?? 0.2,
      },
    };

    if (request.maxTokens)
      payload.generationConfig.maxOutputTokens = request.maxTokens;
    if (systemInstruction) {
      payload.systemInstruction = { parts: [{ text: systemInstruction }] };
    }
    if (formattedTools && formattedTools.length > 0)
      payload.tools = formattedTools;

    const url = `${this.baseUrl}/models/${this.model}:streamGenerateContent?alt=sse&key=${this.apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok || !response.body) {
      const errText = await response.text().catch(() => "");
      throw new Error(
        `Gemini stream error (${response.status}): ${errText || response.statusText}`,
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

          try {
            const parsed = JSON.parse(raw);
            const candidate = parsed.candidates?.[0];
            const parts = candidate?.content?.parts || [];

            let contentChunk = "";
            let toolCallsChunk: ToolCallItem[] | undefined;

            for (const part of parts) {
              if (part.text) contentChunk += part.text;
              if (part.functionCall) {
                if (!toolCallsChunk) toolCallsChunk = [];
                const sig =
                  part.thought_signature ||
                  part.thoughtSignature ||
                  part.functionCall?.thought_signature ||
                  part.functionCall?.thoughtSignature;

                toolCallsChunk.push({
                  id: `call_${Math.random().toString(36).substring(2, 9)}`,
                  name: part.functionCall.name,
                  arguments: part.functionCall.args || {},
                  thought_signature: sig,
                  rawPart: part,
                });
              }
            }

            if (contentChunk || (toolCallsChunk && toolCallsChunk.length > 0)) {
              yield {
                contentChunk,
                toolCallsChunk,
                isDone: Boolean(candidate?.finishReason),
              };
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
    systemInstruction: string;
    contents: any[];
  } {
    let systemInstruction = "";
    const contents: any[] = [];

    for (const msg of messages) {
      if (msg.role === "system") {
        systemInstruction = msg.content;
      } else if (msg.role === "user") {
        contents.push({
          role: "user",
          parts: [{ text: msg.content }],
        });
      } else if (msg.role === "assistant") {
        const parts: any[] = [];
        if (msg.content) {
          parts.push({ text: msg.content });
        }
        if (msg.toolCalls && msg.toolCalls.length > 0) {
          for (const tc of msg.toolCalls) {
            const anyTc = tc as any;
            if (anyTc.rawPart) {
              parts.push(anyTc.rawPart);
            } else {
              const partObj: any = {
                functionCall: {
                  name: tc.name,
                  args: tc.arguments,
                },
              };
              const sig =
                anyTc.thought_signature ||
                anyTc.thoughtSignature ||
                (anyTc.arguments as any)?._thought_signature;
              if (sig) {
                partObj.thought_signature = sig;
              }
              parts.push(partObj);
            }
          }
        }
        contents.push({
          role: "model",
          parts: parts.length > 0 ? parts : [{ text: "" }],
        });
      } else if (msg.role === "tool") {
        let parsedContent: any = msg.content;
        try {
          parsedContent = JSON.parse(msg.content);
        } catch {
          parsedContent = { result: msg.content };
        }
        contents.push({
          role: "user",
          parts: [
            {
              functionResponse: {
                name: msg.name || "tool_result",
                response:
                  typeof parsedContent === "object"
                    ? parsedContent
                    : { output: parsedContent },
              },
            },
          ],
        });
      }
    }

    return { systemInstruction, contents };
  }

  private formatTools(tools: ToolDefinition[]): any[] {
    return [
      {
        functionDeclarations: tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          parameters: this.sanitizeSchemaForGemini(tool.parameters),
        })),
      },
    ];
  }

  private sanitizeSchemaForGemini(schema: any): any {
    if (!schema || typeof schema !== "object") return schema;

    const copy: any = Array.isArray(schema) ? [] : { ...schema };

    if (copy.type && typeof copy.type === "string") {
      copy.type = copy.type.toUpperCase();
    }

    // Google Gemini strictly requires `items` for ARRAY types
    if (copy.type === "ARRAY") {
      if (!copy.items) {
        copy.items = { type: "STRING" };
      } else {
        copy.items = this.sanitizeSchemaForGemini(copy.items);
      }
    }

    if (copy.properties && typeof copy.properties === "object") {
      const sanitizedProps: Record<string, any> = {};
      for (const [k, v] of Object.entries(copy.properties)) {
        sanitizedProps[k] = this.sanitizeSchemaForGemini(v);
      }
      copy.properties = sanitizedProps;
    }

    if (copy.items && copy.type !== "ARRAY") {
      copy.items = this.sanitizeSchemaForGemini(copy.items);
    }

    return copy;
  }
}
