/** The version of the application, from its package.json, set at build time (`webBuild.ts`). */
declare const __APP_VERSION__: string

/** What the stage reads of Vite's `import.meta.env`: whether the page comes from the development server. */
interface ImportMetaEnv {
  readonly DEV: boolean
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
