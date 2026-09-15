export type VideoEngineId = 
  | 'google-veo'
  | 'runway-gen3'
  | 'luma-dream-machine'
  | 'kling-video'
  | 'sora';

export type TextLLMId = 
  | 'none'
  | 'google'
  | 'openai'
  | 'xai'
  | 'anthropic'
  | 'ollama';

export interface VideoGenerateOptions {
  image: {
    imageBytes: string; // base64 representation without data prefix
    mimeType: string;
  };
  prompt: string;
  aspectRatio: '16:9' | '9:16';
  durationSeconds?: number;
  motionStrength?: number;
}

export interface VideoEngineKeyStatus {
  hasKey: boolean;
  envVar: string;
  detail?: string;
}

export interface VideoEngine {
  id: VideoEngineId;
  name: string;
  model: string;
  description: string;
  isImplemented: boolean;
  requiredEnvVar: string;
  hasKey: () => boolean;
  getKeyStatus: () => VideoEngineKeyStatus;
  generateVideo: (
    options: VideoGenerateOptions,
    onProgress?: (message: string) => void
  ) => Promise<Blob>;
}

export interface TextLLMKeyStatus {
  hasKey: boolean;
  envVar: string;
  detail?: string;
}

export interface TextLLMProvider {
  id: TextLLMId;
  name: string;
  model: string;
  description: string;
  requiredEnvVar: string;
  hasKey: () => boolean;
  getKeyStatus: () => TextLLMKeyStatus;
  generateText: (
    prompt: string,
    systemInstruction?: string
  ) => Promise<string>;
}

export interface ProviderConfig {
  videoEngineId: VideoEngineId;
  textLLMId: TextLLMId;
}
