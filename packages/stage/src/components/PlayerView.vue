<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef, useTemplateRef, watch } from 'vue'
import {
  actionForKey,
  actionForMouseButton,
  actionForWheel,
  describeInput,
  MOUSE_BUTTON,
  type PlayerAction,
} from '../input/bindings'
import { useLocale, useMessages, type LanguageChoice } from '../i18n/locale'
import { playerMessages } from '../i18n/playerMessages'
import { storyLocale, storyMessages } from '../i18n/storyMessages'
import { DEFAULT_PLAYER_SETTINGS, type PlayerSettings } from '../settings/playerSettings'
import {
  createStageCatalog,
  emptyProgress,
  recordChoiceReached,
  recordEndReached,
  recordIllustrationSeen,
  recordMemories,
  recordPageRead,
  checkAuthorCss,
  normalizeName,
  RESERVED_STYLE_NAMES,
  safeFileName,
  stateFromSave,
  styleClassName,
  StoryRuntime,
  toSave,
  waitMillisecondsOf,
  EFFECT_DEFAULTS,
  type Cue,
  type PendingOption,
  type PlayableStory,
  type PlayerSnapshot,
  type ProgressData,
  type RestoreOutcome,
  type SaveData,
  type StoredPage,
} from '@cyberdeck/core'
import { AUTOSAVE_SLOT, MANUAL_SLOTS, type SaveStore } from '../saveStore'
import { STAGE_HEIGHT, STAGE_WIDTH } from '../textboxLayout'
import BacklogPanel, { type BacklogLine } from './BacklogPanel.vue'
import ChoiceMenu from './ChoiceMenu.vue'
import SaveLoadPanel, { type SlotSummary } from './SaveLoadPanel.vue'
import SettingsPanel from './SettingsPanel.vue'
import MusicPlayer from './MusicPlayer.vue'
import StageView from './StageView.vue'
import TextBox from './TextBox.vue'
import FullScreenText from './FullScreenText.vue'
import type { StyledPart } from '../textRuns'

const props = defineProps<{
  story: PlayableStory
  saveStore: SaveStore
  /** Resumes this save instead of starting the story. */
  resumeFrom: SaveData | null
  /** Where leaving the game goes: `Library`, `Text`. */
  leaveLabel: string
  /** Offers the map of the routes explored, which the application shows when asked. */
  canOpenMap?: boolean
}>()
const emit = defineEmits<{ leave: []; map: [] }>()
/** The player's choices: text speed, volumes, inputs. The application keeps them. */
const settings = defineModel<PlayerSettings>('settings', { default: () => DEFAULT_PLAYER_SETTINGS })
/** The application's language, which the Settings panel offers when the application gives it. */
const languageChoice = defineModel<LanguageChoice>('languageChoice')

const locale = useLocale()
const text = useMessages(playerMessages)
/** The end screen speaks the game's language, whoever plays it. */
const storyText = computed(() => storyMessages[storyLocale(props.story.project)])
const escapeKey = computed(() => describeInput({ type: 'key', code: 'Escape' }, locale.value))

/** While skipping, each page already read stays this long. */
const SKIP_INTERVAL_MILLISECONDS = 70
/** A worn mouse sends two clicks a few milliseconds apart; a deliberate second click takes longer. */
const MINIMUM_CLICK_INTERVAL_MILLISECONDS = 150
/** Wheels and trackpads send bursts of events: one step at most per interval. */
const MINIMUM_WHEEL_INTERVAL_MILLISECONDS = 250

const bindings = computed(() => settings.value.bindings)

const runtime = new StoryRuntime(props.story)
const catalog = createStageCatalog(props.story)
const snapshot = shallowRef<PlayerSnapshot>(runtime.snapshot)
const canGoBack = ref(false)
const errorMessage = ref<string | null>(null)
const openPanel = ref<'none' | 'log' | 'save' | 'load' | 'settings'>('none')
/** The text box and the menu hidden, to look at the picture; any input shows them again. */
const isTextHidden = ref(false)
/** The video over the whole screen: the text waits until it ends, or the player passes it. */
const playingVideo = ref<{ url: string } | null>(null)
const videoElement = useTemplateRef<HTMLVideoElement>('video')
/** The text, choices and menu: hidden by the player, and under a panel or the end screen, which have their own buttons. */
const isHudShown = computed(() => !isTextHidden.value && openPanel.value === 'none' && snapshot.value.step.type !== 'end' && errorMessage.value === null && titleCard.value === null && playingVideo.value === null)
const isFullscreen = ref(document.fullscreenElement !== null)
const notice = ref<string | null>(null)
let noticeTimer: ReturnType<typeof setTimeout> | undefined
const NOTICE_MILLISECONDS = 3500
const visibleLength = ref(0)
let typingTimer: ReturnType<typeof setTimeout> | undefined
let lastClickTime = Number.NEGATIVE_INFINITY
/** What this profile has seen of the game over every playthrough; loaded before the game starts. */
const progress = shallowRef<ProgressData>(emptyProgress(props.story))
/** The choice shown last, and the option picked there until we know where it leads. */
let currentPointKey: string | null = null
let pendingOption: PendingOption | null = null
/** Whether the page shown had been read before: skipping passes only those. */
let pageWasRead = false
const isSkipping = ref(false)
let skipTimer: ReturnType<typeof setTimeout> | undefined
let lastWheelTime = Number.NEGATIVE_INFINITY

