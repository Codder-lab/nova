import { LLMRequest, LLMResponse, LLMChunk } from "@nova/shared";

export interface ProviderConnectionTestResult {
  success: boolean;
  latencyMs: number;
  error?: string;
  model: string;
}

export interface LLMProvider {
  name: string;
  model: string;
  generate(input: LLMRequest): Promise<LLMResponse>;
  stream(input: LLMRequest): AsyncIterable<LLMChunk>;
  supportsToolCalling(): boolean;
  testConnection?(): Promise<ProviderConnectionTestResult>;
}
