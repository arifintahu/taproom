/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Chain used when the URL names none: "onyx" on the hosted site; unset means the mock chain. */
  readonly VITE_DEFAULT_CHAIN?: string
}
