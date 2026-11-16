import vue from '@vitejs/plugin-vue'
import { defineConfig, mergeConfig } from 'vite'
import { fileBuild } from '../../fileBuild'
import { webApp } from '../../webBuild'

const app = { name: 'Datajack', description: 'The player of visual novels made with Cyberdeck.', folder: import.meta.dirname }

export default defineConfig(({ mode }) => mergeConfig(mergeConfig({
  plugins: [vue()],
}, webApp(app, mode)), mode === 'file' ? fileBuild() : {}))
