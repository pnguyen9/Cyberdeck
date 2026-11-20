import { readKeyboardLayout, removeSplash } from '@cyberdeck/stage'
import { createApp } from 'vue'
import App from './App.vue'
import './editor.css'

// The preview's settings are read with the default keys of the author's keyboard, known once its layout is.
void readKeyboardLayout().then(() => {
  createApp(App).mount('#app')
  removeSplash()
})
