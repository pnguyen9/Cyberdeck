# Changelog

## 1.3.0 — 2026-10-28

The player's name, timed choices, accessibility, captions, and a start for translations. Projects of 1.2.0
open as they were; games using names, timed choices or captions need Datajack 1.3, which an older one says
rather than failing.

### Cyberdeck, the editor
- The player's name: `[ask: Hero = Alex]` asks for it, at most 12 characters, and `{Hero}` shows it
  in the text, in options and as a speaker, `— {Hero}: Hi.`; Alex until it is given. Pages are cut
  as if every name were as long as the longest allowed, so that they always fit.
- Timed choices: `[choice: Answer 10s]`, and an option ending with `[timeout]`, never shown, taken
  when time runs out.
- Video captions: a WebVTT file named like its video (`Opening.vtt`), dropped in Cast & files.
- Copy without the story, on the projects screen: a new project with another's files, characters
  and settings and none of its chapters, in a language of its own, to import a translation into.
- Restore as a copy, added in 1.2.0, is gone: a copy of a story is the same text imported under
  another name.

### Datajack, the player
- Asks for names and shows them; times choices with a bar running out.
- Settings has three categories: General, Accessibility and Controls. Accessibility sets the text
  size (the text box growing to hold it), a plainer font, a stronger contrast behind the text,
  pages and options read aloud, choices that wait for the player, even timed ones, and the
  captions of videos.
- Screen readers hear each page whole as it appears, rather than letter by letter as it is typed.

### Downloads
As before, nothing to install: unpack a download and start the application inside.
- `Cyberdeck-1.3.0-windows-x64.zip` and `Datajack-1.3.0-windows-x64.zip`: for Windows; start
  `Cyberdeck.exe` or `Datajack.exe` (*More info → Run anyway* the first time: they are not signed).
- `Cyberdeck-1.3.0-linux-x64.zip` and `Datajack-1.3.0-linux-x64.zip`: for Linux; start `cyberdeck`
  or `datajack`.
- `Cyberdeck-1.3.0-web.zip` and `Datajack-1.3.0-web.zip`: for any computer with a browser; open
  `index.html`, without a server.
- `Cyberdeck-1.3.0-documentation.zip`: the illustrated guide for authors (open
  `docs/guide/index.html`), the README, these changes and the licence.
- `SHA256SUMS`: the checksum of each download.

## 1.2.0 — 2026-10-28

Counting, voices and videos. Projects of 1.1.0 open as they were; a game keeps opening in older
Datajacks unless it uses what is new here, which needs Datajack 1.2: an older one says so rather
than failing.

### Cyberdeck, the editor
- Counters: `[counter: Trust = 2]` declares one, `[add: Trust]` or `[add: Trust -1]` changes it,
  `[set: Trust = 0]` gives it a value, and `[if: Trust >= 3]` tests it (`>`, `>=`, `<`, `<=`, `is`,
  `is not`). An `[add]` alone makes a counter starting at 0. Saves keep counters by name, going back
  undoes them, and the storyboard, Definitions and Index show them; typing a tag suggests them.
- Voices: `[voice: marie-01]` plays a line, one of the project's sounds, which stops as the player
  moves on and plays again when they come back to its page.
- Videos: `[video: Opening]` plays a `.webm` or `.mp4` over the whole screen, the text waiting for it;
  moving on passes it. Video files are dropped in Cast & files like the others.
- Restore as a copy: a backup comes back as a new project beside the one it was made from, named
  `… (copy)`.
- Preview from here takes the shortest way to the card.

### Datajack, the player
- Counts a game's counters, speaks its voices and plays its videos, the menus and text hidden and
  the music silent while one plays.
- Settings has a volume for voices; the music volume sets the videos' too.

### Downloads
As before, nothing to install: unpack a download and start the application inside.
- `Cyberdeck-1.2.0-windows-x64.zip` and `Datajack-1.2.0-windows-x64.zip`: for Windows; start
  `Cyberdeck.exe` or `Datajack.exe` (*More info → Run anyway* the first time: they are not signed).
- `Cyberdeck-1.2.0-linux-x64.zip` and `Datajack-1.2.0-linux-x64.zip`: for Linux; start `cyberdeck`
  or `datajack`.
- `Cyberdeck-1.2.0-web.zip` and `Datajack-1.2.0-web.zip`: for any computer with a browser; open
  `index.html`, without a server.
- `Cyberdeck-1.2.0-documentation.zip`: the illustrated guide for authors (open
  `docs/guide/index.html`), the README, these changes and the licence.
- `SHA256SUMS`: the checksum of each download.

## 1.1.0 — 2026-10-28

Quality of life for writing, and more freedom for how a story looks. Nothing written for 1.0.0
changes: projects open as they were, and games keep opening in Datajack 1.0 unless they use the new
style words or fonts below.

### Cyberdeck, the editor
- A story needs no text to start from: Start without a text, on a new project, opens an empty
  chapter in the storyboard; New chapter and New scene, in Chapters, add more.
- Nothing written is lost unasked: opening another card, another chapter or another tab, or
  pressing Esc, while a page has unsaved changes asks to save, discard or keep editing. The card
  being edited is marked.
- Alt+G goes to the storyboard from anywhere, on the selection (or the first card), and between a
  page being edited and its card. Alt+PageUp and Alt+PageDown change tabs; each tab may have keys.
