import { TextLLMProvider } from '../types';
import { getOpenAIKey, hasOpenAIKey } from '../keys';

export const openaiTextProvider: TextLLMProvider = {
  id: 'openai',
  name: 'OpenAI GPT',
  model: 'gpt-4o-mini',
  description: 'OpenAI official Chat Completions API for prompt help and copy assistance.',
  requiredEnvVar: 'OPENAI_API_KEY',

  hasKey: () => hasOpenAIKey(),

  getKeyStatus: () => ({
    hasKey: hasOpenAIKey(),
    envVar: 'OPENAI_API_KEY',
    detail: hasOpenAIKey() ? 'Configured in environment' : 'Missing OPENAI_API_KEY'
  }),

  generateText: async (prompt: string, systemInstruction?: string): Promise<string> => {
    const apiKey = await getOpenAIKey();
    if (!apiKey) {
      throw new Error("OpenAI Text LLM requires OPENAI_API_KEY in your environment.");
    }

    const messages = [];
    if (systemInstruction) {
      messages.push({ role: 'system', content: systemInstruction });
    }
    messages.push({ role: 'user', content: prompt });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      const msg = errJson.error?.message || response.statusText;
      throw new Error(`OpenAI API error (${response.status}): ${msg}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }
};
