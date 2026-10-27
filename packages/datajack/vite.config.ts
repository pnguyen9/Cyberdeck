import vue from '@vitejs/plugin-vue'
import { defineConfig, mergeConfig } from 'vite'
import { fileBuild } from '../../fileBuild'

export default defineConfig(({ mode }) => mergeConfig({
  plugins: [vue()],
}, mode === 'file' ? fileBuild() : {}))
