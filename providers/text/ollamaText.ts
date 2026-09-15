import { TextLLMProvider } from '../types';
import { getOllamaBaseUrl } from '../keys';

export const ollamaTextProvider: TextLLMProvider = {
  id: 'ollama',
  name: 'Ollama (Local LLM)',
  model: 'llama3.2',
  description: 'Local Ollama endpoint for private on-premise prompt help and error copy assistance.',
  requiredEnvVar: 'OLLAMA_BASE_URL (default http://127.0.0.1:11434)',

  hasKey: () => true, // Local endpoint does not require an API key

  getKeyStatus: () => ({
    hasKey: true,
    envVar: 'OLLAMA_BASE_URL',
    detail: `Endpoint: ${getOllamaBaseUrl()}`
  }),

  generateText: async (prompt: string, systemInstruction?: string): Promise<string> => {
    const baseUrl = getOllamaBaseUrl().replace(/\/+$/, '');
    
    let fullPrompt = prompt;
    if (systemInstruction) {
      fullPrompt = `[System Instructions]\n${systemInstruction}\n\n[User Request]\n${prompt}`;
    }

    try {
      const response = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama3.2',
          prompt: fullPrompt,
          stream: false
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama responded with status ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data.response || '';
    } catch (err: any) {
      throw new Error(
        `Failed to connect to Ollama at ${baseUrl}. Ensure Ollama is running locally (e.g. 'ollama serve' and 'ollama run llama3.2'). Original error: ${err.message}`
      );
    }
  }
};
