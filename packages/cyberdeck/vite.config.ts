import vue from '@vitejs/plugin-vue'
import { defineConfig, mergeConfig } from 'vite'
import { fileBuild } from '../../fileBuild'

export default defineConfig(({ mode }) => mergeConfig({
  plugins: [vue()],
  // Datajack's development server keeps the default port.
  server: { port: 5174 },
}, mode === 'file' ? fileBuild() : {}))
