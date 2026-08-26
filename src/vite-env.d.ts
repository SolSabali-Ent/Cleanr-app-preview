/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_KINEX_URL?: string;
  readonly VITE_KINEX_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