const page = computed(() => snapshot.value.step.type === 'page' ? snapshot.value.step.page : null)
const choice = computed(() => snapshot.value.step.type === 'choice' ? snapshot.value.step.choice : null)
/** The styled parts of a page, with the properties of their styles. */
function stylesOf(shownPage: StoredPage): StyledPart[] {
  return (shownPage.styles ?? []).map(span => {
    const style = stylesById.value.get(span.styleId)
    return {
      start: span.start,
      end: span.end,
      properties: style?.properties ?? [],
      ...(style === undefined ? {} : { authorClass: `author-${styleClassName(style.name)}` }),
    }
  })
}
const stylesById = computed(() => new Map(props.story.project.styles.map(style => [style.id, style])))

/**
 * The game's own CSS, checked again here since games are downloaded: added to the page while the
 * story plays, as a stylesheet of its own, and taken away after.
 */
const authorSheet = new CSSStyleSheet()
document.adoptedStyleSheets = [...document.adoptedStyleSheets, authorSheet]
watch(() => props.story.project.css, css => authorSheet.replaceSync(checkAuthorCss(css ?? '').css), { immediate: true })

/**
 * The game's fonts, which its CSS names: read as bytes and given to the page, nothing loaded from
 * elsewhere; taken away with the story. A font that cannot be read leaves its text in another font.
 */
const loadedFonts: FontFace[] = []
let isLeaving = false
async function loadFonts() {
  for (const font of catalog.fonts) {
    try {
      const face = new FontFace(font.name, await (await fetch(font.url)).arrayBuffer())
      await face.load()
      if (isLeaving) {
        return
      }
      document.fonts.add(face)
      loadedFonts.push(face)
    } catch {
      // The text shows in the next font of the CSS, or the text box's.
    }
  }
}
void loadFonts()
const pageStyles = computed(() => page.value === null ? [] : stylesOf(page.value))
/** In full-screen text, the pages of the screen, up to the one shown; null in a text box. */
const screenful = shallowRef<StoredPage[]>([])
const fullScreenPages = computed(() => snapshot.value.stage.textMode !== 'full'
  ? null
  : screenful.value.map(shownPage => ({
    id: shownPage.id,
    speaker: shownPage.speakerId === null ? null : catalog.characterName(shownPage.speakerId),
    text: shownPage.text,
    styles: stylesOf(shownPage),
  })))
const isTypingComplete = computed(() => page.value !== null && visibleLength.value >= page.value.text.length)
/** Where the speaker stands, for the name plate to sit above; null when not on stage. */
const speakerX = computed(() => snapshot.value.stage.characters.find(onStage => onStage.characterId === page.value?.speakerId)?.x ?? null)
const speakerName = computed(() => page.value?.speakerId == null ? null : catalog.characterName(page.value.speakerId))
const musicUrl = computed(() => snapshot.value.stage.musicId === null ? null : catalog.musicUrl(snapshot.value.stage.musicId))
const endingName = computed(() => {
  const step = snapshot.value.step
  return step.type === 'end' && step.endingId !== null ? props.story.project.endings.find(ending => ending.id === step.endingId)?.name ?? null : null
})
/** The map, once a choice has been reached: before, it would have nothing to show. */
const isMapOffered = computed(() => props.canOpenMap === true && progress.value.points.length > 0)
/** The title of a chapter just started, over the stage before its text: each time one starts, if the game shows them. */
const titleCard = ref<{ chapterId: string; title: string } | null>(null)
let titleCardTimer: ReturnType<typeof setTimeout> | undefined
const TITLE_CARD_MILLISECONDS = 2800

/** The looks of a reserved style, `chapter title` or `ending`: its properties, and its class in the game's CSS. */
function reservedStyleClasses(styleName: string): string[] {
  const style = props.story.project.styles.find(candidate => normalizeName(candidate.name) === styleName)
  return [...(style?.properties ?? []).map(property => `style-${property}`), `author-${styleClassName(styleName)}`]
}

