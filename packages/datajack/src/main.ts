import { readKeyboardLayout } from '@cyberdeck/stage'
import { createApp } from 'vue'
import App from './App.vue'

// The player's settings are read with the default keys of their keyboard, known once its layout is.
void readKeyboardLayout().then(() => createApp(App).mount('#app'))
