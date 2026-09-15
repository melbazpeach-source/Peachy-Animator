import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    
    // Determine selected providers from env (default to google-veo and google)
    const selectedVideoEngine = env.SELECTED_VIDEO_ENGINE || 'google-veo';
    const selectedTextLLM = env.SELECTED_TEXT_LLM || 'google';

    const geminiKey = env.VITE_PEACHY_KEY || env.GEMINI_API_KEY || env.API_KEY || process.env.GEMINI_API_KEY || process.env.API_KEY || '';
    const openaiKey = env.OPENAI_API_KEY || process.env.OPENAI_API_KEY || '';
    const xaiKey = env.XAI_API_KEY || process.env.XAI_API_KEY || '';
    const anthropicKey = env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY || '';
    const ollamaBaseUrl = env.OLLAMA_BASE_URL || process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';

    // Only inject the selected video engine's key (not every key)
    const selectedVideoKey = selectedVideoEngine === 'google-veo' ? geminiKey : '';

    // Only inject the selected text provider's key
    let selectedTextKey = '';
    if (selectedTextLLM === 'google') selectedTextKey = geminiKey;
    else if (selectedTextLLM === 'openai') selectedTextKey = openaiKey;
    else if (selectedTextLLM === 'xai') selectedTextKey = xaiKey;
    else if (selectedTextLLM === 'anthropic') selectedTextKey = anthropicKey;

    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        {
          name: 'peachy-provider-api',
          configureServer(server) {
            // Internal dev-server endpoint to get provider availability (no keys exposed)
            server.middlewares.use('/api/provider-status', (_req, res) => {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                videoEngines: {
                  'google-veo': Boolean(geminiKey),
                  'runway-gen3': false,
                  'luma-dream-machine': false,
                  'kling-video': false,
                  'sora': false
                },
                textProviders: {
                  'none': true,
                  'google': Boolean(geminiKey),
                  'openai': Boolean(openaiKey),
                  'xai': Boolean(xaiKey),
                  'anthropic': Boolean(anthropicKey),
                  'ollama': true
                },
                selectedVideoEngine,
                selectedTextLLM,
                ollamaBaseUrl
              }));
            });

            // Dynamic key fetcher for the actively selected provider only (avoids baking unused keys into client bundle)
            server.middlewares.use('/api/provider-key', (req, res) => {
              const url = new URL(req.url || '', 'http://localhost');
              const provider = url.searchParams.get('provider');
              let key = '';
              if (provider === 'google' || provider === 'google-veo') key = geminiKey;
              else if (provider === 'openai') key = openaiKey;
              else if (provider === 'xai') key = xaiKey;
              else if (provider === 'anthropic') key = anthropicKey;
              else if (provider === 'ollama') key = ollamaBaseUrl;

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ key, hasKey: Boolean(key) }));
            });
          }
        }
      ],
      define: {
        // Only inject the selected provider's key (Requirement 4)
        'process.env.SELECTED_VIDEO_ENGINE': JSON.stringify(selectedVideoEngine),
        'process.env.SELECTED_TEXT_LLM': JSON.stringify(selectedTextLLM),
        'process.env.SELECTED_VIDEO_KEY': JSON.stringify(selectedVideoKey),
        'process.env.SELECTED_TEXT_KEY': JSON.stringify(selectedTextKey),
        // Preserve standard API_KEY definition for Veo compatibility
        'process.env.API_KEY': JSON.stringify(selectedVideoKey),
        'process.env.GEMINI_API_KEY': JSON.stringify(selectedVideoKey),
        'import.meta.env.VITE_PEACHY_KEY': JSON.stringify(selectedVideoKey),
        'process.env.OLLAMA_BASE_URL': JSON.stringify(ollamaBaseUrl),
        // Expose provider availability booleans (safe, no secret values)
        'process.env.HAS_GEMINI_KEY': JSON.stringify(Boolean(geminiKey)),
        'process.env.HAS_OPENAI_KEY': JSON.stringify(Boolean(openaiKey)),
        'process.env.HAS_XAI_KEY': JSON.stringify(Boolean(xaiKey)),
        'process.env.HAS_ANTHROPIC_KEY': JSON.stringify(Boolean(anthropicKey)),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});

