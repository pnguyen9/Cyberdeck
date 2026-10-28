import { onMounted, onUnmounted } from 'vue'
import { useEditor } from './editorContext'

/**
 * Keeps what a tab has not saved: another tab or leaving the project waits for `ask` to have the
 * author save or drop it, and the browser asks before the page is closed or reloaded.
 */
export function useUnsavedChanges(hasChanges: () => boolean, ask: (proceed: () => void) => void) {
  const { setLeaveGuard } = useEditor()
  const onBeforeUnload = (event: BeforeUnloadEvent) => {
    if (hasChanges()) {
      event.preventDefault()
    }
  }
  onMounted(() => {
    setLeaveGuard(proceed => {
      if (!hasChanges()) {
        return true
      }
      ask(proceed)
      return false
    })
    window.addEventListener('beforeunload', onBeforeUnload)
  })
  onUnmounted(() => {
    setLeaveGuard(null)
    window.removeEventListener('beforeunload', onBeforeUnload)
  })
}
