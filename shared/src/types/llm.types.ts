export type ChatRole = "system" | "user" | "assistant" | "tool";

export interface ToolCallItem {
  id?: string;
  name: string;
  arguments: Record<string, unknown>;
  thought_signature?: string;
  rawPart?: Record<string, unknown>;
}

export interface ChatMessage {
  role: ChatRole;
  content: string;
  name?: string;
  toolCalls?: ToolCallItem[];
  toolCallId?: string;
}

export interface ToolParameterProperty {
  type: string;
  description?: string;
  enum?: string[];
  items?: ToolParameterProperty | Record<string, unknown>;
  [key: string]: unknown;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, ToolParameterProperty>;
    required?: string[];
  };
}

export interface LLMRequest {
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
}

export interface LLMResponse {
  content: string;
  toolCalls?: ToolCallItem[];
  finishReason?: "stop" | "tool_calls" | "length" | "error";
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface LLMChunk {
  contentChunk?: string;
  toolCallsChunk?: ToolCallItem[];
  isDone: boolean;
}

export type ModelProviderType =
  | "ollama"
  | "openai"
  | "anthropic"
  | "gemini"
  | "groq";

export interface ModelInfo {
  id: string;
  name: string;
  provider: ModelProviderType;
  providerName: string;
  contextWindow: number;
  supportsTools: boolean;
  supportsStreaming: boolean;
  isLocal: boolean;
  description: string;
  costPer1kInput?: number; // in USD
  costPer1kOutput?: number; // in USD
  recommendedFor?: string;
}

export interface UserModelSettings {
  activeProvider: ModelProviderType;
  activeModel: string;
  temperature?: number;
  maxTokens?: number;
  apiKeys?: {
    openai?: string;
    anthropic?: string;
    gemini?: string;
    groq?: string;
  };
  customBaseUrls?: {
    ollama?: string;
    openai?: string;
    groq?: string;
  };
}

export interface ModelBenchmarkResult {
  provider: ModelProviderType;
  model: string;
  success: boolean;
  latencyMs: number;
  error?: string;
  testedAt: string;
}

export interface ModelUsageMetrics {
  provider: string;
  model: string;
  totalRuns: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  avgLatencyMs: number;
  estimatedCostUsd: number;
}
