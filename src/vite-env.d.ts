/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Baked-in constants injected by vite.config.ts define block.
// Replaced at build time — no runtime env vars needed on user machines.
declare const __REGISTRY_URL__:    string;
declare const __REGISTRY_DOMAIN__: string;
