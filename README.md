# Cyberdeck

A visual novel engine built around one idea: write the story as ordinary prose (in Word or any
text editor), import it, and get pages ready to play, without cutting dialogue by hand.

- **Cyberdeck**: the engine and editor, where stories are imported and arranged.
- **Datajack**: the player, which plays a published story in a browser or as a desktop app.

Authors start with the illustrated guide, [docs/guide/index.html](docs/guide/index.html): the
basics of the interface first, then each feature. This README is the complete reference.

## Why this exists

I wanted a simple tool for making visual novels that needs no programming knowledge at all: one
that imports a story written in Word directly, with an interface intuitive enough to be used with
the mouse alone or the keyboard alone.

I wrote the initial specification, suggested some design ideas and made the decisions when asked.
However, the entire coding was done by Claude Code, which also brought up many features and ideas
common in visual novels that I was unaware of. Along the way, I decided that nothing should be hidden
from players: a game is plain JSON in an ordinary `.zip`, and a save is a readable JSON file. Anyone
may read the whole story without playing it, edit its content, or change a save. Cheating is
allowed and made easier.

## Packages

Like a JDK and a JRE: the engine contains the player, so that what an author previews is exactly
what players see.

| Package | Contents | Used by |
|---|---|---|
| `packages/core` (`@cyberdeck/core`) | The model and the interpreter: story format and its checks, text import and pagination, game archives, story runtime, stage state, save data. No interface. | both |
| `packages/stage` (`@cyberdeck/stage`) | What shows a story: the player view (stage, textbox and full-screen text, choices, music and sounds, log, map, save and load panels, settings), input bindings and player settings, the save store interface. Vue components. | both |
| `packages/cyberdeck` (`@cyberdeck/cyberdeck`) | The engine: projects, import of text into them, cast and files, details, preview with the shared stage, export as a game, backups. | authors |
| `packages/datajack` (`@cyberdeck/datajack`) | The player: profiles, library of installed games, gallery of illustrations seen, desktop shell (Electron). | players |
| `packages/desktop` (`@cyberdeck/desktop`) | What both desktop builds share: the hardened Electron window, checked channels, safe file writing, the bundling settings and the packaging script. | both |

Datajack's build only takes from `core` what it uses: the importer, pagination and archive writing
stay out of it.

## Development

Node 22 (`nvm use`), then:

```sh
npm install
npm test          # Vitest, every package
npm run typecheck # TypeScript, every package
npm run dev -w @cyberdeck/cyberdeck  # the engine, at http://localhost:5174
npm run dev -w @cyberdeck/datajack   # the player, at http://localhost:5173
```

Both desktop builds are Electron. Install scripts are disabled (`.npmrc`), so its binary is
downloaded explicitly once, from GitHub, checked against the checksums of the npm package:

```sh
node node_modules/electron/install.js
npm run desktop -w @cyberdeck/cyberdeck   # builds the page and the shell, then opens the window
npm run desktop -w @cyberdeck/datajack
```

Each application's Electron processes are bundled by Vite (`vite.electron.config.ts`) into
`dist-electron/main.js` and `preload.cjs`, the shared desktop code included.

VS Code's terminal sets `ELECTRON_RUN_AS_NODE=1`, which turns Electron into plain Node: prefix the
command with `ELECTRON_RUN_AS_NODE=` there.

TypeScript is held at 6: version 7 no longer offers the programming interface `vue-tsc` needs to
check `.vue` files.

**Browser checks** drive the real editor in headless Chrome, through the DevTools Protocol, with
no dependency: `npm run checks` (or `npm run checks -- storyboard-grid` for one) starts the
development server, runs each `checks/<name>.check.mjs` in a fresh profile and writes screenshots
and results to `checks/output/<name>/`. Chrome is `google-chrome` unless `CHROME` names another.
A check exporting `app = 'datajack'` opens Datajack's server instead; those of the desktop builds
(`cyberdeck-desktop`, `datajack-desktop`) build and start Electron with a home folder of their own,
and run only by name or with `npm run checks:desktop`.
`checks/fixtures/story.docx` and `plain.docx` are `story.html` and `plain.html` saved by LibreOffice,
documents as a word processor writes them; `node checks/make-test-assets.mjs <folder>` writes backgrounds, sprites and a tone to
try the Cast & files screen with.
The guide's screenshots come from `checks/guide-images.check.mjs`: after a change to the
interface, `npm run guide:images` takes them again and copies them into `docs/guide/images/`.

Import behaviour is specified by examples: each `packages/core/tests/import/<name>.txt` is imported
and compared with `<name>.expected.json`, written by hand **before** the code. To add a behaviour,
add a pair of files first, watch it fail, then make it pass.

## Word documents

A `.docx` opened in the Import tab is shown as the text it gives, to be checked before importing:
one line per paragraph, read without any dependency (a `.docx` is a ZIP of XML).

- **Heading 1** paragraphs (or **Title**) become chapters, `# …`, whatever the language of Word:
  the style is recognised by its built-in name, not its translated one.
- A dash typed at the start of a paragraph makes Word start a bulleted list and drop the dash: list
  items get a bullet back (`• `), so that `— Marie: …` stays dialogue.
- Text Word cut into pieces (formatting, spelling, revisions) is joined, tags included; deleted
  revisions, field codes, text boxes, comments and notes are left out; tabs and line breaks kept.
