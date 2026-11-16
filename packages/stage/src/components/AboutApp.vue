<script setup lang="ts">
import { nextTick, ref, useTemplateRef } from 'vue'
import { GUIDE_ADDRESS, LICENSE_ADDRESS, REPOSITORY_ADDRESS, useAboutApp } from '../app/aboutApp'
import { isHosted } from '../app/howItRuns'
import { aboutMessages } from '../i18n/aboutMessages'
import { useLocale, useMessages } from '../i18n/locale'

/**
 * The foot of an application's first screen: its version and the About panel, what a web host's
 * browser may do to what it keeps, and the offer to reload into a new version once one is online.
 */
const about = useAboutApp()
const text = useMessages(aboutMessages)
const locale = useLocale()
const isOpen = ref(false)
const isOfferPutOff = ref(false)
const panel = useTemplateRef<HTMLElement>('panel')
const opener = useTemplateRef<HTMLButtonElement>('opener')

async function open() {
  isOpen.value = true
  await nextTick()
  panel.value?.focus()
}

function close() {
  isOpen.value = false
  opener.value?.focus()
}
</script>

<template>
  <footer v-if="about !== null" class="about-app">
    <p class="version-line">
      <span class="version">{{ about.name }} {{ about.version }}</span>
      · <button ref="opener" class="about-button" type="button" @click="open">{{ text.about }}</button>
    </p>
    <p v-if="isHosted(about.howItRuns)" class="may-erase">{{ text.mayErase }} {{ about.keepSafe[locale] }}</p>

    <div v-if="isOpen" class="overlay" @click.self="close" @keydown.esc.stop="close">
      <section ref="panel" class="about-panel" role="dialog" aria-modal="true" :aria-label="text.aboutApp(about.name)" tabindex="-1">
        <h2>{{ text.aboutApp(about.name) }}</h2>
        <p class="about-version">{{ text.version(about.version) }}</p>
        <p class="runs">{{ text.runs[about.howItRuns] }}</p>
        <p>{{ text.license }}<a :href="LICENSE_ADDRESS" target="_blank" rel="noopener noreferrer">{{ text.unlicense }}</a>{{ text.licenseAfter }}</p>
        <ul class="links">
          <li><a :href="GUIDE_ADDRESS" target="_blank" rel="noopener noreferrer">{{ text.guide }}</a></li>
          <li><a :href="REPOSITORY_ADDRESS" target="_blank" rel="noopener noreferrer">{{ text.repository }}</a></li>
        </ul>
        <button class="panel-button" type="button" @click="close">{{ text.close }}</button>
      </section>
    </div>

    <div v-if="about.newVersion.value !== null && !isOfferPutOff" class="new-version" role="status">
      <span>{{ text.newVersion(about.name) }}</span>
      <button class="panel-button primary" type="button" @click="about.newVersion.value?.()">{{ text.reload }}</button>
      <button class="panel-button" type="button" @click="isOfferPutOff = true">{{ text.later }}</button>
    </div>
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

.may-erase {
  max-width: 70ch;
}

.overlay {
  position: fixed;
  inset: 0;
  z-index: 20;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgb(0 0 0 / 60%);
}

.about-panel {
  box-sizing: border-box;
  width: min(520px, 100%);
  padding: 24px;
  border: var(--look-border-width) var(--look-border-style) var(--look-border-colour);
  border-radius: 8px;
  background: var(--look-surface);
  font-size: 15px;
  color: var(--look-text);
}

.about-panel:focus {
  outline: none;
}

.about-panel h2 {
  margin: 0 0 12px;
  font-size: 20px;
}

.about-panel p {
  margin: 0 0 10px;
}

.about-version {
  color: var(--look-accent);
  font-weight: 600;
}

.runs {
  color: var(--look-text-soft);
}

.about-panel a {
  color: var(--look-accent);
}

.links {
  margin: 0 0 16px;
  padding-left: 20px;
}

.panel-button {
  padding: 6px 14px;
  border: var(--look-border-width) var(--look-border-style) var(--look-border-colour);
  border-radius: 6px;
  background: var(--look-surface);
  font: inherit;
  color: var(--look-text);
  cursor: pointer;
}

.panel-button.primary {
  border-color: var(--look-accent);
  background: var(--look-accent-fill);
  color: var(--look-accent);
  font-weight: 600;
}

.new-version {
  position: fixed;
  bottom: 16px;
  left: 50%;
  z-index: 10;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  max-width: calc(100% - 32px);
  padding: 10px 16px;
  border: 1px solid var(--look-accent);
  border-radius: 8px;
  background: var(--look-ground);
  box-shadow: 0 4px 16px rgb(0 0 0 / 50%);
  font-size: 15px;
  color: var(--look-text);
  transform: translateX(-50%);
}
</style>