/** Plays forward, then shows the title of a chapter just started; its text starts typing once the title is gone. */
function playForward(action: () => void) {
  const chapterBefore = runtime.currentChapter
  act(action)
  const chapter = runtime.currentChapter
  if (props.story.project.chapterTitleCards === true && chapter !== null && chapter !== chapterBefore && chapter.title !== null && !isSkipping.value) {
    titleCard.value = { chapterId: chapter.id, title: chapter.title }
    clearTimeout(titleCardTimer)
    titleCardTimer = setTimeout(dismissTitleCard, TITLE_CARD_MILLISECONDS)
    return
  }
  startTyping()
}

/** Going back or loading leaves the chapter's start behind: its title goes, and nothing waits for it. */
function forgetTitleCard() {
  clearTimeout(titleCardTimer)
  titleCard.value = null
}

function dismissTitleCard() {
  clearTimeout(titleCardTimer)
  if (titleCard.value !== null) {
    titleCard.value = null
    startTyping()
  }
}

const endingsReached = computed(() => props.story.project.endings.filter(ending => progress.value.endingIds.includes(ending.id)).length)

/**
 * Runs a runtime action and shows its new state; a story that loops becomes an error message,
 * not a frozen page. Reaching a new page or choice autosaves.
 */
/** Sound effects playing, stopped when the player is closed. Skipping passes them by. */
const playingSounds = new Set<HTMLAudioElement>()
/** The line being spoken: one at a time, stopped as the player moves on. */
let voice: HTMLAudioElement | null = null
/** A line reached with a video, spoken once the video is over. */
let voiceAfterVideo: string | null = null
const sceneElement = useTemplateRef<HTMLElement>('scene')
const flashElement = useTemplateRef<HTMLElement>('flash')
const FLASH_COLORS = { white: '#fff', red: '#e11d48', black: '#000' } as const
const SHAKE_DISTANCES = { light: 12, strong: 32 } as const

/** Effects played once as the story reaches them: sounds, voices, videos, shakes, flashes. */
function playCues(cues: readonly Cue[]) {
  if (isSkipping.value) {
    return
  }
  for (const cue of cues) {
    switch (cue.type) {
      case 'sound':
        playSound(cue.soundId)
        break
      case 'voice':
        if (playingVideo.value === null) {
          playVoice(cue.soundId)
        } else {
          voiceAfterVideo = cue.soundId
        }
        break
      case 'video':
        playVideo(cue.videoId)
        break
      case 'shake': {
        const distance = SHAKE_DISTANCES[cue.strength]
        // Ever smaller jolts, side to side and a little up and down.
        const keyframes = Array.from({ length: 9 }, (_, index) => {
          const fading = 1 - index / 8
          const side = index % 2 === 0 ? 1 : -1
          return { transform: index === 8 ? 'none' : `translate(${side * distance * fading}px, ${-side * distance * 0.4 * fading}px)` }
        })
        sceneElement.value?.animate(keyframes, { duration: cue.durationMs ?? EFFECT_DEFAULTS.shakeMs, easing: 'linear' })
        break
      }
      case 'flash':
        flashElement.value?.animate(
          [{ opacity: 1, background: FLASH_COLORS[cue.color] }, { opacity: 0, background: FLASH_COLORS[cue.color] }],
          { duration: cue.durationMs ?? EFFECT_DEFAULTS.flashMs, easing: 'ease-out' },
        )
        break
    }
  }
}

function playSound(soundId: string) {
  const url = catalog.soundUrl(soundId)
  if (url === null) {
    return
  }
  const sound = new Audio(url)
  sound.volume = settings.value.soundVolume
  playingSounds.add(sound)
  sound.addEventListener('ended', () => playingSounds.delete(sound))
  // Browsers refuse to play before the page received a click or a key.
  sound.play().catch(() => playingSounds.delete(sound))
}

function playVoice(soundId: string) {
  stopVoice()
  const url = catalog.soundUrl(soundId)
  if (url === null) {
    return
  }
  const line = new Audio(url)
  line.volume = settings.value.voiceVolume
  voice = line
  line.play().catch(() => undefined)
}

function stopVoice() {
  voice?.pause()
  voice = null
  voiceAfterVideo = null
}

/** Coming back to a page, by going back or loading, its line is heard again; its other effects are not. */
function replayVoice() {
  const shown = page.value
  const line = shown === null ? undefined : [...shown.commandsBefore, ...shown.inlineCommands].find(command => command.type === 'voice')
  if (line?.type === 'voice' && !isSkipping.value) {
    playVoice(line.soundId)
  }
}

function playVideo(videoId: string) {
  const url = catalog.videoUrl(videoId)
  if (url === null) {
    return
  }
  clearTimeout(typingTimer)
  playingVideo.value = { url }
}

