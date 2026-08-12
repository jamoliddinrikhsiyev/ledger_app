/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Master gate for outbound service calls. Only the string "true" opens it. */
  readonly VITE_SERVICES_ENABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
