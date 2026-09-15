import { TextLLMProvider } from '../types';
import { getXAIKey, hasXAIKey } from '../keys';

export const xaiTextProvider: TextLLMProvider = {
  id: 'xai',
  name: 'xAI Grok',
  model: 'grok-2-mini',
  description: 'xAI Grok Chat API for prompt assistance and error diagnosis.',
  requiredEnvVar: 'XAI_API_KEY',

  hasKey: () => hasXAIKey(),

  getKeyStatus: () => ({
    hasKey: hasXAIKey(),
    envVar: 'XAI_API_KEY',
    detail: hasXAIKey() ? 'Configured in environment' : 'Missing XAI_API_KEY'
  }),

  generateText: async (prompt: string, systemInstruction?: string): Promise<string> => {
    const apiKey = await getXAIKey();
    if (!apiKey) {
      throw new Error("xAI Text LLM requires XAI_API_KEY in your environment.");
    }

    const messages = [];
    if (systemInstruction) {
      messages.push({ role: 'system', content: systemInstruction });
    }
    messages.push({ role: 'user', content: prompt });

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'grok-2-mini',
        messages,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      const msg = errJson.error?.message || response.statusText;
      throw new Error(`xAI API error (${response.status}): ${msg}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }
};
