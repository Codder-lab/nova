import { OpenAIProvider } from "./openai.provider";

export class GroqProvider extends OpenAIProvider {
  constructor(options?: { apiKey?: string; model?: string; baseUrl?: string }) {
    super({
      name: "groq",
      apiKey: options?.apiKey || process.env.GROQ_API_KEY || "",
      baseUrl: options?.baseUrl || "https://api.groq.com/openai/v1",
      model: options?.model || "llama-3.3-70b-versatile",
    });
  }
}
