'use strict';
const profile = require('./editions/qwen3-only.json');
function editionEnvironment(edition) {
  if (edition !== profile.id) return {};
  return {
    KOBE_AI_EDITION: profile.id,
    OLLAMA_MODEL: profile.model,
    OLLAMA_EVERYDAY_MODEL: profile.model,
    OLLAMA_ROUTER_MODEL: profile.model,
    OLLAMA_REASONING_MODEL: profile.model,
    OLLAMA_CODER_MODEL: profile.model,
    OLLAMA_VISION_MODEL: profile.model,
    OLLAMA_MAX_CONCURRENT: '1',
    OLLAMA_KEEP_ALIVE: '5m',
    KOBE_AI_FALLBACK_URL: '',
    KOBE_AI_FALLBACK_API_KEY: '',
  };
}
module.exports = { profile, editionEnvironment };
