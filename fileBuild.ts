import type { UserConfig } from 'vite'

/**
 * Builds a page that opens from its file, double-clicked, without a server: browsers refuse module
 * scripts and `crossorigin` loads from `file://` addresses, so the code becomes one classic script
 * and every path is relative. Used by `npm run build:file` in Cyberdeck and Datajack.
 */
export function fileBuild(): UserConfig {
  return {
    base: './',
    build: {
      outDir: 'dist-file',
      modulePreload: false,
      rollupOptions: { output: { format: 'iife', inlineDynamicImports: true } },
    },
    plugins: [{
      name: 'classic-script',
      enforce: 'post',
      transformIndexHtml: html => html.replace(/<script type="module" crossorigin/g, '<script defer').replace(/ crossorigin/g, ''),
    }],
  }
}
