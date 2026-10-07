import { env } from '../config/env';
import { AppError } from '../errors/AppError';
import { MockAiProvider } from './mockProvider';
import { OpenRouterProvider } from './openRouterProvider';
import type { AiProvider } from './types';

let provider: AiProvider | null = null;

// AI_MOCK=true -> offline MockAiProvider; otherwise OpenRouter with OPENROUTER_API_KEY + AI_MODEL.
export function getAiProvider(): AiProvider {
  if (provider) return provider;
  if (env.AI_MOCK) {
    provider = new MockAiProvider();
  } else {
    if (!env.OPENROUTER_API_KEY) {
      throw new AppError(503, 'AI_NOT_CONFIGURED', 'OPENROUTER_API_KEY is not set (or set AI_MOCK=true for offline mode).');
    }
    provider = new OpenRouterProvider(env.OPENROUTER_API_KEY, env.AI_MODEL);
  }
  return provider;
}

// Lets tests inject a provider (e.g. one that returns a deliberately broken draft).
export function setAiProvider(next: AiProvider | null): void {
  provider = next;
}

export type { AiProvider, DirectoryEntry, ExtractionRequest } from './types';