/** Starts the video once shown; a browser that refuses to play sound before a click plays it muted rather than not at all. */
watch(videoElement, element => {
  if (element !== null) {
    element.volume = settings.value.musicVolume
    element.play().catch(() => {
      element.muted = true
      return element.play()
    }).catch(endVideo)
  }
})

/** The video ended or was passed: the text it held back goes on. */
function endVideo() {
  if (playingVideo.value === null) {
    return
  }
  playingVideo.value = null
  if (voiceAfterVideo !== null) {
    playVoice(voiceAfterVideo)
  }
  if (page.value !== null && !isTypingComplete.value) {
    if (visibleLength.value === 0) {
      startTyping()
    } else {
      typeNextCharacter()
    }
  }
}

function act(action: () => void) {
  const stepBefore = runtime.snapshot.step
  try {
    action()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error)
  }
  snapshot.value = runtime.snapshot
  screenful.value = runtime.screenfulPages()
  canGoBack.value = runtime.canGoBack
  if (runtime.snapshot.step !== stepBefore) {
    stopVoice()
    playingVideo.value = null
  }
  playCues(runtime.takeCues())
  if (runtime.snapshot.step !== stepBefore) {
    recordProgress()
  }
  if (runtime.snapshot.step !== stepBefore && runtime.snapshot.step.type !== 'end') {
    void props.saveStore.write(props.story.project.id, AUTOSAVE_SLOT, toSave(props.story, runtime.exportState(), new Date().toISOString()))
      .then(isWritten => {
        if (!isWritten) {
          showNotice(text.value.autosaveFailed)
        }
      })
  }
}

/** Notes the page read, the choice reached or the end, and where the option picked last led. */
function recordProgress() {
  const step = runtime.snapshot.step
  let recorded = progress.value
  if (step.type === 'page') {
    pageWasRead = recorded.readPageIds.includes(step.page.id)
    recorded = recordPageRead(recorded, step.page.id)
  } else if (step.type === 'choice') {
    const reached = recordChoiceReached(recorded, props.story, runtime.exportState(), pendingOption, new Date().toISOString())
    recorded = reached.progress
    currentPointKey = reached.pointKey
    pendingOption = null
  } else {
    recorded = recordEndReached(recorded, step.endingId, pendingOption)
    pendingOption = null
  }
  recorded = recordMemories(recorded, runtime.memoryIds)
  recorded = recordIllustrationSeen(recorded, runtime.snapshot.stage.illustrationId)
  if (recorded !== progress.value) {
    progress.value = recorded
    void props.saveStore.writeProgress(props.story.project.id, recorded)
  }
}

function showNotice(message: string) {
  clearTimeout(noticeTimer)
  notice.value = message
  noticeTimer = setTimeout(() => {
    notice.value = null
  }, NOTICE_MILLISECONDS)
}

function resume(save: SaveData) {
  forgetTitleCard()
  let outcome: RestoreOutcome = 'exact'
  act(() => {
    outcome = runtime.restoreState(stateFromSave(props.story, save))
  })
  errorMessage.value = null
  startTyping()
  replayVoice()
  showNotice(text.value.restored[outcome])
}

const backlogLines = ref<BacklogLine[]>([])

function openLog() {
  backlogLines.value = runtime.backlog().map(entry => entry.type === 'page'
    ? { stopIndex: entry.stopIndex, speaker: entry.page.speakerId === null ? null : catalog.characterName(entry.page.speakerId), text: entry.page.text, styles: stylesOf(entry.page), isChoice: false }
    : { stopIndex: entry.stopIndex, speaker: null, text: entry.optionText, styles: [], isChoice: true })
  openPanel.value = 'log'
}

const slotSummaries = ref<SlotSummary[]>([])
/** The playthrough as a file, offered while the Save panel is open: nothing moves in the meantime. */
const saveFile = shallowRef<{ url: string; name: string } | null>(null)

function forgetSaveFile() {
  if (saveFile.value !== null) {
    URL.revokeObjectURL(saveFile.value.url)
    saveFile.value = null
  }
}

watch(openPanel, panel => {
  if (panel !== 'save') {
    forgetSaveFile()
  }
})

