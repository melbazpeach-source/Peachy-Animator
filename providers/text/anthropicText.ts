import { TextLLMProvider } from '../types';
import { getAnthropicKey, hasAnthropicKey } from '../keys';

export const anthropicTextProvider: TextLLMProvider = {
  id: 'anthropic',
  name: 'Anthropic Claude',
  model: 'claude-3-5-haiku-20241022',
  description: 'Anthropic Messages API for prompt refinement and error suggestions.',
  requiredEnvVar: 'ANTHROPIC_API_KEY',

  hasKey: () => hasAnthropicKey(),

  getKeyStatus: () => ({
    hasKey: hasAnthropicKey(),
    envVar: 'ANTHROPIC_API_KEY',
    detail: hasAnthropicKey() ? 'Configured in environment' : 'Missing ANTHROPIC_API_KEY'
  }),

  generateText: async (prompt: string, systemInstruction?: string): Promise<string> => {
    const apiKey = await getAnthropicKey();
    if (!apiKey) {
      throw new Error("Anthropic Text LLM requires ANTHROPIC_API_KEY in your environment.");
    }

    const payload: any = {
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    };

    if (systemInstruction) {
      payload.system = systemInstruction;
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      const msg = errJson.error?.message || response.statusText;
      throw new Error(`Anthropic API error (${response.status}): ${msg}`);
    }

    const data = await response.json();
    return data.content?.[0]?.text || '';
  }
};
