/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Client ID público do Google Identity Services (o mesmo OAuth client do backend). */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