async function openSlots(mode: 'save' | 'load') {
  const gameId = props.story.project.id
  if (mode === 'save') {
    const now = new Date()
    const save = toSave(props.story, runtime.exportState(), now.toISOString())
    const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}h${String(now.getMinutes()).padStart(2, '0')}`
    saveFile.value = {
      url: URL.createObjectURL(new Blob([JSON.stringify(save, null, 2)], { type: 'application/json' })),
      name: `${safeFileName(`${props.story.project.name} ${stamp}`, 'save')}.json`,
    }
  }
  const slots = [
    ...(mode === 'load' ? [{ slot: AUTOSAVE_SLOT, label: text.value.autosaveSlot }] : []),
    ...MANUAL_SLOTS.map(slot => ({ slot, label: text.value.slot(slot) })),
  ]
  slotSummaries.value = await Promise.all(slots.map(async summary => ({ ...summary, save: await props.saveStore.read(gameId, summary.slot) })))
  openPanel.value = mode
}

async function pickSlot(slot: string) {
  const gameId = props.story.project.id
  const mode = openPanel.value
  openPanel.value = 'none'
  if (mode === 'save') {
    const isWritten = await props.saveStore.write(gameId, slot, toSave(props.story, runtime.exportState(), new Date().toISOString()))
    showNotice(isWritten ? text.value.savedInSlot(slot) : text.value.saveFailed)
  } else {
    const save = await props.saveStore.read(gameId, slot)
    if (save !== null) {
      resume(save)
    }
  }
}

function goBackTo(stopIndex: number) {
  openPanel.value = 'none'
  errorMessage.value = null
  pendingOption = null
  forgetTitleCard()
  act(() => runtime.backTo(stopIndex))
  showWholePage()
  replayVoice()
}

/** Starts the text once the animations the page waits for are over. */
function startTyping() {
  clearTimeout(typingTimer)
  visibleLength.value = 0
  if (playingVideo.value !== null) {
    return
  }
  const delayMilliseconds = (page.value?.commandsBefore ?? []).reduce((total, command) => total + waitMillisecondsOf(command, runtime.context), 0)
  const type = settings.value.textSpeed === 0 ? showWholePage : typeNextCharacter
  if (delayMilliseconds > 0) {
    typingTimer = setTimeout(type, delayMilliseconds)
  } else {
    type()
  }
  continueSkipping()
}

/** Passes the page if it was read before; new text, a choice or the end stops skipping. */
function continueSkipping() {
  clearTimeout(skipTimer)
  if (!isSkipping.value) {
    return
  }
  const shownPage = page.value
  if (shownPage === null || !pageWasRead) {
    isSkipping.value = false
    return
  }
  skipTimer = setTimeout(() => {
    if (isSkipping.value && page.value === shownPage) {
      showWholePage()
      playForward(() => runtime.next())
    }
  }, SKIP_INTERVAL_MILLISECONDS)
}

function toggleSkipping() {
  if (isSkipping.value) {
    isSkipping.value = false
    clearTimeout(skipTimer)
  } else if (page.value !== null && pageWasRead) {
    isSkipping.value = true
    continueSkipping()
  } else {
    showNotice(text.value.skipsReadTextOnly)
  }
}

/** Shows one more character, after the inline commands written at this point; `[wait]` and waited animations pause. */
function typeNextCharacter() {
  const text = page.value?.text
  if (text === undefined) {
    return
  }
  let reachedCommands: ReturnType<StoryRuntime['reachOffset']> = []
  act(() => {
    reachedCommands = runtime.reachOffset(visibleLength.value)
  })
  // A video reached in the text holds it back until it ends.
  if (visibleLength.value >= text.length || playingVideo.value !== null) {
    return
  }

  const waitMilliseconds = reachedCommands.reduce((total, command) => total + waitMillisecondsOf(command, runtime.context), 0)
  typingTimer = setTimeout(() => {
    visibleLength.value++
    typeNextCharacter()
  }, waitMilliseconds + 1000 / Math.max(1, settings.value.textSpeed))
}

function showWholePage() {
  clearTimeout(typingTimer)
  const currentPage = page.value
  if (currentPage !== null) {
    visibleLength.value = currentPage.text.length
    act(() => runtime.reachOffset(currentPage.text.length))
  }
}

/** First press shows the whole page at once; the next one moves on. */
function advance() {
  if (page.value === null) {
    return
  }
  if (!isTypingComplete.value) {
    showWholePage()
    return
  }
  playForward(() => runtime.next())
}

/** The previous page comes back complete: it was already read. */
function goBack() {
  if (!runtime.canGoBack) {
    return
  }
  errorMessage.value = null
  pendingOption = null
  forgetTitleCard()
  act(() => runtime.back())
  showWholePage()
  replayVoice()
}

function choose(optionId: string) {
  pendingOption = currentPointKey === null ? null : { pointKey: currentPointKey, optionId }
  playForward(() => runtime.choose(optionId))
}

function toggleFullscreen() {
  const change = document.fullscreenElement === null ? document.documentElement.requestFullscreen() : document.exitFullscreen()
  change.catch(() => showNotice(text.value.fullscreenUnavailable))
}

function perform(action: PlayerAction) {
  // A video is passed by moving on, or by skipping; going back, the menus and leaving still work over it.
  if (playingVideo.value !== null && (action === 'advance' || action === 'skip' || action === 'hideText')) {
    endVideo()
    return
  }
  if (isTextHidden.value && action !== 'fullscreen') {
    isTextHidden.value = false
    return
  }
  // A title card is passed by moving on: the text after it starts, nothing more. Skipping waits for the text.
  if (titleCard.value !== null && (action === 'advance' || action === 'skip')) {
    if (action === 'advance') {
      dismissTitleCard()
    }
    return
  }
  if (action !== 'skip' && isSkipping.value) {
    isSkipping.value = false
    clearTimeout(skipTimer)
    return
  }
  switch (action) {
    case 'advance':
      advance()
      break
    case 'back':
      goBack()
      break
    case 'log':
      openLog()
      break
    case 'skip':
      toggleSkipping()
      break
    case 'hideText':
      isTextHidden.value = true
      break
    case 'settings':
      openPanel.value = 'settings'
      break
    case 'fullscreen':
      toggleFullscreen()
      break
    case 'leave':
      emit('leave')
      break
  }
}

function onKeydown(event: KeyboardEvent) {
  const action = actionForKey(bindings.value, event.code)
  if (action === null) {
    return
  }
  // A panel takes the keyboard: Escape (or the log key for the log) closes it, its buttons do the rest.
  if (openPanel.value !== 'none') {
    if (action === 'leave' || (action === 'log' && openPanel.value === 'log') || (action === 'settings' && openPanel.value === 'settings')) {
      event.preventDefault()
      openPanel.value = 'none'
    }
    return
  }
  const isActivatingButton = event.target instanceof HTMLButtonElement
    && (event.code === 'Space' || event.code === 'Enter' || event.code === 'NumpadEnter')
  if (isActivatingButton) {
    return
  }
  event.preventDefault()
  perform(action)
}

function onScreenClick(event: MouseEvent) {
  if (openPanel.value !== 'none') {
    return
  }
  const isBounce = event.timeStamp - lastClickTime < MINIMUM_CLICK_INTERVAL_MILLISECONDS
  lastClickTime = event.timeStamp
  const action = actionForMouseButton(bindings.value, event.button)
  if (!isBounce && action !== null) {
    perform(action)
  }
}

/**
 * The side buttons of a mouse navigate the browser history, which would leave the game: their
 * default action is cancelled on press and release.
 */
function isSideButton(event: MouseEvent): boolean {
  return event.button === MOUSE_BUTTON.back || event.button === MOUSE_BUTTON.forward
}

function onMouseDown(event: MouseEvent) {
  if (isSideButton(event)) {
    event.preventDefault()
  }
}

function onMouseUp(event: MouseEvent) {
  if (!isSideButton(event)) {
    return
  }
  event.preventDefault()
  if (openPanel.value !== 'none') {
    return
  }
  const action = actionForMouseButton(bindings.value, event.button)
  if (action !== null) {
    perform(action)
  }
}

/** The right button opens no browser menu over the game: it does what it is bound to. */
function onContextMenu(event: MouseEvent) {
  event.preventDefault()
  if (openPanel.value !== 'none') {
    return
  }
  const action = actionForMouseButton(bindings.value, MOUSE_BUTTON.secondary)
  if (action !== null) {
    perform(action)
  }
}

function onFullscreenChange() {
  isFullscreen.value = document.fullscreenElement !== null
}

function onWheel(event: WheelEvent) {
  if (openPanel.value !== 'none') {
    return
  }
  const action = actionForWheel(bindings.value, event.deltaY)
  if (action === null || event.timeStamp - lastWheelTime < MINIMUM_WHEEL_INTERVAL_MILLISECONDS) {
    return
  }
  lastWheelTime = event.timeStamp
  perform(action)
}

const viewport = useTemplateRef<HTMLElement>('viewport')
const scale = ref(1)
const resizeObserver = new ResizeObserver(([entry]) => {
  if (entry !== undefined) {
    scale.value = Math.min(entry.contentRect.width / STAGE_WIDTH, entry.contentRect.height / STAGE_HEIGHT)
  }
})

onMounted(async () => {
  window.addEventListener('keydown', onKeydown)
  document.addEventListener('fullscreenchange', onFullscreenChange)
  window.addEventListener('mousedown', onMouseDown)
  window.addEventListener('mouseup', onMouseUp)
  if (viewport.value !== null) {
    resizeObserver.observe(viewport.value)
  }
  progress.value = await props.saveStore.readProgress(props.story.project.id) ?? progress.value
  runtime.useMemory(progress.value)
  if (props.resumeFrom === null) {
    playForward(() => runtime.start())
  } else {
    resume(props.resumeFrom)
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  playingSounds.forEach(sound => sound.pause())
  stopVoice()
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  window.removeEventListener('mousedown', onMouseDown)
  window.removeEventListener('mouseup', onMouseUp)
  resizeObserver.disconnect()
  clearTimeout(typingTimer)
  clearTimeout(noticeTimer)
  clearTimeout(titleCardTimer)
  forgetSaveFile()
  document.adoptedStyleSheets = document.adoptedStyleSheets.filter(sheet => sheet !== authorSheet)
  isLeaving = true
  loadedFonts.forEach(face => document.fonts.delete(face))
  clearTimeout(skipTimer)
})
</script>

<template>
  <div ref="viewport" class="viewport">
    <div
      class="screen"
      :style="{ width: `${STAGE_WIDTH}px`, height: `${STAGE_HEIGHT}px`, transform: `translate(-50%, -50%) scale(${scale})` }"
      @click="onScreenClick"
      @contextmenu="onContextMenu"
      @wheel.passive="onWheel"
    >
      <div ref="scene" class="scene">
        <StageView :stage="snapshot.stage" :catalog="catalog" />
      </div>
      <div
        class="cover"
        :style="{
          background: snapshot.stage.cover === 'white' ? '#fff' : '#000',
          opacity: snapshot.stage.cover === null ? 0 : 1,
          transitionDuration: `${snapshot.stage.coverFadeMs}ms`,
        }"
      />
      <div ref="flash" class="flash" />
      <MusicPlayer :url="musicUrl" :volume="playingVideo === null ? settings.musicVolume : 0" />
      <div v-if="playingVideo !== null" class="video-screen">
        <video ref="video" :src="playingVideo.url" playsinline @ended="endVideo" @error="endVideo" />
      </div>
      <FullScreenText
        v-if="fullScreenPages !== null && fullScreenPages.length > 0 && isHudShown"
        :pages="fullScreenPages"
        :visible-length="page === null ? Number.POSITIVE_INFINITY : visibleLength"
        :is-complete="isTypingComplete"
      />
      <TextBox
        v-else-if="page !== null && isHudShown"
        :speaker="speakerName"
        :text="page.text"
        :visible-length="visibleLength"
        :is-complete="isTypingComplete"
        :styles="pageStyles"
        :speaker-x="speakerX"
      />
      <ChoiceMenu v-if="choice !== null && isHudShown" :key="choice.id" :choice="choice" @choose="choose" />
      <div v-if="isHudShown" class="quick-menu" :class="{ low: fullScreenPages !== null }">
        <button class="quick-button" :disabled="!canGoBack" @click.stop="goBack">{{ text.back }}</button>
        <button class="quick-button" @click.stop="openLog">{{ text.log }}</button>
        <button class="quick-button" @click.stop="openSlots('save')">{{ text.save }}</button>
        <button class="quick-button" @click.stop="openSlots('load')">{{ text.load }}</button>
        <button class="quick-button" :class="{ active: isSkipping }" :aria-pressed="isSkipping" @click.stop="toggleSkipping">{{ text.skip }}</button>
        <button v-if="isMapOffered" class="quick-button" @click.stop="emit('map')">{{ text.map }}</button>
        <button class="quick-button" @click.stop="openPanel = 'settings'">{{ text.settings }}</button>
      </div>
      <BacklogPanel v-if="openPanel === 'log'" :lines="backlogLines" @close="openPanel = 'none'" @go-back="goBackTo" />
      <SettingsPanel
        v-if="openPanel === 'settings'"
        v-model="settings"
        v-model:language-choice="languageChoice"
        :is-fullscreen="isFullscreen"
        @close="openPanel = 'none'"
        @toggle-fullscreen="toggleFullscreen"
      />
      <SaveLoadPanel
        v-if="openPanel === 'save' || openPanel === 'load'"
        :mode="openPanel"
        :slots="slotSummaries"
        :file="saveFile"
        @close="openPanel = 'none'"
        @pick="pickSlot"
      />
      <Transition name="notice">
        <div v-if="notice !== null" class="notice" role="status">{{ notice }}</div>
      </Transition>
      <Transition name="title-card">
        <div v-if="titleCard !== null" :key="titleCard.chapterId" class="title-card" aria-live="polite">
          <p class="title-card-text" :class="reservedStyleClasses(RESERVED_STYLE_NAMES.chapterTitle)">{{ titleCard.title }}</p>
        </div>
      </Transition>
      <div v-if="snapshot.step.type === 'end' || errorMessage !== null" class="end-screen" @click.stop>
        <p :class="errorMessage === null ? ['ending-name', ...reservedStyleClasses(RESERVED_STYLE_NAMES.ending)] : []">{{ errorMessage ?? endingName ?? storyText.theEnd }}</p>
        <p v-if="errorMessage === null && story.project.endings.length > 0" class="endings-count">
          {{ storyText.endingsReached(endingsReached, story.project.endings.length) }}
        </p>
        <div class="end-actions">
          <button v-if="canGoBack" class="end-button" @click="goBack">{{ text.back }}</button>
          <button v-if="isMapOffered && errorMessage === null" class="end-button" @click="emit('map')">{{ text.map }}</button>
          <button class="end-button" @click="emit('leave')">← {{ leaveLabel }}</button>
        </div>
      </div>
    </div>
    <button class="leave-button" @click="emit('leave')">← {{ leaveLabel }} <kbd>{{ escapeKey }}</kbd></button>
  </div>
</template>

<style scoped>
.viewport {
  position: fixed;
  inset: 0;
  overflow: hidden;
  background: #000;
}

/* Under full-screen text, the menu goes to the bottom edge. */
.quick-menu.low {
  bottom: 48px;
}

.scene,
.cover,
.flash {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

/* Its own layer: the depth of characters orders them among themselves, never above the text or the menu. */
.scene {
  isolation: isolate;
}

.cover {
  transition-property: opacity, background;
  transition-timing-function: ease-in-out;
}

.flash {
  opacity: 0;
}

.screen {
  position: absolute;
  top: 50%;
  left: 50%;
  overflow: hidden;
  user-select: none;
  cursor: pointer;
}

/* Above the box and the speaker's name plate, wherever it stands. */
.quick-menu {
  position: absolute;
  right: 200px;
  bottom: 310px;
  display: flex;
  gap: 16px;
}

.quick-button {
  padding: 8px 20px;
  border: 1px solid rgb(120 220 255 / 0.35);
  border-radius: 8px;
  background: rgb(8 10 16 / 0.85);
  font: 24px/1.2 system-ui, sans-serif;
  color: #9eeaff;
  cursor: pointer;
}

.quick-button:hover:not(:disabled),
.quick-button:focus-visible {
  outline: none;
  border-color: #9eeaff;
  background: #0e2a36;
}

.quick-button.active {
  border-color: #9eeaff;
  background: #0e2a36;
}

.quick-button:disabled {
  opacity: 0.35;
  cursor: default;
}

.notice {
  position: absolute;
  top: 40px;
  left: 50%;
  transform: translateX(-50%);
  padding: 16px 32px;
  border: 1px solid rgb(120 220 255 / 0.5);
  border-radius: 10px;
  background: rgb(8 10 16 / 0.9);
  font: 28px/1.3 system-ui, sans-serif;
  color: #e6e9ef;
  pointer-events: none;
}

.notice-enter-active,
.notice-leave-active {
  transition: opacity 0.3s ease;
}

.notice-enter-from,
.notice-leave-to {
  opacity: 0;
}

.end-screen {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 40px;
  background: rgb(0 0 0 / 0.7);
  font: 56px/1.3 Georgia, serif;
  color: #f2f4f8;
  cursor: default;
}

.end-screen p {
  margin: 0;
}

/* A chapter's title over the stage, before its text; the style `chapter title` and the game's CSS give it its looks. */
/* The default looks sit on the card and are inherited: a style's class on the title itself wins over them. */
.video-screen {
  position: absolute;
  inset: 0;
  background: #000;
}

.video-screen video {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.title-card {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgb(0 0 0 / 0.55);
  font: 72px/1.25 Georgia, serif;
  letter-spacing: 0.04em;
  color: #f2f4f8;
  text-shadow: 0 4px 24px rgb(0 0 0 / 0.6);
  pointer-events: none;
}

.title-card-text {
  max-width: 80%;
  margin: 0;
  text-align: center;
}

.title-card-enter-active,
.title-card-leave-active {
  transition: opacity 0.6s ease;
}

.title-card-enter-from,
.title-card-leave-to {
  opacity: 0;
}

.endings-count {
  font: 28px/1.3 system-ui, sans-serif;
  color: #a3acbb;
}

.end-actions {
  display: flex;
  gap: 24px;
}

.end-button,
.leave-button {
  border: 1px solid rgb(120 220 255 / 0.5);
  border-radius: 8px;
  background: #0e2a36;
  color: #9eeaff;
  cursor: pointer;
}

.end-button {
  padding: 16px 40px;
  font: 32px/1.2 system-ui, sans-serif;
}

.leave-button {
  position: absolute;
  top: 12px;
  left: 12px;
  padding: 6px 12px;
  font: 14px/1.2 system-ui, sans-serif;
  opacity: 0.6;
}

.leave-button:hover,
.leave-button:focus-visible {
  opacity: 1;
}

kbd {
  margin-left: 6px;
  font: inherit;
  opacity: 0.7;
}
</style>
