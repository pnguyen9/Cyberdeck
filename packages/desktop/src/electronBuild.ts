import type { UserConfig } from 'vite'

/**
 * Vite settings bundling one Electron process of an application into one file: the main process as
 * a module, the preload as CommonJS, which sandboxed preloads require. Shared code is bundled in,
 * so that a packaged application needs nothing but its `dist/` and `dist-electron/` folders.
 * Imported by relative path: Vite loads configuration files with Node, which reads no TypeScript
 * from other packages.
 */
export function electronProcessBuild(process: 'main' | 'preload'): UserConfig {
  return {
    build: {
      ssr: true,
      outDir: 'dist-electron',
      emptyOutDir: process === 'main',
      target: 'node22',
      rollupOptions: {
        input: process === 'main' ? 'electron/main.ts' : 'electron/preload.ts',
        external: ['electron', /^node:/],
        output: { format: process === 'main' ? 'es' : 'cjs', entryFileNames: process === 'main' ? 'main.js' : 'preload.cjs' },
      },
    },
    ssr: { noExternal: true },
  }
}
