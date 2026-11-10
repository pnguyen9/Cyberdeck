import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'
import { STAGE_HEIGHT, STAGE_WIDTH } from '../textboxLayout'

/**
 * Whether the window fills the screen, kept up to date, and the way to switch; `onRefused` says
 * what to do when the browser refuses.
 */
export function useFullscreen(onRefused: () => void = () => undefined) {
  const isFullscreen = ref(document.fullscreenElement !== null)
  const onChange = () => {
    isFullscreen.value = document.fullscreenElement !== null
  }
  const toggleFullscreen = () => {
    const change = document.fullscreenElement === null ? document.documentElement.requestFullscreen() : document.exitFullscreen()
    change.catch(onRefused)
  }
  onMounted(() => document.addEventListener('fullscreenchange', onChange))
  onBeforeUnmount(() => document.removeEventListener('fullscreenchange', onChange))
  return { isFullscreen, toggleFullscreen }
}

/** How much the stage is scaled to fit the element it is drawn in, whatever its size. */
export function useStageScale(viewport: Readonly<Ref<HTMLElement | null>>) {
  const scale = ref(1)
  const observer = new ResizeObserver(([entry]) => {
    if (entry !== undefined) {
      scale.value = Math.min(entry.contentRect.width / STAGE_WIDTH, entry.contentRect.height / STAGE_HEIGHT)
    }
  })
  onMounted(() => {
    if (viewport.value !== null) {
      observer.observe(viewport.value)
    }
  })
  onBeforeUnmount(() => observer.disconnect())
  return scale
}
