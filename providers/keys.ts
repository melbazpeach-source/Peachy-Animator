// Provider Key Accessor - strictly from env, never hardcoded.
// Respects: "Do not bake every key into the client bundle if you can avoid it. If Vite define stays, only inject the selected provider’s key."

export const getGeminiKey = (): string => {
  return (
    process.env.SELECTED_VIDEO_KEY ||
    process.env.API_KEY ||
    process.env.GEMINI_API_KEY ||
    (import.meta as any).env?.VITE_PEACHY_KEY ||
    ''
  );
};

export const hasGeminiKey = (): boolean => {
  if (process.env.HAS_GEMINI_KEY === 'true' || process.env.HAS_GEMINI_KEY === true) return true;
  return Boolean(getGeminiKey());
};

export const getOpenAIKey = async (): Promise<string> => {
  if (process.env.SELECTED_TEXT_KEY && (process.env.SELECTED_TEXT_LLM === 'openai')) {
    return process.env.SELECTED_TEXT_KEY;
  }
  // Try dev server endpoint if in development
  try {
    const res = await fetch('/api/provider-key?provider=openai');
    if (res.ok) {
      const data = await res.json();
      if (data.key) return data.key;
    }
  } catch {}
  return '';
};

export const hasOpenAIKey = (): boolean => {
  return process.env.HAS_OPENAI_KEY === 'true' || process.env.HAS_OPENAI_KEY === true;
};

export const getXAIKey = async (): Promise<string> => {
  if (process.env.SELECTED_TEXT_KEY && (process.env.SELECTED_TEXT_LLM === 'xai')) {
    return process.env.SELECTED_TEXT_KEY;
  }
  try {
    const res = await fetch('/api/provider-key?provider=xai');
    if (res.ok) {
      const data = await res.json();
      if (data.key) return data.key;
    }
  } catch {}
  return '';
};

export const hasXAIKey = (): boolean => {
  return process.env.HAS_XAI_KEY === 'true' || process.env.HAS_XAI_KEY === true;
};

export const getAnthropicKey = async (): Promise<string> => {
  if (process.env.SELECTED_TEXT_KEY && (process.env.SELECTED_TEXT_LLM === 'anthropic')) {
    return process.env.SELECTED_TEXT_KEY;
  }
  try {
    const res = await fetch('/api/provider-key?provider=anthropic');
    if (res.ok) {
      const data = await res.json();
      if (data.key) return data.key;
    }
  } catch {}
  return '';
};

export const hasAnthropicKey = (): boolean => {
  return process.env.HAS_ANTHROPIC_KEY === 'true' || process.env.HAS_ANTHROPIC_KEY === true;
};

export const getOllamaBaseUrl = (): string => {
  return process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
};
