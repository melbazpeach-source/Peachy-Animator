import { VideoEngine, VideoGenerateOptions } from '../types';

export const runwayGen3Engine: VideoEngine = {
  id: 'runway-gen3',
  name: 'Runway Gen-3 Alpha',
  model: 'gen3a_turbo',
  description: 'Runway multimodal video generation model (Engine stub).',
  isImplemented: false,
  requiredEnvVar: 'RUNWAYML_API_SECRET',
  hasKey: () => false,
  getKeyStatus: () => ({
    hasKey: false,
    envVar: 'RUNWAYML_API_SECRET',
    detail: 'Stubbed engine (not implemented in backend)'
  }),
  generateVideo: async (_options: VideoGenerateOptions): Promise<Blob> => {
    throw new Error(
      "Video engine 'Runway Gen-3' is a stubbed video engine and is not yet implemented. Please select 'Google Veo' as your active video engine."
    );
  }
};

export const lumaDreamMachineEngine: VideoEngine = {
  id: 'luma-dream-machine',
  name: 'Luma Dream Machine',
  model: 'ray-2',
  description: 'Luma AI high-fidelity video model (Engine stub).',
  isImplemented: false,
  requiredEnvVar: 'LUMA_API_KEY',
  hasKey: () => false,
  getKeyStatus: () => ({
    hasKey: false,
    envVar: 'LUMA_API_KEY',
    detail: 'Stubbed engine (not implemented in backend)'
  }),
  generateVideo: async (_options: VideoGenerateOptions): Promise<Blob> => {
    throw new Error(
      "Video engine 'Luma Dream Machine' is a stubbed video engine and is not yet implemented. Please select 'Google Veo' as your active video engine."
    );
  }
};

export const klingVideoEngine: VideoEngine = {
  id: 'kling-video',
  name: 'Kling AI Video',
  model: 'kling-v1.5',
  description: 'Kuaishou Kling video generation model (Engine stub).',
  isImplemented: false,
  requiredEnvVar: 'KLING_API_KEY',
  hasKey: () => false,
  getKeyStatus: () => ({
    hasKey: false,
    envVar: 'KLING_API_KEY',
    detail: 'Stubbed engine (not implemented in backend)'
  }),
  generateVideo: async (_options: VideoGenerateOptions): Promise<Blob> => {
    throw new Error(
      "Video engine 'Kling AI Video' is a stubbed video engine and is not yet implemented. Please select 'Google Veo' as your active video engine."
    );
  }
};

export const soraEngine: VideoEngine = {
  id: 'sora',
  name: 'OpenAI Sora',
  model: 'sora-preview',
  description: 'OpenAI video generation model (Engine stub).',
  isImplemented: false,
  requiredEnvVar: 'OPENAI_API_KEY',
  hasKey: () => false,
  getKeyStatus: () => ({
    hasKey: false,
    envVar: 'OPENAI_API_KEY',
    detail: 'Stubbed engine (not implemented in backend)'
  }),
  generateVideo: async (_options: VideoGenerateOptions): Promise<Blob> => {
    throw new Error(
      "Video engine 'OpenAI Sora' is a stubbed video engine and is not yet implemented. Please select 'Google Veo' as your active video engine."
    );
  }
};

export const STUB_VIDEO_ENGINES: VideoEngine[] = [
  runwayGen3Engine,
  lumaDreamMachineEngine,
  klingVideoEngine,
  soraEngine
];
