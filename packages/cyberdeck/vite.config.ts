import vue from '@vitejs/plugin-vue'
import { defineConfig, mergeConfig } from 'vite'
import { fileBuild } from '../../fileBuild'
import { webApp } from '../../webBuild'

const app = { name: 'Cyberdeck', description: 'A visual novel engine: write a story, preview it, export it as a game.', folder: import.meta.dirname }

export default defineConfig(({ mode }) => mergeConfig(mergeConfig({
  plugins: [vue()],
  // Datajack's development server keeps the default port.
  server: { port: 5174 },
}, webApp(app, mode)), mode === 'file' ? fileBuild() : {}))
