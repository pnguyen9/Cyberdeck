import { electronProcessBuild } from '../desktop/src/electronBuild'
import { defineConfig } from 'vite'

/** `--mode main` or `--mode preload`: each Electron process bundled into `dist-electron/`. */
export default defineConfig(({ mode }) => electronProcessBuild(mode === 'preload' ? 'preload' : 'main'))
