import { GoogleGenAI } from '@google/genai';
import { VideoEngine, VideoGenerateOptions } from '../types';
import { getGeminiKey, hasGeminiKey } from '../keys';

export const googleVeoEngine: VideoEngine = {
  id: 'google-veo',
  name: 'Google Veo',
  model: 'veo-3.1-lite-generate-preview',
  description: "Google's state-of-the-art generative video model for cinematic animations.",
  isImplemented: true,
  requiredEnvVar: 'GEMINI_API_KEY (or API_KEY)',
  
  hasKey: () => {
    return hasGeminiKey();
  },

  getKeyStatus: () => {
    const present = hasGeminiKey();
    return {
      hasKey: present,
      envVar: 'GEMINI_API_KEY',
      detail: present ? 'Configured in environment' : 'Missing GEMINI_API_KEY / API_KEY'
    };
  },

  generateVideo: async (options: VideoGenerateOptions, onProgress?: (msg: string) => void): Promise<Blob> => {
    const apiKey = getGeminiKey();
    if (!apiKey) {
      throw new Error(
        "Google Veo video engine requires an API key. Please set GEMINI_API_KEY or API_KEY in your environment."
      );
    }

    const ai = new GoogleGenAI({ apiKey });
    onProgress?.("Contacting Google Veo video engine...");

    // Framing lock directive: Prepend to user prompt on every generateVideos call
    const framingLockDirective = "Locked camera, no pan, no zoom, no tilt. Keep the full subject inside the frame with a small margin. Nothing important may leave the edges.";
    const effectivePrompt = options.prompt.includes("Locked camera")
      ? options.prompt
      : `${framingLockDirective} ${options.prompt}`;

    let operation;
    try {
      operation = await ai.models.generateVideos({
        model: 'veo-3.1-lite-generate-preview',
        prompt: effectivePrompt,
        image: {
          imageBytes: options.image.imageBytes,
          mimeType: options.image.mimeType,
        },
        config: {
          numberOfVideos: 1,
          resolution: '720p',
          aspectRatio: options.aspectRatio,
        }
      });
    } catch (firstErr: any) {
      const errMsg = firstErr.message || (typeof firstErr === 'object' ? JSON.stringify(firstErr) : String(firstErr));
      if (errMsg.toLowerCase().includes("durationseconds") || errMsg.toLowerCase().includes("duration_seconds")) {
        console.warn("Retrying without durationSeconds to use Veo model default (5s):", errMsg);
        operation = await ai.models.generateVideos({
          model: 'veo-3.1-lite-generate-preview',
          prompt: effectivePrompt,
          image: {
            imageBytes: options.image.imageBytes,
            mimeType: options.image.mimeType,
          },
          config: {
            numberOfVideos: 1,
            resolution: '720p',
            aspectRatio: options.aspectRatio,
          }
        });
      } else if (
        firstErr.status === "PERMISSION_DENIED" ||
        firstErr.status === 403 ||
        errMsg.includes("PERMISSION_DENIED") ||
        errMsg.includes("403") ||
        errMsg.includes("The caller does not have permission")
      ) {
        throw new Error(
          "Permission Denied (403): Google Veo requires an active API key with paid billing or Veo access enabled in Google AI Studio / Google Cloud. Please choose a paid API key or verify project permissions."
        );
      } else {
        throw firstErr;
      }
    }

    onProgress?.("Google Veo is rendering the video sequence...");

    // Poll operation until complete
    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 10000));
      onProgress?.("Rendering frames in Veo diffusion pipeline...");
      operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    console.log("Veo video generation operation finished:", operation);

    // Handle server-side API error on the operation
    if (operation.error) {
      const errMsg = (operation.error as any).message || JSON.stringify(operation.error);
      if (errMsg.toLowerCase().includes("durationseconds") || errMsg.toLowerCase().includes("duration_seconds")) {
        console.warn("Retrying with default durationSeconds (5s)...");
        operation = await ai.models.generateVideos({
          model: 'veo-3.1-lite-generate-preview',
          prompt: effectivePrompt,
          image: {
            imageBytes: options.image.imageBytes,
            mimeType: options.image.mimeType,
          },
          config: {
            numberOfVideos: 1,
            resolution: '720p',
            aspectRatio: options.aspectRatio,
          }
        });
        while (!operation.done) {
          await new Promise(resolve => setTimeout(resolve, 10000));
          operation = await ai.operations.getVideosOperation({ operation: operation });
        }
        if (operation.error) {
          const retryErrMsg = (operation.error as any).message || JSON.stringify(operation.error);
          throw new Error(`Video generation retry failed: ${retryErrMsg}`);
        }
      } else {
        // Google-shaped error
        throw new Error(`Video generation failed: ${errMsg}`);
      }
    }

    const response = operation.response;
    if (response?.raiMediaFilteredCount && response.raiMediaFilteredCount > 0) {
      const reasons = response.raiMediaFilteredReasons?.join(", ") || "";
      throw new Error(`Video generation filtered due to safety/policy reasons (RAI)${reasons ? `: ${reasons}` : "."}`);
    }

    const downloadLink = response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) {
      throw new Error("Video generation completed, but no download link was found in the Veo response.");
    }

    onProgress?.("Downloading generated video asset...");
    const videoResponse = await fetch(downloadLink, {
      headers: {
        'x-goog-api-key': apiKey
      }
    });

    if (!videoResponse.ok) {
      throw new Error(`Failed to download video: ${videoResponse.statusText}`);
    }

    return await videoResponse.blob();
  }
};
