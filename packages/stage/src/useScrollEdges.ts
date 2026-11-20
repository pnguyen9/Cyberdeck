import { onUnmounted, ref, watch, type Ref } from 'vue'

/**
 * Where a scrolling element has more beyond each of its edges, and how much room its scrollbars
 * take, for a list or a map to show it. Measured as it scrolls; the scrollbars, when the element or
 * its `content` changes size (a larger text, a smaller window, another map). Each value is a
 * primitive, set again to the same when nothing changed: scrolling redraws nothing until an edge is
 * reached or left.
 */
export function useScrollEdges(element: Readonly<Ref<HTMLElement | null>>, content?: Readonly<Ref<HTMLElement | null>>) {
  const moreLeft = ref(false)
  const moreRight = ref(false)
  const moreUp = ref(false)
  const moreDown = ref(false)
  const scrollbarRight = ref(0)
  const scrollbarBottom = ref(0)

  function measure() {
    const scroller = element.value
    if (scroller === null) {
      return
    }
    moreLeft.value = scroller.scrollLeft > 1
    moreRight.value = scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 1
    moreUp.value = scroller.scrollTop > 1
    moreDown.value = scroller.scrollTop + scroller.clientHeight < scroller.scrollHeight - 1
  }

  const resizeObserver = new ResizeObserver(() => {
    const scroller = element.value
    if (scroller !== null) {
      scrollbarRight.value = scroller.offsetWidth - scroller.clientWidth
      scrollbarBottom.value = scroller.offsetHeight - scroller.clientHeight
    }
    measure()
  })
  watch([element, () => content?.value ?? null], observed => {
    resizeObserver.disconnect()
    for (const observedElement of observed) {
      if (observedElement !== null) {
        resizeObserver.observe(observedElement)
      }
    }
  }, { flush: 'post', immediate: true })
  onUnmounted(() => resizeObserver.disconnect())

  return { moreLeft, moreRight, moreUp, moreDown, scrollbarRight, scrollbarBottom, measure }
}
