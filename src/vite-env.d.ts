/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  readonly VITE_API_URL?: string;
  /** HMAC-SHA256 secret for offline license verification. Must match backend LICENSE_HMAC_SECRET. */
  readonly VITE_LICENSE_HMAC_SECRET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Baked-in constants injected by vite.config.ts define block.
// Replaced at build time — no runtime env vars needed on user machines.
declare const __REGISTRY_URL__:         string;
declare const __REGISTRY_DOMAIN__:      string;
declare const __LICENSE_HMAC_SECRET__:  string;
