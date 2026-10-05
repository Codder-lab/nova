import { ModelInfo } from "@nova/shared";

export const DEFAULT_MODEL_CATALOG: ModelInfo[] = [
  // --- Ollama (Local Models) ---
  {
    id: "qwen2.5:7b",
    name: "Qwen 2.5 7B",
    provider: "ollama",
    providerName: "Ollama (Local)",
    contextWindow: 32768,
    supportsTools: true,
    supportsStreaming: true,
    isLocal: true,
    isFree: true,
    description:
      "Alibaba's advanced open-weight model with strong tool calling and coding capabilities.",
    costPer1kInput: 0,
    costPer1kOutput: 0,
    recommendedFor: "Local offline development & everyday agent tasks",
  },
  {
    id: "llama3.2:3b",
    name: "Llama 3.2 3B",
    provider: "ollama",
    providerName: "Ollama (Local)",
    contextWindow: 131072,
    supportsTools: true,
    supportsStreaming: true,
    isLocal: true,
    isFree: true,
    description:
      "Meta's lightweight local model with blazing speed on low-resource machines.",
    costPer1kInput: 0,
    costPer1kOutput: 0,
    recommendedFor: "Quick tasks and low-RAM machines",
  },
  {
    id: "deepseek-r1:7b",
    name: "DeepSeek R1 7B",
    provider: "ollama",
    providerName: "Ollama (Local)",
    contextWindow: 32768,
    supportsTools: false,
    supportsStreaming: true,
    isLocal: true,
    isFree: true,
    description:
      "DeepSeek's distilled reasoning model specializing in math and logical problem solving.",
    costPer1kInput: 0,
    costPer1kOutput: 0,
    recommendedFor: "Deep reasoning & math step-by-step",
  },
  {
    id: "mistral:7b",
    name: "Mistral 7B",
    provider: "ollama",
    providerName: "Ollama (Local)",
    contextWindow: 32768,
    supportsTools: true,
    supportsStreaming: true,
    isLocal: true,
    isFree: true,
    description:
      "Mistral AI's standard 7B model with strong instruction following.",
    costPer1kInput: 0,
    costPer1kOutput: 0,
    recommendedFor: "General assistant tasks",
  },
];

