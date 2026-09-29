import { LLMProvider } from './provider';
import { OllamaProvider } from './ollama.provider';
import { env } from '../config/env';

export * from './provider';
export * from './ollama.provider';

let cachedProvider: LLMProvider | null = null;

export function getLLMProvider(providerName?: string): LLMProvider {
  const selected = providerName || env.LLM_PROVIDER;

  if (cachedProvider && cachedProvider.name === selected) {
    return cachedProvider;
  }

  switch (selected) {
    case 'ollama':
      cachedProvider = new OllamaProvider(env.OLLAMA_BASE_URL, env.OLLAMA_MODEL);
      return cachedProvider;
    default:
      // Default fallback is OllamaProvider
      cachedProvider = new OllamaProvider(env.OLLAMA_BASE_URL, env.OLLAMA_MODEL);
      return cachedProvider;
  }
}
