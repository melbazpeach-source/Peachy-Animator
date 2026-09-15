import { TextLLMId, TextLLMProvider } from '../types';
import { googleTextProvider } from './googleText';
import { openaiTextProvider } from './openaiText';
import { xaiTextProvider } from './xaiText';
import { anthropicTextProvider } from './anthropicText';
import { ollamaTextProvider } from './ollamaText';

export const ALL_TEXT_PROVIDERS: TextLLMProvider[] = [
  googleTextProvider,
  openaiTextProvider,
  xaiTextProvider,
  anthropicTextProvider,
  ollamaTextProvider
];

export function getTextProvider(id: TextLLMId): TextLLMProvider | null {
  if (id === 'none') return null;
  const provider = ALL_TEXT_PROVIDERS.find(p => p.id === id);
  return provider || null;
}

export async function enhanceAnimationPrompt(
  providerId: TextLLMId,
  currentPrompt: string,
  imageContext?: string
): Promise<string> {
  const provider = getTextProvider(providerId);
  if (!provider) {
    throw new Error("No Text LLM provider selected. Please select a Text LLM in Settings.");
  }

  const systemInstruction = 
    "You are a cinematic video prompt assistant for Peachy, an AI video animator. " +
    "Your job is to refine user descriptions into vivid, highly cinematic, physics-aware animation prompts suitable for video generation. " +
    "Focus on lighting, fluid camera movement, particle dynamics, and natural physics. " +
    "Keep your output concise: return ONLY the improved prompt text in 1-2 punchy sentences. Do not add conversational prefixes, quotes, or markdown explanations.";

  const userQuery = currentPrompt.trim()
    ? `Enhance this animation prompt for an image: "${currentPrompt}". Context: ${imageContext || 'General fruit/photo animation'}.`
    : `Suggest a creative, high-energy cinematic animation prompt for animating an image in Peachy video animator. Context: ${imageContext || 'Dynamic photo animation'}.`;

  const result = await provider.generateText(userQuery, systemInstruction);
  return result.replace(/^["']|["']$/g, '').trim();
}

export async function explainErrorCopy(
  providerId: TextLLMId,
  rawError: string
): Promise<string> {
  const provider = getTextProvider(providerId);
  if (!provider) return rawError;

  const systemInstruction = 
    "You are a helpful AI assistant for Peachy Video Animator. " +
    "Explain this technical error to a creative user in 1-2 friendly, clear sentences and suggest an actionable fix.";

  try {
    const result = await provider.generateText(`Explain this error concisely: "${rawError}"`, systemInstruction);
    return result.trim() || rawError;
  } catch {
    return rawError;
  }
}

export {
  googleTextProvider,
  openaiTextProvider,
  xaiTextProvider,
  anthropicTextProvider,
  ollamaTextProvider
};
