<script setup lang="ts">
import { nextTick, ref, useTemplateRef } from 'vue'
import { GUIDE_ADDRESS, LICENSE_ADDRESS, REPOSITORY_ADDRESS, useAboutApp } from '../app/aboutApp'
import { useBackdropClose } from '../app/backdropClose'
import { isHosted } from '../app/howItRuns'
import { aboutMessages } from '../i18n/aboutMessages'
import { useLocale, useMessages } from '../i18n/locale'

/**
 * The foot of an application's first screen: its version and the About panel, and what a web host's
 * browser may do to its data. The offer of a new version is `NewVersionBar`'s, at the top.
 */
const about = useAboutApp()
const text = useMessages(aboutMessages)
const locale = useLocale()
const isOpen = ref(false)
const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const opener = useTemplateRef<HTMLButtonElement>('opener')
const backdrop = useBackdropClose(dialog)

async function open() {
  isOpen.value = true
  await nextTick()
  dialog.value?.showModal()
}

function onClose() {
  isOpen.value = false
  opener.value?.focus()
}
</script>

<template>
  <footer v-if="about !== null" class="about-app">
    <p v-if="isHosted(about.howItRuns)" class="may-erase"><strong>{{ text.mayErase }}</strong> {{ about.keepSafe[locale] }}</p>
    <p class="version-line">
      <span class="version">{{ about.name }} {{ about.version }}</span>
      · <button ref="opener" class="about-button" type="button" aria-haspopup="dialog" @click="open">{{ text.about }}</button>
    </p>

    <dialog
      v-if="isOpen"
      ref="dialog"
      class="about-panel"
      aria-labelledby="about-app-title"
      @close="onClose"
      @pointerdown="backdrop.onPointerDown"
      @click="backdrop.onClick"
    >
      <h2 id="about-app-title">{{ text.aboutApp(about.name) }}</h2>
      <p class="about-version">{{ text.version(about.version) }}</p>
      <div class="runs">
        <p>{{ text.runs[about.howItRuns] }}</p>
        <p>{{ text.data[about.howItRuns] }}</p>
      </div>
      <div v-if="about.howItRuns === 'web'" class="install">
        <p>{{ text.install.intro }}</p>
        <ul>
          <li v-for="step in text.install.steps" :key="step">{{ step }}</li>
        </ul>
        <p>{{ text.install.note }}</p>
      </div>
      <p>
        {{ text.license }}<a :href="LICENSE_ADDRESS" target="_blank" rel="noopener noreferrer">{{ text.unlicense }}<span class="new-tab">{{ text.newTab }}</span></a>{{ text.licenseAfter }}
      </p>
      <ul class="links">
        <li><a :href="GUIDE_ADDRESS" target="_blank" rel="noopener noreferrer">{{ text.guide }}<span class="new-tab">{{ text.newTab }}</span></a></li>
        <li><a :href="REPOSITORY_ADDRESS" target="_blank" rel="noopener noreferrer">{{ text.repository }}<span class="new-tab">{{ text.newTab }}</span></a></li>
      </ul>
      <button class="button" type="button" @click="dialog?.close()">{{ text.close }}</button>
    </dialog>
  </footer>
</template>

<style scoped>
.about-app {
  margin-top: 40px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--look-muted);
}

.about-app p {
  margin: 0 0 4px;
}

.about-button {
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  color: inherit;
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}

.about-button:hover,
.about-button:focus-visible {
  color: var(--look-accent);
}

.about-button:focus-visible {
  outline: 2px solid var(--look-focus);
  outline-offset: 2px;
}

/* What the browser may do to the data, and how to keep it safe: a note to read, not small print. */
.about-app .may-erase {
  max-width: 70ch;
  margin: 0 0 12px;
  padding: 10px 14px;
  border: var(--look-control-border);
  border-radius: 8px;
  font-size: 15px;
  color: var(--look-text);
}

.about-panel {
  box-sizing: border-box;
  width: min(520px, calc(100vw - 32px));
  padding: 24px;
  border: var(--look-border-width) var(--look-border-style) var(--look-border-colour);
  border-radius: 8px;
  background: var(--look-ground);
  font: 15px/1.5 var(--look-font);
  color: var(--look-text);
}

.about-panel::backdrop {
  background: rgb(0 0 0 / 60%);
}

.about-panel h2 {
  margin: 0 0 12px;
  font-size: 20px;
}

.about-panel p {
  margin: 0 0 10px;
}

.runs p:first-child {
  margin-bottom: 2px;
}

.about-version {
  color: var(--look-accent);
  font-weight: 600;
}

.runs,
.install {
  color: var(--look-text-soft);
}

.about-panel a {
  color: var(--look-accent);
}

.about-panel a:focus-visible {
  outline: 2px solid var(--look-focus);
  outline-offset: 2px;
}

.new-tab {
  margin-left: 0.3em;
  font-size: 0.85em;
  color: var(--look-soft);
}

.install ul {
  margin: 0 0 10px;
  padding-left: 20px;
}

.install li + li {
  margin-top: 4px;
}

.links {
  margin: 0 0 16px;
  padding-left: 20px;
}
</style>
