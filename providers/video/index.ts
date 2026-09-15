import { VideoEngine, VideoEngineId } from '../types';
import { googleVeoEngine } from './googleVeo';
import { STUB_VIDEO_ENGINES } from './stubs';

export const ALL_VIDEO_ENGINES: VideoEngine[] = [
  googleVeoEngine,
  ...STUB_VIDEO_ENGINES
];

const TEXT_LLM_IDS = ['google', 'openai', 'xai', 'anthropic', 'ollama', 'gemini', 'chatgpt', 'claude', 'grok'];

export function isTextLLMId(id: string): boolean {
  return TEXT_LLM_IDS.includes(id.toLowerCase());
}

export function validateVideoEngineSelection(id: string): { valid: boolean; error?: string } {
  if (isTextLLMId(id)) {
    return {
      valid: false,
      error: `Cannot use text LLM "${id}" as the video animator. Peachy requires a dedicated video engine (such as Google Veo) to animate images.`
    };
  }

  const engine = ALL_VIDEO_ENGINES.find(e => e.id === id);
  if (!engine) {
    return {
      valid: false,
      error: `Unknown video engine "${id}". Please select Google Veo.`
    };
  }

  return { valid: true };
}

export function getVideoEngine(id: VideoEngineId | string): VideoEngine {
  if (isTextLLMId(id)) {
    throw new Error(
      `Cannot use text LLM "${id}" as the video animator. Peachy requires a dedicated video engine (such as Google Veo) to animate images.`
    );
  }

  const engine = ALL_VIDEO_ENGINES.find(e => e.id === id);
  if (!engine) {
    console.warn(`Video engine "${id}" not found. Falling back to Google Veo.`);
    return googleVeoEngine;
  }

  return engine;
}

export { googleVeoEngine };