- In a narrow window, the storyboard's panel slides over the board from the right edge instead of
  falling below it.
- Definitions: a decision or style declared in a chapter stays there, as a card, and goes with the
  chapter's text; those of no chapter are edited in the new Definitions tab. Either way, every
  chapter may use them. Declaring one twice is refused, saying where the first one is, and a
  declaration cannot drop a value still used elsewhere.
- Index: every decision and memory with every place it is given, emptied or tested. It points out
  what looks forgotten: a value tested but never given, a memory never remembered, an ending no
  path reaches, a scene never played, and what is declared but never used.
- In this view: the storyboard's panel lists the decisions and memories of the cards shown.
- The project's CSS, in Definitions: each class is a style. It is checked: only how text looks is
  kept, nothing is loaded from outside, the player's own buttons are never reached, and what is left
  out is listed with why. Pages holding a larger style are cut shorter so that they always fit;
  pages cut before a style grew are pointed out.
- Fonts: a font file dropped in Cast & files becomes a font the CSS may name. It is measured as it
  is added, so that pages in it are cut to fit, and every game carries it.
- Three style words that play as the text is typed: `fade-in`, `rise` and `glow`.
- `[style: Name = plain]` declares a style drawn by the CSS alone; the story's text export writes
  them, so that it imports back into a new project.
- In English and in French: Cyberdeck follows the system's language, or the one chosen on the
  projects screen or in a project's header.
- Title cards: each chapter's title over the stage as it starts, styled by the style
  `chapter title`; the ending's name takes the style `ending`.

### Datajack, the player
- Draws a game's CSS, fonts and title cards, and the new style words.
- In English and in French: the player's screens follow the system's language, or the one chosen
  on the profiles screen, in the library or in Settings. A game's own words, such as « Fin. » on
  its end screen, follow the language it is written in.
- Clear messages, in the player's language, when an archive cannot be installed.
### Downloads
As for 1.0.0, nothing to install: unpack a download and start the application inside.
- `Cyberdeck-1.1.0-windows-x64.zip` and `Datajack-1.1.0-windows-x64.zip`: for Windows; start
  `Cyberdeck.exe` or `Datajack.exe` (*More info → Run anyway* the first time: they are not signed).
- `Cyberdeck-1.1.0-linux-x64.zip` and `Datajack-1.1.0-linux-x64.zip`: for Linux; start `cyberdeck`
  or `datajack`.
- `Cyberdeck-1.1.0-web.zip` and `Datajack-1.1.0-web.zip`: for any computer with a browser; open
  `index.html`, without a server.
- `Cyberdeck-1.1.0-documentation.zip`: the illustrated guide for authors (open
  `docs/guide/index.html`), the README, these changes and the licence.
- `SHA256SUMS`: the checksum of each download.

## 1.0.0 — 2026-10-27

The first release: Cyberdeck to make visual novels, Datajack to play them.

### Cyberdeck, the editor
- Import a story from a Word document, a text file or a paste: narration, dialogue (`— Name: text`)
  and chapters (`# Title`), cut into pages of two lines automatically. Problems are listed as you
  type, line by line.
- Stage notes in brackets: backgrounds, music, sound effects, characters entering, moving and
  changing expression, positions and depth, animations, transitions, fades, shakes, flashes, tints,
  illustrations, named text styles and full-screen text.
- Branching without jumps: decisions, choices, `[if]` blocks, options offered only under a
  condition, loops for places the player comes back to, scenes written once and played anywhere,
  chapters of a single route, named endings, and memories kept across playthroughs.
- A storyboard of the chapter as cards, used with the mouse or the keyboard alone: blocks move as
  one, pages are edited in place with tags drawn as chips and suggestions as you type, unreachable
  pages are shown. A tree view sets the branches side by side.
- Cast & files: images and sounds go to the entries they are named after.
- Preview from the start or from any page, with the stage and decisions of a path that leads there.
- Export as a game archive, whole or only some chapters (each archive works on its own), and back
  to text, to edit in Word and import again.
- Backups of a project as one file; remappable shortcuts.
- In the browser, or as a desktop application keeping projects as folders.

### Datajack, the player
- A library of games per profile, updated by adding newer archives, with covers, credits, endings
  reached and a gallery of the illustrations seen.
- Autosave at every page, six slots, saves as files to carry to another computer, a log to go back
  to any line, skipping of text already read, and a map of the routes explored.
- Settings: text speed, music and sound volumes, full screen, and every key or mouse button.
- In the browser, or as a desktop application keeping saves as readable files.

### Downloads
Nothing to install: unpack a download and start the application inside.
- `Cyberdeck-1.0.0-windows-x64.zip` and `Datajack-1.0.0-windows-x64.zip`: for Windows; start
  `Cyberdeck.exe` or `Datajack.exe`. The applications are not signed, so Windows asks to confirm
  the first time: *More info → Run anyway*.
- `Cyberdeck-1.0.0-linux-x64.zip` and `Datajack-1.0.0-linux-x64.zip`: for Linux; start
  `cyberdeck` or `datajack`.
- `Cyberdeck-1.0.0-web.zip` and `Datajack-1.0.0-web.zip`: for any computer with a browser; open
  `index.html`, without a server.
- `SHA256SUMS`: the checksum of each download.
