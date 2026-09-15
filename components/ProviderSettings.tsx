import React from 'react';
import { VideoEngineId, TextLLMId } from '../providers/types';
import { ALL_VIDEO_ENGINES, validateVideoEngineSelection } from '../providers/video';
import { ALL_TEXT_PROVIDERS } from '../providers/text';
import { Video, Bot, Key, AlertCircle, CheckCircle2, ShieldAlert } from 'lucide-react';

interface ProviderSettingsProps {
  selectedVideoEngine: VideoEngineId;
  onSelectVideoEngine: (engineId: VideoEngineId) => void;
  selectedTextLLM: TextLLMId;
  onSelectTextLLM: (llmId: TextLLMId) => void;
  videoEngineError?: string | null;
}

export const ProviderSettings: React.FC<ProviderSettingsProps> = ({
  selectedVideoEngine,
  onSelectVideoEngine,
  selectedTextLLM,
  onSelectTextLLM,
  videoEngineError
}) => {
  const currentVideoEngine = ALL_VIDEO_ENGINES.find(e => e.id === selectedVideoEngine) || ALL_VIDEO_ENGINES[0];
  const currentTextProvider = ALL_TEXT_PROVIDERS.find(p => p.id === selectedTextLLM);
  
  const videoKeyStatus = currentVideoEngine.getKeyStatus();
  const textKeyStatus = currentTextProvider ? currentTextProvider.getKeyStatus() : null;

  const handleVideoEngineChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value as VideoEngineId;
    onSelectVideoEngine(val);
  };

  const handleTextLLMChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value as TextLLMId;
    onSelectTextLLM(val);
  };

  const engineValidation = validateVideoEngineSelection(selectedVideoEngine);

  return (
    <div className="space-y-4 text-orange-950">
      {/* Informative Header */}
      <div className="flex items-center justify-between pb-2 border-b border-orange-100">
        <div className="text-xs font-semibold text-orange-800">
          Independent configuration for Video Generation Engine and optional Text LLM.
        </div>
      </div>

      {/* Video Engine Selection */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor="video-engine-select" className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-orange-900">
            <Video className="w-3.5 h-3.5 text-orange-600" />
            1. Video Engine (Required to Animate)
          </label>
          {currentVideoEngine.isImplemented ? (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
              <CheckCircle2 className="w-2.5 h-2.5" />
              Active Engine
            </span>
          ) : (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
              <AlertCircle className="w-2.5 h-2.5" />
              Stubbed Engine
            </span>
          )}
        </div>

        <select
          id="video-engine-select"
          value={selectedVideoEngine}
          onChange={handleVideoEngineChange}
          className="w-full p-2.5 bg-white border border-orange-200 rounded-xl text-sm font-semibold text-orange-950 focus:ring-2 focus:ring-orange-400 focus:border-orange-400 transition-all cursor-pointer"
        >
          <optgroup label="Implemented Video Engines">
            <option value="google-veo">
              Google Veo (veo-3.1-lite-generate-preview)
            </option>
          </optgroup>
          <optgroup label="Stubbed Video Engines (Not Implemented)">
            <option value="runway-gen3">Runway Gen-3 Alpha (Stub)</option>
            <option value="luma-dream-machine">Luma Dream Machine (Stub)</option>
            <option value="kling-video">Kling AI Video (Stub)</option>
            <option value="sora">OpenAI Sora (Stub)</option>
          </optgroup>
        </select>

        {/* Plain Error if a text LLM is picked as animator */}
        {(!engineValidation.valid || videoEngineError) && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-red-700 text-xs">
            <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{videoEngineError || engineValidation.error}</span>
          </div>
        )}

        {/* Video Key / Env Status */}
        <div className="p-2.5 bg-orange-50/60 border border-orange-100 rounded-xl text-[11px] space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-orange-900 flex items-center gap-1">
              <Key className="w-3 h-3 text-orange-500" />
              Environment Key:
            </span>
            <code className="bg-white px-1.5 py-0.5 rounded border border-orange-200 font-mono text-[10px] text-orange-850">
              {currentVideoEngine.requiredEnvVar}
            </code>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-orange-700">Key Status:</span>
            {videoKeyStatus.hasKey ? (
              <span className="text-emerald-700 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Available in environment
              </span>
            ) : (
              <span className="text-red-600 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                Missing from environment
              </span>
            )}
          </div>

          {!currentVideoEngine.isImplemented && (
            <p className="text-[10px] text-amber-800 italic pt-1 border-t border-orange-100">
              Note: This engine is stubbed behind the common interface. It is not faked with a chat model. Please use Google Veo to generate actual videos.
            </p>
          )}
        </div>
      </div>

      {/* Text LLM Selection (Optional) */}
      <div className="space-y-2 pt-2 border-t border-orange-100">
        <div className="flex items-center justify-between">
          <label htmlFor="text-llm-select" className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-orange-900">
            <Bot className="w-3.5 h-3.5 text-orange-600" />
            2. Text LLM (Optional: Prompt Help & Errors)
          </label>
          <span className="text-[10px] font-semibold text-orange-700">
            {selectedTextLLM === 'none' ? 'Disabled' : currentTextProvider?.name}
          </span>
        </div>

        <select
          id="text-llm-select"
          value={selectedTextLLM}
          onChange={handleTextLLMChange}
          className="w-full p-2.5 bg-white border border-orange-200 rounded-xl text-sm font-semibold text-orange-950 focus:ring-2 focus:ring-orange-400 focus:border-orange-400 transition-all cursor-pointer"
        >
          <option value="none">None (Disabled)</option>
          <option value="google">Google Gemini (gemini-2.5-flash)</option>
          <option value="openai">OpenAI GPT (gpt-4o-mini)</option>
          <option value="xai">xAI Grok (grok-2-mini)</option>
          <option value="anthropic">Anthropic Claude (claude-3-5-haiku)</option>
          <option value="ollama">Ollama Local (llama3.2 via OLLAMA_BASE_URL)</option>
        </select>

        {currentTextProvider && textKeyStatus && (
          <div className="p-2.5 bg-orange-50/60 border border-orange-100 rounded-xl text-[11px] space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-orange-900 flex items-center gap-1">
                <Key className="w-3 h-3 text-orange-500" />
                Required Env:
              </span>
              <code className="bg-white px-1.5 py-0.5 rounded border border-orange-200 font-mono text-[10px] text-orange-850">
                {currentTextProvider.requiredEnvVar}
              </code>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-orange-700">Status:</span>
              {textKeyStatus.hasKey ? (
                <span className="text-emerald-700 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Available in environment
                </span>
              ) : (
                <span className="text-amber-700 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Missing env key
                </span>
              )}
            </div>
            <p className="text-[10px] text-orange-700/80 pt-1 border-t border-orange-100">
              Each vendor connects directly to its own official API with no aggregators or proxy layers.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
