import { LLMRequest, LLMResponse, LLMChunk } from "@nova/shared";

export interface LLMProvider {
  name: string;
  generate(input: LLMRequest): Promise<LLMResponse>;
  stream(input: LLMRequest): AsyncIterable<LLMChunk>;
  supportsToolCalling(): boolean;
}
