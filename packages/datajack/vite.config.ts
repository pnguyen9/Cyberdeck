import vue from '@vitejs/plugin-vue'
import { defineConfig, mergeConfig } from 'vite'
import { webApp } from '../../webBuild'

const app = { name: 'Datajack', description: 'The player of visual novels made with Cyberdeck.', folder: import.meta.dirname }

export default defineConfig(({ mode }) => mergeConfig({
  plugins: [vue()],
}, webApp(app, mode)))