- Italics are kept, as `[style: italic]` … `[style: none]`, in prose only: never inside a tag, nor
  in headings, options, or lines of tags alone.

Checked with documents written by LibreOffice as well as built by hand in the tests.

## Building to show it, without a server

### Both applications as files, for any computer with a browser

```sh
npm run build:file -w @cyberdeck/cyberdeck   # → packages/cyberdeck/dist-file/
npm run build:file -w @cyberdeck/datajack    # → packages/datajack/dist-file/
```

Copy a `dist-file/` folder anywhere (a USB key, a zip sent by mail) and double-click its
`index.html`: the application opens from the file, offline, with no server and no installation.
Browsers refuse module scripts from files, so this build makes one classic script with relative
paths. It is checked in Chrome, the whole way: a game written and exported in Cyberdeck, installed
and played in Datajack, map included.

What each application keeps (projects, profiles, installed games, saves) is stored by the browser,
for that computer and that browser: back up projects (Cyberdeck's *Back up*) before showing them
on another computer, and bring the game archive along to install it there.

The usual `npm run build` (in `dist/`) is for putting the applications on a web host, GitHub
Pages for instance; opened as files, it shows a blank page.

### As desktop applications

```sh
node node_modules/electron/install.js             # once: downloads Electron's runtime
npm run package:desktop -w @cyberdeck/cyberdeck   # → packages/cyberdeck/release/Cyberdeck-<version>-<system>-<architecture>/
npm run package:desktop -w @cyberdeck/datajack    # → packages/datajack/release/Datajack-<version>-<system>-<architecture>/
npm run package:desktop:windows -w @cyberdeck/cyberdeck   # the same for Windows, from any system
npm run package:desktop:windows -w @cyberdeck/datajack
```

Each folder holds Electron's runtime with the application inside: start `cyberdeck` / `datajack`
on Linux, `Cyberdeck.exe` / `Datajack.exe` on Windows, `Cyberdeck.app` / `Datajack.app` on macOS.
Nothing is installed; deleting the folder removes the application (Cyberdeck's projects stay in
their folder, Datajack's profiles in the system's application data). A folder is made for the
system it is built on, unless one is named: the applications are the same JavaScript everywhere,
so a Windows folder only takes Electron's Windows runtime, downloaded once into
`node_modules/.cache/electron` and checked against the SHA-256 the electron package lists
(`unzip` must be installed on Linux or macOS). The applications are not signed: Windows asks
to confirm (*More info → Run anyway*), macOS too (right-click → *Open*). From VS Code's terminal,
start them as `ELECTRON_RUN_AS_NODE= ./cyberdeck` (see Development).

### A release

```sh
npm run release   # → release/v<version>/
```

builds every download in one go: both applications for Windows and, on Linux, for Linux, both as
files for a browser, and `Cyberdeck-<version>-documentation.zip`, with the guide and its images, this
README, the changes and the licence; then `SHA256SUMS`, the checksum of each. It needs the `zip`
command, which keeps the executable bit the Linux builds need.

## Languages

Cyberdeck and Datajack speak English and French: each follows the system's language unless another
is chosen (Cyberdeck: the projects screen and a project's header; Datajack: the profiles screen,
the library and the game's Settings), and keeps the choice in the browser. A game's own words, such
as « Fin. » on its end screen, follow the language the story is written in, its project's language.
The story syntax itself is the same in every language. Each package keeps its messages in tables,
one per language, of the same shape: another language is one more table each.

## Writing syntax (so far)

| You write | It becomes |
|---|---|
| A paragraph | Narration. Each line is its own paragraph, blank lines are ignored. |
| `— Marie: Hello.` or `- Marie : Bonjour.` | Dialogue spoken by Marie: a dash, then one to three capitalised words, then a colon. |
| `— ???: Who's there?` | Dialogue of a voice nobody knows yet, `???` being its name. |
| `Marie: Hello.` | Narration, with a warning: dialogue always starts with a dash and a name. |
| `— Hello.` | Narration, dash kept, with a warning: dialogue always names who speaks. |
| `# Chapter 1 — The Classroom` | Starts a chapter. |
| `[only if: Route is Marie]` right under a chapter heading | The chapter is played only when this holds, and passed by otherwise: the chapters of a route. |
| `# Scene: Caught`, then `[play: Caught]` anywhere | A scene: pages of no chapter, played where `[play]` names it, after which the story goes on, unless the scene ended it. Scenes may play scenes, never themselves. A scene imported with the name of one of the project replaces it. |
| `[import: story]` on the first line | Declares what the text is: `story`, `chapter` or `pages`. |
| `[bg: rooftop]` alone on a line, or before the text | Applies when the next page appears. |
| `Wait, you mean [marie: surprised] the letter?` | Applies when the text reaches that point. |
| `[bg: rooftop]` (or `background`), `[transition: fade]` | Changes the background; a transition applies to the next background change: `fade` (cross-fade), `black` or `white` (through that colour), with a duration if wished (`[transition: black 1.5s]`, 0.8 s by default). Without one, the background changes at once. |
| `[shake]`, `[shake: strong 0.4s]` | The stage trembles, lightly by default, for half a second. Played once, like a sound, also inside a sentence. |
| `[flash]`, `[flash: red 0.2s]` | A colour flashes over the stage: `white` (default), `red`, `black`. |
| `[fade out: 1s]`, `[fade out: white]` … `[fade in: 2s]` | The screen fades to black (or white) and stays so, text showing over it, until a fade in; the text waits for each fade (1 s by default). Saves keep it. |
| `[style: Whisper = italic, small, grey]` | Declares a style, alone on its line: `italic`, `bold`, `small`, `large`, `grey`, `red`, `blue`, `green`, `gold`, `shaking`, and, appearing as they are typed, `fade-in`, `rise` and `glow` (which needs Datajack 1.1). The project's CSS adds whatever else a style looks like (see Styles and CSS). |
| `[style: Whisper]Don't tell anyone.[style: none]` | The words after it in that style, until `[style: none]`, another style, or the end of the paragraph. A property alone is a style without declaring it, `[style: italic]`, and so is a class of the project's CSS, `[style: ghost]`; `[style: Ghost = plain]` declares one with no property of its own, drawn by the CSS alone. |
| `[text: full]` … `[clear]` … `[text: box]` | Text over the whole screen, as in a book: pages pile up one under the other until `[clear]`, or a new screen after five; `[text: box]` brings the box back. Suits long narration. Going back and loading a save show each screen as it was. |
| `[tint: sepia]`, `night`, `grey`, `[tint: none]` | Colours the whole stage, for a memory or a night scene, until changed. Saves keep it. |
| `[music: calm]`, `[music: stop]` | Plays a track in a loop, or stops it. |
| `[illustration: Sunrise]` (or `[cg: …]`), `[illustration: none]` | A full-screen picture of a key moment over the stage, until taken away. Each profile keeps those it has seen, in any playthrough: Datajack's library shows them in the game's **Gallery**, the others locked. |
| `[sound: door]` | Plays a sound effect once, over the music; inside a sentence, when the text reaches it. Going back, loading a save and skipping play none. |
| `[voice: marie-01]— Marie: Hello.` | Plays a line spoken, one of the project's sounds, at the player's voice volume. It stops as the player moves on; going back to its page or loading a save there plays it again. Needs Datajack 1.2. |
| `[video: Opening]` | Plays a video (`.webm` or `.mp4`) over the whole screen, the music silent; the text waits until it ends, or until the player moves on, which passes it. A voice of the same page waits for it. Its captions, a WebVTT file named like it (`Opening.vtt`), show for players who ask for them (Datajack 1.3). Needs Datajack 1.2. |
| `[enter: marie]`, `[exit: marie]`, `[move: marie right]` | A character enters (`normal` expression unless told), leaves, moves. |
| `[enter: marie left smile]`, `[enter: marie 35%]` | Positions: presets (`far-left`, `left`, `center`, `right`, `far-right`, or the project's own) or a percentage of the stage width. |
| `[enter: marie slide-from-right 1.2s wait]`, `[exit: marie slide-to-left]`, `[move: marie right instant]` | Animations: `fade`, `instant`, `slide-from-left/right` (enter), `slide-to-left/right` (exit); a duration in `s` or `ms`; `wait` holds the text until the animation ends. |
| `[enter: marie facing-left]` | Forces the way a character looks. |
| `[enter: marie near]`, `[move: marie far]` | Depth: `near` is larger and in front, `far` smaller, behind and a little dimmer, `middle` by default. A move may change the depth alone, the position, or both. Saves keep it. |
| `[marie: surprised]` | Marie changes expression. Any name that is not a keyword is a character. |
| `[wait: 0.5]` | Pauses the text, in seconds. |
| `[decision: Confession = Accept \| Refuse]` | Declares a decision and its possible values. Optional: a choice declares its own. |
| `[decision multi: Clues = Letter \| Key]` | A decision where several values can hold at once. |
| `[choice: Confession]` then `> Yes = Accept` lines | Offers a choice; the option picked becomes the decision's value. Without `= Value`, an option's value is its letter: `A`, `B`, `C`… |
| `> The library = Library [if: Visited is not Library]` | An option offered only while its condition holds. A choice none of whose options holds is skipped; one with no option always offered is reported. |
| `[choice: Answer 10s]` with `> … = Silent [timeout]` | A timed choice: a bar shows the time running out, then the option marked `[timeout]`, never shown, is taken. A timed choice has exactly one. Players may ask choices to wait for them (Settings, Accessibility). Needs Datajack 1.3. |
| `[ask: Hero = Alex]`, then `{Hero}` | Asks the player for a name, at most 12 characters, which `{Hero}` then shows in the text, in options and as a speaker, `— {Hero}: Hi.`; `Alex` until they give one, and if they give none. Pages are cut as if each name were as long as the longest allowed, so that they always fit. Saves keep it. Needs Datajack 1.3. |
| `[if: Confession is Accept]` … `[else if: …]` … `[else]` … `[end]` | Plays the first branch whose condition holds. Conditions use `is`, `is not`, `and`, `or`. |
| `[loop]` … `[break]` … `[end]` | Plays what is inside again and again; `[break]`, usually in a branch, leaves the innermost loop and goes on after its `[end]`. A loop with nothing inside to leave it (no `[break]` or `[ending]`) is reported. |
| `[set: Clues = Letter]` | Sets a decision without a choice. |
| `[counter: Trust = 2]`, `[counter: Trust]` | Declares a counter, a whole number the story counts with, and what it starts at (0 when not given). Optional: an `[add]` makes the counter it names. |
| `[add: Trust]`, `[add: Trust 2]`, `[add: Trust -1]` | Adds to a counter: 1, or the amount after its name. `[set: Trust = 0]` gives it a value. |
| `[if: Trust >= 3]`, `Trust < 2`, `Trust is 3`, `Trust is not 0` | Compares a counter with a number: `>`, `>=`, `<`, `<=`, `is`, `is not`; combines with the rest by `and` / `or`. |
| `[unset: Clues = Key]`, `[unset: Clues]` | Takes a value away from a decision, or every value: tests of it no longer hold, as if it had never been set. |
| `[ending: The Empty Room]` | Ends the path here: the player has reached this ending (named endings are counted). |
| `[remember: The ghost's name]` | The profile remembers it for good, in every later playthrough; going back or loading an older save does not forget. |
| `[if: remembered The ghost's name]`, `[if: not seen ending Departure]` | Tests what the profile remembers, or the endings it has reached in any playthrough; combines with decisions by `and` / `or`. A memory or ending may be tested before the place naming it; one named nowhere is reported as a typo. |

Story directives (`decision`, `counter`, `choice`, `if`, `else`, `end`, `loop`, `break`, `play`,
`only if`, `set`, `add`, `unset`, `ask`, `ending`, `remember`) must be alone on their line. Names are compared ignoring case.

**Decisions.** A decision is what the story remembers of a playthrough: a name and the values it
may take, `Confession` being `Accept` or `Refuse`. Until a choice or a `[set]` gives it one, a
decision holds no value: `[if: Confession is Accept]` does not hold and
`[if: Confession is not Accept]` does. An ordinary decision holds one value at most, each new one
replacing the last, which suits an answer or a route. A `[decision multi: …]` gathers values, which
suits what the player found, met or visited: `Clues is Letter` holds once the letter is found,
whatever else is. `[unset]` takes a value away when the story needs it gone, a key lost or a
promise broken. Decisions belong to the playthrough: a new game starts without any, a save keeps
them, and going back undoes them. What must outlast the playthrough is a `[remember]`.

**Counters.** What a story counts goes in a counter rather than a decision: affection, trust,
money, the rounds of a fight. `[add: Affection]` after a kind word, `[add: Affection -1]` after a
cold one, then `[if: Affection >= 3]` where it matters. A counter starts at 0, or at what
`[counter: Affection = 2]` declares, and like decisions it belongs to the playthrough: a save keeps
it by name, going back undoes what was added. A loop may count its rounds and leave after the
third:

```text
[loop]
[add: Rounds]
The blades meet again.
[if: Rounds >= 3]
[break]
[end]
[end]
```

A name is a decision or a counter, never both. Counters are declared and kept like decisions
(Definitions, Index), and a game using them needs Datajack 1.2 or later.

**Definitions.** Decisions, counters and styles belong to the whole story, wherever they are declared: any
chapter may use them. A declaration written among a chapter's pages stays there, a card of the
storyboard and a line of the chapter's text export; one written above the first heading of a text
that has headings, as the whole story's export writes them, belongs to no chapter and lives in the
project's **Definitions** tab. A decision a choice makes without any declaration is made by use:
later choices may add values to it; so is a counter an `[add]` makes, starting at 0. A definition is declared once: another declaration of it is
refused, unless it replaces the first in place (editing its card, importing its chapter again).
A declaration may change the values of a decision, but never drop one still used elsewhere.

**Styles and CSS.** The Definitions tab also holds the project's CSS. Each class is a style:
`.ghost` draws `[style: ghost]`, and a declared style takes the class of its name too, spaces as
hyphens (`.whisper` for Whisper, `.chapter-title` for the style `chapter title`). Only how text
looks is kept: colours, fonts (the project's own, or those on the player's computer), sizes up to
1.5 times the text's, spacing, shadows, borders and padding up to a quarter of the text's size,
transforms, filters, transitions and animations with their `@keyframes`. Rules on anything but class names, positions, anything that loads or computes
(`url()`, `var()`, `attr()`, `@import`) and escapes are left out, and the tab lists what was left
out and why. The classes are renamed `author-<name>`, so that they reach the story's text and title
cards and never the player's own buttons and panels; players check a game's CSS again, and the
content security policy refuses anything from outside whatever happens. A paragraph holding a style
that draws text larger is cut into pages as if all of it were that large, so that its pages always
fit; pages cut before their style grew are listed in the tab, and editing one cuts it again.

**Title cards.** With *Show each chapter's title* on (Definitions), each chapter's title comes over
the stage as the chapter starts, before its text; moving on passes it, or it goes by itself. The
title takes the style `chapter title`, and the ending's name on the end screen the style `ending`:
declared like any style (`[style: Chapter title = gold, large, fade-in]`), or a class of the CSS.

**Branching.** A story is made of blocks, which keeps it readable however many routes it has. A
branch that reaches an `[ending]` stops there; one that does not
continues after its `[end]`. So routes that end their own way end inside their branch, and those
that share what follows simply do not end: the shared part, a common ending included, comes after
the block, in the branch holding it. Blocks go inside blocks as deep as the story needs.

```text
[if: Trust is Low]
The door stays shut.
[ending: Locked Out]
[else]
[if: Key is Found]
— Marie: You found it.
[ending: Together]
[end]
[end]
Nobody came. The night went on.
[ending: Alone]
```

Here *Locked Out* and *Together* end inside their branches; every other path reaches *Alone*.
A place the player comes back to, a hub or a retry, is a `[loop]` whose choice leads to a `[break]`;
the places already visited leave its choice when their options test a `[decision multi: …]` that each
visit `[set]`s:

```text
[decision multi: Visited = Library | Park]
[loop]
[choice: Where]
> The library = Library [if: Visited is not Library]
> The park = Park [if: Visited is not Park]
> Go home = Home
[if: Where is Library]
[set: Visited = Library]
Dust and silence.
[else if: Where is Park]
[set: Visited = Park]
Wind in the trees.
[else]
[break]
[end]
[end]
```

An ending reached from far apart, a bad end met in chapter 2 and again in chapter 5, is a **scene**:
pages of no chapter, written once under `# Scene: Name` and played wherever `[play: Name]` is.
Once the scene is over, the story goes on after the `[play]`, unless the scene ended it:

```text
# Chapter 2
[if: Answer is Lie]
[play: Caught]
[end]
The guard lets you pass.
# Scene: Caught
— Guard: Stop right there.
[ending: Caught]
```

A route that fills whole chapters, Marie's chapters 3 to 6 and Jules's 7 to 10, is a series of
chapters each under `[only if: Route is Marie]` or `[only if: Route is Jules]`: those of the other
route are passed by, and the story goes on with the next chapter played.

What no path can reach, after an ending or after a block whose branches, `[else]` included, all end, is
reported at import (*Never reached*) and shown faded in the storyboard. A block without `[else]`
can always be passed by.

After the character's name, the words of `enter`, `exit` and `move` may come in any order; an
unknown word in `enter` is the expression. Without a position, characters place themselves: the
first on the left looking right, the second on the right looking left, the third in the centre,
and nobody moves when someone leaves. Characters look towards the middle of the stage unless told
otherwise; a sprite is mirrored to do so only when the author has said which way it was drawn
looking (never for sprites drawn facing the viewer). Animations not written take the project
defaults: entrances and exits fade over 0.4 s, moves glide over 0.6 s.

Characters, expressions, backgrounds, music, sounds, illustrations and videos are created by being
named in the text, as are endings, memories and counters: nothing needs declaring but decisions and
styles. A
directive whose name looks like a misspelled keyword (`[backgound: …]`) is reported rather than
taken for a new character. Images and sounds are then given to these entries by file name:
`rooftop.jpg`, `marie-smile.png` (Marie's `smile`), `marie.png` (her `normal`), `calm.mp3`,
`door.wav`, `opening.webm` and its captions `opening.vtt`; case, spaces, hyphens and underscores do not matter. An entry without a file shows as
a placeholder.

A paragraph longer than the textbox is cut into several pages: between sentences first, then
after `,` `;` `:` or a spaced dash, then between words as a last resort.

## Editing (Cyberdeck)

A **project** holds the whole game. Its screens:

- **Chapters**: in playing order, with their page count and where they were imported from;
  move, rename, remove, or preview from one. Scenes follow, with the chapters and scenes playing
  each, which removing one warns about; a scene exported as text and imported again replaces itself.
  **New chapter** and **New scene** begin one with no page yet (`Chapter 2`, `Scene 1`, renamed at
  will), opened in the storyboard to be written page by page: a story needs no text to start from.
  **Start without a text**, in the Import tab of a new project, does the same for its first chapter.
- **Storyboard**: the chapter, or scene, as a grid of cards, read left to right and top to bottom, like a
  slide sorter. Pages and choices are numbered; pages inside branches carry the branch letters and
  colour (12a, 12b, 12ab when nested), the main line resuming after the longest branch. Endings,
  memories, breaks, plays of a scene (▷), assignments, definitions (◇) and
  staging are chips between cards, each opening for editing like a page. Each condition, and each loop (↻, its
  pages numbered on the main line), is **one block**, which
  selects, drags and moves as a whole: small, it shows its branches inside its frame; holding more
  pages than the limit set above the grid (5 by default, kept in the browser), it is a single
  stacked card giving its routes and pages, so that it never passes for a page. A block says when
  routes end inside it (★ every route ends, ★ 1 route ends, ★ by each branch). Pages that no path
  reaches are faded, explained in the panel, counted on the blocks holding them (⚠ 1 never
  reached, even on a block shown as one card) and above the grid. **Enter** or a
  double-click opens a block: its branches become lanes, the path above the grid leads back
  (**Esc** goes up a level), and an empty branch shows a place to write its first page.
  Everything works without a mouse. The arrows move the focus (up and down by row, as laid out)
  without selecting; **Space** selects the focused element, and adds to the selection only next to
  it, in the same list: further away, it starts again from there, so that a selection always moves
  as one piece. Shift+arrows select a run, Ctrl+A the whole list, Esc lets go.
  **Ctrl+Shift+←/→** moves the selection one place, out of the block past the start or end of a
  branch; **Ctrl+Shift+↑/↓** moves it to the row above or below, into the next branch inside a
  block. **Ctrl+X** then **Ctrl+V** moves it anywhere in the chapter, after the focused element, at
  any level. With the mouse: click selects, Ctrl+click and Shift+click add, dragging moves (onto
  the path above, out of the block). Delete removes the selection; Ctrl+Z undoes. The panel beside
  the board shows the focused card in full, with its staging, or what a block holds, and **In
  this view** lists the decisions and memories the cards shown use: declared, given, emptied,
  tested, remembered; a name there opens it in the Index. In a window narrower than 1000 pixels,
  the panel slides over the board from the right edge, opened by a click on a card, an edit or
  **Alt+P**, and put away by its handle. **Alt+G** comes to the board from anywhere in the project,
  on the selection, or on the first card selected when there is none; from a page being edited,
  it goes to its card, and back. The
  **Tree** view shows each condition's branches side by side, to read the progression; its cards
  are edited, not moved.
  **Enter** on a card edits it, page or assignment, staging, ending, memory, break, as the text
  that imports into it, tags drawn as chips coloured by kind (red when the import would object,
  the reason shown under the text). Typing `[` suggests directives, then what each one takes as the
  tag goes: characters, expressions, positions, backgrounds, music, sounds, illustrations, scenes,
  styles, decisions and their values, endings and memories; **Insert tag** offers them by group,
  blocks (`[if]`, `[loop]`) written whole with the caret inside; Backspace and Delete remove a chip whole and the arrows step over it, while a click into
  one edits it. The text field stays underneath, so undo, copy and paste work as anywhere: problems show as you type, a page grown too long is
  cut as an import would, a new speaker becomes a character, and the page keeps its identifier so
  that saves on it stay valid. **N** writes new pages after the focused card the same way.
  **P** previews from the focused page or choice: Cyberdeck finds a way a player could get there
  (from the start of its chapter, then of the story, trying options at each choice), so that the
  preview opens with the stage and decisions of that path, as a save made there would. A page only
  reached through memories or endings of earlier playthroughs is previewed taking them as known.
  Ctrl+Enter saves, Esc cancels, Ctrl+Z undoes. The card being edited is marked (✎), the panel's
  title too while changes are not saved (●). Nothing written is thrown away unasked: opening
  another card, Esc, another chapter, another tab or leaving the project first asks to **Save**,
  **Discard** or **Keep editing**, and the browser asks before the page is closed.
- **Definitions**: the project's own decisions, counters and styles, edited as their declarations; those
  declared in chapters, each with where it is, to show or to **Move to Definitions**; those made
  by use, to declare here. Then the CSS of the styles, and title cards.
- **Index**: every decision, counter and memory, each with its values and every place that declares, gives,
  empties or tests it (`Chapter 2 · page 7a`, `after 5`), a click away. Above them, what looks
  forgotten across the whole story, as an IDE would point it out: a decision or value tested but
  never given (that condition never holds), a memory tested but never remembered, an ending no
  path reaches, a scene never played; and, less pressing, what is declared or given but never used.
- **Shortcuts** (the header button, or `?`): every shortcut by screen; click one and press the new
  keys to change it, Cyberdeck asking before taking keys another action uses. Changes are kept in
  the browser; *Default* and *Reset every shortcut* bring the defaults back. **Alt+PageUp** and
  **Alt+PageDown** go to the previous and next tab; each tab may be given keys of its own there.
  Alt is left out of the defaults for single tabs: browsers keep Alt+digits for their own tabs.
- **Import**: paste text, or open a `.txt` or Word (`.docx`) document. Problems are listed as you type, against what the
  project already has: its characters, positions, decisions, endings, memories, scenes, styles and
  the classes of its CSS are known names, and where each decision and style is declared.
  **Import as** says where the text goes:
  - *New chapters*: each `# Title` becomes a chapter, after those of the project.
  - *Pages at the end of a chapter*, the chapter chosen in **Chapter**: the text continues it, its
    `# Title` lines ignored.
  - *In place of a chapter*: the text replaces the one chosen, which keeps its place and identifier,
    so that saves inside it resume at its start; the way back from an edit in Word.

  The text's first line chooses by default: `[import: chapter]` with the `# Title` of a chapter of
  the project replaces it, `[import: pages]` goes at the end of the last chapter, anything else
  makes new chapters. Scenes (`# Scene: Name`) go in whatever the choice, one named like a scene of
  the project replacing it.
- **Cast & files**: drop images, music, sounds and videos (illustrations and voices included); each file goes to the entry it is named after,
  replacing the file it had (the old one is deleted). Characters say which way their sprites were
  drawn looking. A font file (`.woff2`, `.woff`, `.ttf`, `.otf`) becomes a font of its name, which
  the CSS names: `font-family: "Cinzel"` for `Cinzel.woff2`. It is measured as it is added, how
  much wider or narrower than the text box's font it draws text, and pages in it are cut by that.
  Every game archive carries all the project's fonts; the player loads them from the archive, as
  bytes, never from elsewhere.
- **Details**: description, credits and cover, shown in players' libraries.
- **Export**: the release label and the chapters to include; and the whole story **as text**.

**Text export** writes the story back in the syntax it was written in, with everything changed in
Cyberdeck: each page its own paragraph (so that the import cuts pages where they were), directives
written before a page on their own lines, those fired during its text where the typewriter reaches
them, conditions as `and` / `or` without parentheses. Importing it gives the same story: the tests
export, import, export again and compare. The whole story declares its decisions first and can
become a new project; a chapter (*Export as text* in Chapters) leaves them out and, edited in Word
or any editor, comes back with **Import → In place of a chapter**, chosen by default when an
`[import: chapter]` text bears the title of a chapter. The chapter keeps its place and identifier
(saves inside it resume at its start). Files are UTF-8 with the mark Word and Notepad recognise.

Brackets are for directives and notes outside the story; the text of a page has none. Since
dialogue always starts with a dash and a name, no line of prose is taken for it.

In the desktop build, projects are folders on the disk, in `Documents/Cyberdeck` unless the
author chooses another folder on the projects screen (a synced one, for instance):
`<project id>/project.json`, `chapters/<id>.json` and `assets/<asset id>`, each written beside the
old version and swapped in one move. Deleting a project moves its folder to the system's trash.
In the browser, projects live in IndexedDB (the browser is asked to keep them). In both,
**Back up** downloads the project folder zipped, and **Restore a backup** reads it back, on this
computer or another.

**Copy without the story**, on the projects screen, starts a translation: a new project with all a
text cannot hold (the files, characters and the way they were drawn looking, backgrounds, music,
sounds, illustrations, videos, fonts, positions, animation defaults, the CSS, title cards and the
game's details) and none of the story, in a language of its own. Importing the translated text then
declares its decisions, counters and styles again, and cuts its pages by the rules of its language.
Tags stay as they were written, so that the text finds the characters and files it names.

## Game archives

A game travels as a `.zip` archive. The whole game and a few chapters of it are the same format,
so an author may offer either for download; installing an archive of a game already installed
merges it.

```
game.json                      the project: decisions, counters, names asked for, characters,
                               backgrounds, music, sounds, illustrations, videos and their
                               captions, positions, styles and their CSS, title cards, the order
                               of scenes, dates, description, credits; the release; every chapter
                               of the game with whether this archive includes it; each asset file
                               and its SHA-256
chapters/<id>/chapter.json     each included chapter
scenes/<id>/scene.json         every scene, in every archive: any chapter may play it
assets/cover.png               the cover, in every archive of the game
assets/backgrounds/rooftop.webp
assets/characters/Marie/smile.png
assets/music/calm.ogg
assets/sounds/door.ogg
assets/illustrations/Sunrise.png
assets/videos/Opening.webm
assets/videos/Opening.vtt
```

Assets are named after their entries; content used by several entries is stored once. Datajack
treats archives as untrusted: sizes are limited before anything is inflated, decompression stops
when an entry grows past the size it declares, checksums and SHA-256 are verified, paths that could
leave their folder are refused, and every field of every document is type-checked (unknown fields
are dropped, nesting is bounded). What only the editor needs, such as the file a chapter was
imported from, or where definitions are written, is not exported.

Each document says the format it is written in. An archive takes the oldest format that holds the
game, so that players who have not updated Datajack still play it: format 1.1, which Datajack 1.0
reads; 1.2, which Datajack 1.1 reads, when a style uses `fade-in`, `rise` or `glow` or the project
has fonts; 1.3, for Datajack 1.2, when the game uses counters, voices or videos; 1.4, for Datajack
1.3, when it asks for names, times its choices or has captions. An older Datajack
says a newer game needs an update rather than failing on it, and Datajack 1.0 shows a game's text
without the CSS and title cards it does not know of. Projects are written in the current format, 1.4.

When an archive is installed, the newer export (by date) brings the project, the release, the
chapter list and the scenes; an older archive only adds chapters still missing. Asset files go first and
`game.json` last, so an interrupted install leaves the previous state intact.

Cyberdeck exports in three ways: the story as text (to edit and import again), the whole game,
and selected chapters; the last two are this archive, made from a project's *Export* tab.

## Playing (Datajack)

### Library

After the profile, Datajack opens the library: the installed games with their cover, description,
release and chapters (those not installed are named), *Continue* from the profile's autosave, *New
game*, credits, the *Map* and the *Gallery* of illustrations seen, and removal (saves are kept).
*Add a game…* or dropping an archive installs it. On
the desktop, games live in the application's data folder (`library/games/<game>/…`, assets in
`library/assets/<sha-256>.<extension>`, shared by every game); in the browser, in IndexedDB.

### Controls

| Action | Default inputs |
|---|---|
| Show the whole page, then move on | Space, Enter, →, left click, mouse forward button, wheel down |
| Go back one step (a choice can be picked again) | ←, Backspace, Page Up, mouse back button, wheel up, the ◀ Back button |
| Log of past pages and choices (click a line to go back to it) | L, the Log button |
| Skip text already read | S, the Skip button |
| Hide the text and the menu, to look at the picture (any input shows them again) | H, right click |
| Settings | O, the Settings button |
| Full screen | F |
| Leave a panel, or the game | Esc |

### Settings

The **Settings** screen has three categories. **General** sets the text speed (or each page shown
at once), the volumes of the music (and videos), the sound effects and the voices, full screen and
the language. **Accessibility** sets the size of the text (100, 125 or 150 %, the text box growing
to hold it), a plainer font, a stronger contrast behind the text, pages and options read aloud by
the voice of the browser or the system (a page with a voice of its own is heard instead), timed
choices that wait for the player, and the captions of videos that have them. Screen readers (NVDA,
JAWS, VoiceOver, Orca) read the game as they read any page: each page is announced whole as it
appears, never letter by letter as it is typed, and choices, the name asked for and every menu are
buttons and fields they reach. With one, reading aloud is best left off, or the text is heard
twice. **Controls** sets the inputs of every action: *Add a key* then
press a key or a mouse button, which leaves the action that had it; × removes one; *Default keys*
restores them.
Keys are bound by their place on the keyboard (`KeyboardEvent.code`), so a binding means the same
key on AZERTY and QWERTY; they are named as on a US keyboard, so on another layout a name may
differ from the letter printed on the key. Datajack keeps the settings per
profile; Cyberdeck keeps the author's for its previews.

### Inputs

Inputs are a binding table (`packages/stage/src/input/bindings.ts`). Two clicks closer than 150 ms
count as one (a worn mouse), and options ignore clicks for 400 ms after appearing, so that
pressing on to get through text never picks one.

### Endings, map and skipping

An `[ending: …]` names the ending on the end screen, with how many of the story's endings this
profile has reached. Each profile keeps, per game, its progress beside its saves
(`<game>/progress.json`): the choices reached, where each option taken led, the endings, the pages
read, and what it remembers. The story reads only the memories and endings, through `remembered` and
`seen ending` conditions; decisions stay per playthrough.

**Map** (in the game, on the end screen and on the library card) shows the routes explored left to
right: each choice reached, its options (those not tried yet marked `?`), curves to where the tried
ones led, and the endings. **Play from here** resumes the choice exactly as it was reached, a new
path for the autosave to follow. Two paths reaching the same choice merge on the map only when
they agree on the stage and on the decisions the story still tests from there on; otherwise
characters could react differently ahead, and they stay apart.

**Skip** (`S`) passes pages already read, and stops at new text, a choice or an end.

### Profiles

The first start asks for a profile: a name and, on the desktop, a save folder (by default
`Documents/Datajack/<name>`, or any folder picked in the system dialog, a synced one for instance).
Datajack then opens the last profile directly; *Switch profile* goes back to the list, where profiles
are renamed, moved or removed. Changing the folder moves the saves there, keeping any save already
in the new folder for the same game and slot. Removing a profile forgets it; on the desktop its
files stay where they are. In the browser, profiles and saves live in the browser's storage.

On the desktop, each save is a file, `<save folder>/<game>/<slot>.json`, written beside the old one
and swapped in one move, so that a crash never leaves half a save. The list of profiles is in the
application's data folder.

### Saves

The game autosaves at every page and choice; Save and Load offer six slots more. The Save panel also
offers the playthrough as a file (`<game> <date> <time>.json`), and the library's **Load a save…**
(or dropping the `.json` on it) opens such a file in the current profile, on the web as on the
desktop, provided its game is installed. Saves are plain
JSON with decisions, background, music, characters (with their depth), the cover of a fade, the
tint, the text mode (and in full-screen text, the pages already on the screen) and the illustration
shown, by name, plus the list of options picked.
Loading a save whose page no longer exists (the story was updated) resumes at the start of its
chapter, or of the story, keeping the decisions. Save files are checked field by field before use.

### Security

The page runs only its own scripts and loads nothing from elsewhere (content security policy, as a
header on the desktop and a meta tag on the web). A game's CSS is checked before use and reaches
only the story's text (see Styles and CSS).

On the desktop it runs sandboxed, without Node, served from a private `datajack://` scheme;
navigation, new windows, web views and permission requests are refused. It reaches the disk only
through a short list of channels whose arguments the main process checks again: strings, bytes and
lists of strings only; identifiers that cannot leave their folder; asset files whose content matches
the SHA-256 in their name; and only save folders the player picked in the system dialog.

## Planned for 1.4

- **Auto mode**: pages move on by themselves. A page with a voice waits for its line to end; other
  pages wait a reading time counted from the length of their text, once the whole page is shown,
  so that text shown at once is given the same time. Videos are waited for, choices and the end
  stop it, and any key or click takes over again. A speed of its own in Settings.
- **A state panel in Cyberdeck's preview**: the values of the decisions, counters and names, and
  what the profile remembers, as they stand on the page shown, for checking what a condition will do.
- **A colour for each character's name**, on their name plate: either a style, as for text
  (`[style: Marie = gold]` or a class of the CSS), or a colour given to the character in Cast & files.
- **The look of the text box and the name plate**: two reserved styles, `text box` and
  `name plate` (or the classes `.text-box` and `.name-plate` of the CSS), for their colour, border,
  rounded corners, shadow and gradient, with the properties the CSS of text already allows; and a
  picture frame, an image of the project dropped in Cast & files as `text-box.png` or
  `name-plate.png`, stretched by its edges so that its corners stay whole whatever the size of the
  box (a floral frame, for instance). Stronger contrast, in the player's settings, still puts a plain
  box behind the text, and the menus stay Datajack's own.
- **Save slots with a picture**: each slot shows the stage as it was when the game was saved, the
  same shape as the game's cover, beside the chapter and the excerpt it shows today.

## License

Released into the public domain under the [Unlicense](LICENSE): anyone may use, change and
redistribute it, in source or built form, for any purpose, commercial or not, without giving
credit. The builds include third-party code (Vue, and Electron in the desktop builds), which keeps
its own licenses; the desktop builds ship Electron's license files with it.
