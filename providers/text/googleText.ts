import { GoogleGenAI } from '@google/genai';
import { TextLLMProvider } from '../types';
import { getGeminiKey, hasGeminiKey } from '../keys';

export const googleTextProvider: TextLLMProvider = {
  id: 'google',
  name: 'Google Gemini',
  model: 'gemini-2.5-flash',
  description: 'Google native text model for prompt engineering, copy assistance, and error debugging.',
  requiredEnvVar: 'GEMINI_API_KEY (or API_KEY)',
  
  hasKey: () => hasGeminiKey(),

  getKeyStatus: () => ({
    hasKey: hasGeminiKey(),
    envVar: 'GEMINI_API_KEY',
    detail: hasGeminiKey() ? 'Configured in environment' : 'Missing GEMINI_API_KEY'
  }),

  generateText: async (prompt: string, systemInstruction?: string): Promise<string> => {
    const apiKey = getGeminiKey();
    if (!apiKey) {
      throw new Error("Google Text LLM requires GEMINI_API_KEY or API_KEY in your environment.");
    }

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: systemInstruction ? { systemInstruction } : undefined
    });

    return response.text || '';
  }
};
