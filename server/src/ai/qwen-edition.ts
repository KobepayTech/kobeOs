export const QWEN_EDITION = 'qwen3-only';
export const QWEN_MODEL = 'qwen3-vl:8b';
export const isQwenEditionModel = (name: string) => [QWEN_MODEL, 'kobe-qwen3-vl:latest', 'kobe-qwen3-vl'].includes(name);
export const QWEN_MODEL_INFO = {
  id: QWEN_MODEL, name: 'Qwen 3-VL 8B', category: 'multimodal' as const,
  description: 'Local assistant for business, coding and image understanding. Install once, then use offline.',
  sizeGb: 6.2, recommended: true,
};
