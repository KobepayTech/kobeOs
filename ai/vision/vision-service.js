'use strict';

/**
 * ai/vision/vision-service.js
 *
 * Computer vision via LLaVA / Moondream through Ollama.
 *
 * Capabilities:
 *   - analyseImage(base64, prompt)   — describe or answer questions about an image
 *   - detectObjects(base64)          — list objects in an image
 *   - readText(base64)               — OCR via vision model
 *   - analyseFrame(base64, context)  — sports/video frame analysis
 */

class VisionService {
  constructor(ollamaBridge, defaultModel = 'llava:7b') {
    this.ollama       = ollamaBridge;
    this.defaultModel = defaultModel;
    this._fallback    = 'moondream:1.8b'; // smaller fallback
  }

  async _visionChat(imageBase64, prompt, model) {
    if (!this.ollama) throw new Error('Ollama bridge not configured');
    const available = await this.ollama.isAvailable();
    if (!available) throw new Error('Ollama not running — vision requires Ollama');

    const result = await this.ollama.chat(model || this.defaultModel, [
      { role: 'user', content: prompt, images: [imageBase64] },
    ]);
    return result?.message?.content || result?.response || '';
  }

  /**
   * Analyse an image with a custom prompt.
   * imageBase64: base64-encoded JPEG/PNG (no data: prefix needed).
   */
  async analyseImage(imageBase64, prompt = 'Describe this image in detail.', model) {
    return this._visionChat(imageBase64, prompt, model);
  }

  /**
   * Detect and list objects in an image.
   */
  async detectObjects(imageBase64, model) {
    const result = await this._visionChat(
      imageBase64,
      'List all objects you can see in this image. Format as a comma-separated list.',
      model,
    );
    return {
      raw: result,
      objects: result.split(',').map(s => s.trim()).filter(Boolean),
    };
  }

  /**
   * Extract text from an image (OCR).
   */
  async readText(imageBase64, model) {
    return this._visionChat(
      imageBase64,
      'Extract and return all text visible in this image. Return only the text, nothing else.',
      model,
    );
  }

  /**
   * Analyse a sports/video frame.
   * context: match context string (teams, score, time, etc.)
   */
  async analyseFrame(imageBase64, context = '', model) {
    const prompt = context
      ? `Analyse this football match frame. Context: ${context}. Describe player positions, ball location, and tactical situation.`
      : 'Analyse this sports frame. Describe what is happening, player positions, and key tactical elements.';
    return this._visionChat(imageBase64, prompt, model);
  }

  /**
   * Check if a vision model is available.
   */
  async isAvailable(model) {
    if (!this.ollama) return false;
    try {
      const models = await this.ollama.listModels();
      const target = model || this.defaultModel;
      return models.some(m => m.name === target || m.name.startsWith(target.split(':')[0]));
    } catch {
      return false;
    }
  }

  getStatus() {
    return {
      defaultModel: this.defaultModel,
      fallbackModel: this._fallback,
      ollamaConfigured: !!this.ollama,
    };
  }
}

module.exports = VisionService;
