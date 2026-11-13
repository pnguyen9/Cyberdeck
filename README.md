# Cyberdeck

A visual novel engine built around one idea: write the story as ordinary prose (in Word or any
text editor), import it, and get pages ready to play, without cutting dialogue by hand.

- **Cyberdeck**: the engine and editor, where stories are imported and arranged.
- **Datajack**: the player, which plays a published story in a browser or as a desktop app.

Authors start with the illustrated guide: the basics of the interface first, then each feature.
Open [docs/guide/index.html](docs/guide/index.html) in a browser, or read
[docs/guide/guide.md](docs/guide/guide.md), the same guide as Markdown, where HTML is not shown as a
page (on GitHub, in an editor). This README is the complete reference.

A sample story to try it with, *Sakura Week*, is in [docs/sample/sakura-week](docs/sample/sakura-week):
import `sakura-week.txt`, then drop `sakura-week-assets.zip` in Cast & files: its `cover.png` becomes
the game's cover.

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

## Vocabulary

One word for each thing, and one thing for each word, in the code, this README, the guide, the
interface and any discussion of the project. Where the code has a type for it, the type is named;
a new notion gets its word here before it gets code.

**Applications and what they handle**

| Word | Meaning | In the code |
|---|---|---|
| Cyberdeck | The engine and editor, where authors make games. | `packages/cyberdeck` |
| Datajack | The player application, where players install and play games. | `packages/datajack` |
| Author | Who makes a game, in Cyberdeck. | |
| Player | Who plays a game: in Datajack, or the author in Cyberdeck's preview. "The player" alone means the person; the application is Datajack. | |
| Project | Everything an author works on for one game: its chapters, scenes, definitions, entries and their files, details. | `ProjectDocument` (`project.json`) |
| Game | A project exported, as Datajack installs and plays it. | `GameManifest` (`game.json`), `PlayableStory` |
| Game archive | The `.zip` a game travels in, whole or with some of its chapters. | `GameArchive` |
| Release | The label an export carries, shown in libraries. | |
| Backup | A project folder zipped, which *Restore* reads back. | `ProjectBackup` |
| Library | The games installed in Datajack, each a card. | |
| Profile | One player in Datajack: settings, saves, progress, memories and lasting values. | |

**The story as written**

| Word | Meaning | In the code |
|---|---|---|
| Story | A project's chapters in order and its scenes, in one or several languages. | |
| Chapter | Pages played in order, begun by `# Title`; played only when its `[only if]` holds, if it has one. | `ChapterDocument` |
| Route | Chapters following one another under the same `[only if]`. On the map, the paths a profile explored. | |
| Scene | Pages of no chapter, `# Scene: Name`, played where `[play]` names it, after which the story goes on. | `PlayNode` |
| Paragraph | One line of the text imported. | |
| Page | What the text box shows at once: a paragraph, or part of one too long for the box. | `StoredPage` |
| Cutting (pagination) | Splitting a paragraph into pages: between sentences, then after punctuation, then between words. | `paginate`, `PageLayout` (the box) |
| Narration | Text nobody speaks. | |
| Dialogue | Text a speaker says: a dash, a name, a colon. | |
| Speaker | The character named by a line of dialogue, shown on the name plate. | |
| Tag | Anything written in brackets, `[…]`. | |
| Directive | What a tag tells the story or the stage to do, `[enter: marie left]`; alone on its line, or inline, firing when the text reaches it. | `Directive`, `InlineDirective` |
| Keyword | A directive's first word (`bg`, `choice`, `add`). Any other first word names a character. | |
| Definition | A declaration of a decision, counter, list or style, in a chapter or in the Definitions tab. Belongs to the whole story wherever written. | `DefinitionNode` |
| Made by use | A decision or counter that no declaration made: a choice or an `[add]` did. | |
| Block | An `[if]` … `[end]` or a `[loop]` … `[end]`, moved and shown as a whole. | `ConditionNode`, `LoopNode` |
| Branch | One way through a condition block: its `[if]`, each `[else if]`, its `[else]`. | `ConditionBranch` |
| Condition | A test, `Trust >= 3 and Key is Found`, on a branch, an option or a chapter. | `Condition` |
| Choice | Where the player picks one of its options, which gives a decision its value. Timed, below or as a grid. | `ChoiceNode`, `StoredChoice` |
| Option | One line of a choice, `> Text = Value`. | `ChoiceOption` |
| Ending | Where a path stops, `[ending: Name]`; each profile counts those it reached. | `Ending`, `EndingNode` |
| Path | One way through the story, set by the options taken and the draws. | |
| Never reached | Pages no path can reach, reported at import and faded in the storyboard. | `StoryFlow` |
| Game mode | A part played forward only, its choices kept off the map; `[no going back]` is the same with its choices on it. | `StageLock` |

**What the story keeps**

| Word | Meaning | In the code |
|---|---|---|
| Name | Anything the story knows by its name: a decision, counter, list, name asked for, memory or ending. One name, one thing. | `KnownNames` |
| Decision | A name and the values it may hold, kept for a playthrough. Holds one value at most, or several when `multi`. | `Decision` |
| Value | One of the values a decision may hold, `Accept`. | `DecisionValue` |
| Counter | A number the story counts with, whole or with decimals. | `Counter` |
| Clock counters | `hour`, `weekday`, `time away`, `now`: read from the player's clock, never set by the story. | `ClockValue` |
| List | Values in numbered places, from 1, under one name. | `StoryList` |
| Place | One numbered spot of a list, `Board 3`, or `Board Cell` by a counter. | `ListPlace` (how it is named) |
| Name asked for | What the player typed for `[ask]`, shown by `{Hero}`. | `AskedName` |
| Draw | A value picked at random; saves keep draws, so going back does not draw again. | |
| Playthrough | One play from *New game* on. Decisions and counters belong to it. | |
| Lasting | A decision or counter the profile carries from one playthrough to the next. | `LastingValues` |
| Memory | What a profile remembers for good, `[remember]`, in every later playthrough. | `Memory` |
| Shown | What the author lets players see in their journal, `[shown]`. | `ShownDeclaration` |

**The stage**

| Word | Meaning | In the code |
|---|---|---|
| Stage | The picture the story plays on: background, characters, illustration, tint, fade, gauges. | `StageState` |
| Staging | The directives that change the stage, shown as chips between the storyboard's cards. | `StageCommand`, `StoredStage` |
| Background | The picture behind everything, `[bg]`. | `Background` |
| Character | Anyone named in the text who is not a keyword: a speaker, or a picture on the stage. | `Character` |
| Expression | One of a character's pictures, `smile`; `normal` unless told. | `Expression` |
| Sprite | The picture of a character's expression, as drawn: full body or upper body, facing a way. | `Framing`, `Facing` |
| Position | Where a character stands: automatic, a preset, or a percentage of the stage width. | `Placement`, `PositionPreset` |
| Depth | `near`, `middle` or `far`. | `Depth` |
| Illustration | A full-screen picture of a key moment (a CG), collected in the gallery. | `Illustration` |
| Text box | Where the text appears; `[text: full]` puts it over the whole screen instead. | |
| Name plate | The plate over the text box with the speaker's name. | |
| Title card | A chapter's title over the stage as it starts. | |
| Gauge | A counter shown as a bar on the stage. | `GaugeOnStage` |
| Style | How words look, `[style: Whisper]`: properties, or a class of the project's CSS. | `TextStyle`, `StyleDeclaration` |
| Entry | Something the text names that takes a file: an expression, a background, a track, a sound, an illustration, a video, a frame. Made by being named, gone once nothing names it. | |
| Asset | The file given to an entry, matched by its file name. | `Asset` |

**Editing, in Cyberdeck**

| Word | Meaning |
|---|---|
| Storyboard | The screen where a story is arranged, as cards. |
| Level | What the storyboard shows: the story's level (chapters and scenes), a chapter or scene, or a block opened. |
| Card | One chapter, page, choice or block in the storyboard. |
| Chip | A small element between cards (ending, memory, staging, definition…), and a tag drawn in the text being edited. |
| Lane | A branch of a block opened, laid out as a row. |
| Panel | The side of the storyboard showing the focused card in full. |
| Grid, Tree, Graph, Text | The storyboard's four views: cards in order; branches side by side; the whole story as a map; the level as the text it imports from. |
| Import | Text turned into chapters, pages at the end of a chapter, or a chapter replaced. |
| Text export | The story, or a chapter, written back in the syntax it imports from. |
| Preview | The story played in Cyberdeck from any page, with the **State** panel to change what it holds. |

**Playing, in Datajack**

| Word | Meaning | In the code |
|---|---|---|
| Stop | Where the player waits: a page, a choice, a question or an end. Going back, saving and the map go from stop to stop. | `PlayerStep` |
| Going back | Returning to an earlier stop, undoing what came after (not memories). | |
| Save | A playthrough at a stop, as readable JSON. | `SaveData` |
| Slot | One of the six places for a save, beside the autosave. | `SlotSummary` |
| Autosave | The save made at every stop, which *Continue* resumes. | |
| Progress | What a profile reached in a game across playthroughs: choices, options taken, endings, pages read, memories, lasting values. | `ProgressData` |
| Map | The routes a profile explored, each point a choice reached, from which to *Play from here*. | `ProgressMap`, `ProgressPoint` |
| Log | The pages and choices passed, a click going back to one. | `BacklogEntry` |
| Journal | What the author shows players of what they hold, and the endings reached. | `Journal` |
| Gallery | The illustrations a profile has seen. | |
| Skip, Auto | Passing text already read; moving on by itself. | |
| Settings | The profile's, or a game's own once chosen for it. | `PlayerSettings` |

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
interface, `npm run guide:images` takes them again and copies them into `docs/guide/images/`. The
guide is written in `docs/guide/index.html` only: `npm run guide:markdown` (also run by
`guide:images` and `release`) makes `docs/guide/guide.md` from it.

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

#### Erasing what the web builds store

Each application erases what it keeps, from its first page: in Cyberdeck, *Erase what Cyberdeck
keeps…*, below the projects (the saves and progress of the previews, and every project if wished);
in Datajack, *Erase what Datajack keeps…*, below the games (every game, and the profile's saves and
progress if wished). That reaches only the copy opened. For copies no longer at hand, or to erase
everything at once, the browser's own ways follow. They delete every project, profile, installed
game and save of the copies concerned: back up the projects to keep first (*Back up* in Cyberdeck),
and save to a file the games worth keeping.

**Put on a web host** (GitHub Pages, for instance), the applications are a site like any other: the
browser's own "clear site data" for that address erases them.

**Opened as files**, they are not listed among the sites of the browser's settings, and each browser
keeps them its own way:

- **Firefox** keeps each copy apart, by the path of its `index.html`: every version unzipped has its
  own data, which stays when the copy is deleted, and "Clear site data" does not reach it. With
  Firefox closed, delete the folders whose names start with `file++++` in the profile's
  `storage/default/` folder. `about:support` shows the profile folder (*Profile Folder*, *Open
  Folder*); it is usually:
  - Windows: `%APPDATA%\Mozilla\Firefox\Profiles\<profile>\storage\default\`
  - Windows, Firefox installed from the Microsoft Store (a WindowsApp):
    `%LOCALAPPDATA%\Packages\Mozilla.Firefox_n80bbvh6b1yt2\LocalCache\Roaming\Mozilla\Firefox\Profiles\<profile>\storage\default\`
  - macOS: `~/Library/Application Support/Firefox/Profiles/<profile>/storage/default/`
  - Linux: `~/.mozilla/firefox/<profile>/storage/default/`

  The folder names give each copy's path (`file++++home+me+Downloads+Cyberdeck-2.0.3-web+index.html`),
  so one can be erased and the others kept. For a copy still there, there is also a way from inside
  Firefox: open it, press F12, and in the *Storage* tab, right-click its database under
  *Indexed DB* to delete it.
- **Chrome, Edge, Brave and other Chromium browsers** keep every page opened as a file together,
  whatever its folder, Cyberdeck and Datajack alike. Open any of them (an old version will do), press
  F12, and in the *Application* tab, choose *Storage*, then *Clear site data*. Without any copy left,
  close the browser and delete the folder `file__0.indexeddb.leveldb` and the file
  `file__0.localstorage` (when there is one), in the profile's `IndexedDB` and `Local Storage`
  folders. `chrome://version` (or `edge://version`) shows the profile folder (*Profile Path*); for
  Chrome it is usually:
  - Windows: `%LOCALAPPDATA%\Google\Chrome\User Data\Default\`
  - macOS: `~/Library/Application Support/Google/Chrome/Default/`
  - Linux: `~/.config/google-chrome/Default/`

  Edge's is `Microsoft\Edge\User Data\Default` instead of `Google\Chrome\User Data\Default`
  (`~/.config/microsoft-edge/Default/` on Linux), Brave's `BraveSoftware/Brave-Browser/Default`, and
  Chromium's `~/.config/chromium/Default/` on Linux.
- **Safari** has not been tried. Its *Settings*, *Privacy*, *Manage Website Data…* lists what sites
  keep; when the copies are not listed there, *Remove All* erases the data of every site, which also
  signs out of all of them.

The desktop builds keep their projects and saves as folders on the disk (see
[Editing](#editing-cyberdeck) and [Profiles](#profiles)), deleted like any other folder.

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

Building a version again replaces its folder; those of other versions stay until deleted, by hand
or by `npm run release`, about 370 MB each.

### A release

A release is made on Linux, the only system that builds every download. Once, on that computer:

```sh
sudo apt install zip unzip   # zip keeps the Linux builds' executable bit; unzip opens Electron's runtimes
nvm install                  # the Node of .nvmrc
nvm use
npm install
node node_modules/electron/install.js
```

Then, for each release, from `main` with nothing left to commit:

1. **Check** everything passes:

   ```sh
   nvm use
   npm test
   npm run typecheck
   npm run checks          # browser checks, headless Chrome
   npm run checks:desktop  # the desktop builds' checks, Electron
   ```

2. **Set the version** of the workspace and its five packages, and the lock, in one go (here 3.4.0;
   the packages depend on each other as `*`, so nothing else names it):

   ```sh
   npm version 3.4.0 --workspaces --include-workspace-root --no-git-tag-version
   ```

   When stories gain something an older Datajack cannot play, also raise `FORMAT_VERSION` in
   `packages/core/src/format/storyFormat.ts` to the release's `major.minor` (`'3.4'`), and say in
   the CHANGELOG which stories need the new Datajack.

3. **Write the changes**: a `## 3.4.0 — <date>` section at the top of `CHANGELOG.md`, and whatever
   this README and the guide (`docs/guide/index.html`) must now say.

4. **Commit** as `3.4.0: <summary>`.

5. **Take the guide's screenshots again** if the interface changed, and commit them:

   ```sh
   npm run guide:images
   git add docs/guide
   git commit -m "Guide images for 3.4.0"
   ```

6. **Build the downloads**:

   ```sh
   npm run release   # → release/v3.4.0/
   ```

   It first deletes the application folders of earlier versions in `packages/cyberdeck/release/`
   and `packages/datajack/release/`, then builds into `release/v3.4.0/`:

   | File | Contents |
   |---|---|
   | `Cyberdeck-3.4.0-windows-x64.zip`, `Datajack-3.4.0-windows-x64.zip` | The desktop applications for Windows |
   | `Cyberdeck-3.4.0-linux-x64.zip`, `Datajack-3.4.0-linux-x64.zip` | The desktop applications for Linux |
   | `Cyberdeck-3.4.0-web.zip`, `Datajack-3.4.0-web.zip` | Both as files to open in a browser |
   | `Cyberdeck-3.4.0-documentation.zip` | The guide (HTML and Markdown) and its images, this README, the changes and the licence |
   | `Cyberdeck-3.4.0-sample-sakura-week.zip` | The sample story and the zip of its files |
   | `Cyberdeck-3.4.0-sample-mini-games.zip` | The mini games, each a text and the zip of its files |
   | `SHA256SUMS` | The checksum of each zip |

   The unzipped applications stay in `packages/*/release/` until the next release: start one there
   to try the build before publishing it.

7. **Tag and push**:

   ```sh
   git tag -a v3.4.0 -m 3.4.0
   git push origin main v3.4.0
   ```

8. **Publish** on GitHub: *Releases → Draft a new release*, the tag `v3.4.0`, the title `3.4.0`, the
   CHANGELOG's section as the description, every file of `release/v3.4.0/` attached, then
   *Publish release*.

Once published, the folders of earlier versions in `release/` can be deleted: GitHub keeps their
files.

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
| `[import: story]` on the first line, `[import: story fr]` | Declares what the text is: `story`, `chapter` or `pages`; then, if wished, the language it is written in, as a standard code (`es`, `pt-BR`), which cuts its pages and says where it goes in a story of several languages. An unknown code is reported. |
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
| `[enter: marie near]`, `[move: marie far]` | Depth: `near` is larger and in front, `far` smaller, behind and a little dimmer, `middle` by default. A move may change the depth alone, the position, or both. Saves keep it. A character drawn upper body grows around its face when near, and shrinks from the bottom of the stage when far, so that nothing floats. |
| `[marie: surprised]` | Marie changes expression. Any name that is not a keyword is a character. |
| `[card: ace flip]`, `[card: {Drawn} flip 0.6s wait]` | The picture turns over, as a card does: the old one narrows to its edge, the new one widens from it, in 0.4 s unless told; `wait` holds the text until it is done. A picture named `flip` alone is still a picture. Players who ask for less motion see it change at once. Needs Datajack 3.1. |
| `[wait: 0.5]` | Pauses the text, in seconds, and the tags written after it: `[card: back] [wait: 0.3] [card: ace]` shows the back, then the ace. |
| `[decision: Confession = Accept \| Refuse]` | Declares a decision and its possible values. Optional: a choice declares its own. |
| `[decision multi: Clues = Letter \| Key]` | A decision where several values can hold at once. |
| `[choice: Confession]` then `> Yes = Accept` lines | Offers a choice; the option picked becomes the decision's value. From five options on, they are drawn closer; a list longer than its place above the text box scrolls, its edges fading where more lie beyond, and past eight the import points it out. Without `= Value`, an option's value is its letter: `A`, `B`, `C`… |
| `> The library = Library [if: Visited is not Library]` | An option offered only while its condition holds. A choice none of whose options holds is skipped; one with no option always offered is reported. |
| `[choice: Move below]`, `[choice: Move 10s below]` | The options side by side along the bottom of the stage, where the text box stands, rather than in a column over its middle: a row of up to three, two by two for four, then three or four columns; up and down step through them in order. A decision whose own name ends in `below` keeps it. Needs Datajack 3.3. |
| `[choice: Answer 10s]` with `> Yes. = Accept [timeout]` or `> … = Silent [timeout]` | A timed choice: the option marked `[timeout]` is the one waiting takes, offered as the others, the time running out along it; any option may be it, so waiting may mean yes, and silence is an option written when there should be one. A timed choice has exactly one. Players may ask choices to wait for them (Settings, Accessibility): every outcome is then a button away. Needs Datajack 2.0. |
| `[ask: Hero = Alex]`, then `{Hero}` | Asks the player for a name, at most 12 characters, which `{Hero}` then shows in the text, in options and as a speaker, `— {Hero}: Hi.`; `Alex` until they give one, and if they give none. Pages are cut as if each name were as long as the longest allowed, so that they always fit. Saves keep it. Needs Datajack 1.3. |
| `It is {Hour} o'clock.`, `{Clues}`, `{{` | Shows a value the story keeps: a counter's number, a decision's values (separated by commas, nothing until it holds one), a name asked for. Each `{…}` must name something the story knows, or the import reports it; `{{` writes a brace. One name means one thing: a name asked for cannot also be a counter's or a decision's, in any chapter. Pages are cut as if each value were as wide as it may get (a name given, a counter's longest number, a decision's widest value, those the text itself declares included), and a page never breaks inside a `{…}`. Needs Datajack 1.4, except for names asked for. |
| `[if: Confession is Accept]` … `[else if: …]` … `[else]` … `[end]` | Plays the first branch whose condition holds. Conditions use `is`, `is not`, `and`, `or`. |
| `[loop]` … `[break]` … `[end]` | Plays what is inside again and again; `[break]`, usually in a branch, leaves the innermost loop and goes on after its `[end]`. A loop with nothing inside to leave it (no `[break]` or `[ending]`) is reported. |
| `[set: Clues = Letter]` | Sets a decision without a choice. |
| `[counter: Trust = 2]`, `[counter: Trust]` | Declares a counter, a whole number the story counts with, and what it starts at (0 when not given). Optional: an `[add]` makes the counter it names. |
| `[counter: Money = 1000.00]` | A counter with decimals: as many as its first number is written with, here hundredths (at most 4). It counts exactly, `0.1 + 0.2` being `0.30`; `{Money}` shows it as the game's language writes numbers, `1,000.50` or `1 000,50`; a number with more decimals than it keeps is reported. Saves keep it as it reads, `1000.5`. Needs Datajack 2.1. |
| `[gauge: HP / {MaxHP} bottom right numbers = {Hero}]`, `[gauge: HP none]`, `[gauge: none]` | A counter shown as a bar on the stage, out of a number or of what another counter holds, until taken away: in a corner (`top left` unless `top right`, `bottom left` or `bottom right`), sliding as the counter changes (at once for players who ask for less motion), green, gold then red as it empties unless given `green`, `blue`, `red`, `gold`, `purple` or `pink`; `numbers` writes what it holds out of what; after `=`, its name, values allowed, else the counter's. A new `[gauge]` for the same counter replaces it. Saves keep it. Needs Datajack 3.3. |
| `[ask number: Bet = 10, from 1 to {Money}]` | Asks the player for a number, for a counter (made by it when not declared, with the decimals of the number proposed). The bounds are numbers or counters in braces, read when the number is asked; either may go. The field takes digits with one comma or point for decimals, whatever the language, spaces ignored, a minus only when the lowest bound is below zero; it says what it understood, and refuses what lies out of bounds or has too many decimals, saying why. Nothing typed takes the number proposed. Needs Datajack 2.1. |
| `{hour}`, `[if: hour >= 22 or hour < 6]`, `weekday`, `time away`, `now` | Counters every story has, read from the player's clock as the story plays: `hour` (0 to 23), `weekday` (1 for Monday to 7 for Sunday), `time away` (minutes since the profile last played the game, 0 the first time), `now` (seconds since 1970, to time the player: `[set: Start = {now}]`, later `[set: Took = {now}]` and `[add: Took -{Start}]`; Datajack 3.2). Tested and shown as any counter, never changed by the story (reported if it tries), kept out of saves and of the map's points. A decision or a counter the story declares under one of these names is its own. A story using them plays differently depending on when it is played. Needs Datajack 2.1. |
| `[enter: card1 {Card}]`, `[card1: {Card}]`, `[bg: {Place}]`, `[illustration: {Scene}]` | A picture named by a decision's value: the one named like the value the decision holds as the tag plays, `queen-hearts` for `Card = queen-hearts`, with no branch. The tag makes an entry for each of the decision's values, each waiting for its file in Cast & files, and a game carries them all. Only decisions, in tags showing a picture; a name of one word. Needs Datajack 2.1. |
| `[set: Drawn = random]`, `[set: Drawn = random not in Dealt]` | Gives a decision one of its values drawn at random; `not in` leaves out those another decision holds, by name: a card dealt is not dealt again. Nothing left, nothing changes. Saves keep the draws, as for counters. Needs Datajack 2.1. |
| `[set: Dealt = {Drawn}]` | Gives a decision its value named like the one another holds: the card drawn joins those dealt. Needs Datajack 2.1. |
| `[character: card1 = card]` | A character showing another's pictures: where its own expression has no file, the one of the same name of `card` is shown, and its entries are made there, where the files go. Ten places on a card table, one deck of pictures; look-alikes. Needs Datajack 2.1. |
| `[list: Board = 16 × none]`, `[list: Hand = cat \| dog]`, `[list: Queue]` | A list: values in numbered places, from 1, under one name, declared with what it holds at first (a number of the same value, values with `\|`, or nothing). Lists are every chapter's, written back with the definitions. Saves keep them. Needs Datajack 3.0. |
| `[set: Board 3 = cat]`, `[set: Board Cell = {Animal}]`, `[set: Board 2 = {Board 1}]`, `[unset: Board]` | A place given a value: written, or in braces what a decision, a counter or another place holds; the place a number or a counter's name. A place past the end makes the list longer. `[unset]` empties it. |
| `[add: Queue = {Cell}]`, `[take: Cell = first of Queue]`, `last of` | A value added at the end; the first or last taken out, into a counter (as a number) or a decision (as the value of that name): a queue, to go through cells one after another without recursion. |
| `[shuffle: Deck]` | The places mixed, from the game's draws: a save resumed shuffles as the game would have. |
| `{Board 3}`, `{Board Cell}`, `{Board size}`, `[if: Board Cell is cat]`, `[if: Queue size > 0]`, `[set: Near = {Counts 2}]` | A place shown, tested, or read back into a counter as a number; `size`, how many values the list holds, compared with a number or a counter (`[if: Cards size < {Cut}]`, Datajack 3.2.1). |
| `[choice: Cell grid 4 × 4 from Shown with tile]` | A choice shown as rows of picture buttons, numbered from 1, left to right then down, up to 30 × 24: each shows the picture of `tile` named like what its place of `Shown` holds (the value itself without one), and picking one gives `Cell` its number. The arrows move, Enter or Space picks. The tile's entries are made for every value the story's lists may hold. A line under it, `> {Left} cells left to open`, is shown in the text box while the grid waits, its values filled in each time (Datajack 3.2). `, marking Flag` at the end gives a second way to pick a tile, a right click or F, which gives its number to `Flag` and 0 to `Cell` (picking does the reverse): to mark a tile rather than open it (Datajack 3.2). Needs Datajack 3.0. |
| `[counter lasting: Coins = 0]`, `[decision multi lasting: Bag = Key \| Lamp]` | A counter or a decision the profile keeps from one playthrough to the next: within one it behaves as any other, going back undoing what was added or taken, and a new playthrough starts with what the last one left. What the player carries, apart from what the game knows (`[remember]`). Needs Datajack 2.0. |
| `[shown: Bag, Coins]`, `[shown after an ending: Trust, endings reached]` | What players see in their **Journal**: decisions while they hold something (a bag its items, until taken away), counters their number, and with `endings reached` the endings reached; always, or once the profile has reached any ending. Nothing unless the author says so. Lines among the definitions, names separated by commas; the Index writes them too. |
| `[add: Trust]`, `[add: Trust 2]`, `[add: Trust -1]` | Adds to a counter: 1, or the amount after its name. `[set: Trust = 0]` gives it a value. |
| `[add: Money -{Bet}]`, `[add: Money {Bet} * 2.5]`, `[set: Score = {Points}]`, `[if: Money >= {Bet}]` | A counter counting with another: adding, taking or setting what another holds, times a factor if wished, and comparing with it. Counters with different decimals count together exactly, the result rounded to what the counter keeps. Needs Datajack 2.1. |
| `[set: Weather = random 1 6]` | Gives a counter a whole number drawn between the two, both included, so that the same choices may lead elsewhere. A save keeps the draws, and going back does not draw again: a player cannot draw until it suits them. Needs Datajack 1.4. |
| `[if: Trust >= 3]`, `Trust < 2`, `Trust is 3`, `Trust is not 0` | Compares a counter with a number: `>`, `>=`, `<`, `<=`, `is`, `is not`; combines with the rest by `and` / `or`. |
| `[unset: Clues = Key]`, `[unset: Clues]` | Takes a value away from a decision, or every value: tests of it no longer hold, as if it had never been set. |
| `[ending: The Empty Room]`, `[ending: The Empty Room = La Chambre vide]` | Ends the path here: the player has reached this ending (named endings are counted). After `=`, what players read of it in the text's language, the name before it being how the story knows it. |
| `[no going back]` … `[no going back: off]`, `[no going back: until an ending]` | A part played forward only: as in game mode below, no going back, saving or loading, but its choices are points of the map as usual; the map shows them without *Play from here*, which would take the player back. `until an ending` lifts it once the player has reached an ending of the game: a second playthrough may go back, save, load and play from the map. Needs Datajack 3.2. |
| `[game mode]` … `[game mode: off]`, `[game mode: until an ending]` | A part played as a game: there, players cannot go back, save or load (Back, the keys, the log's lines and the Save and Load buttons say why), so that a card drawn or a mine opened cannot be undone; the log and the journal can still be read, and the game keeps saving itself, to resume where it was left. Its choices make no points on the map, which goes from the choice before it to the one after. Cyberdeck's preview lets the author go back anyway. The mini games are played so. `until an ending` lifts the lock once the player has reached an ending, the map still leaving the game out. Needs Datajack 3.2. |
| `[to be continued: Marie's story goes on in the next update.]` | What players read when the game runs out of the chapters it holds, a game exported with only some of them: the last one passed counts, so one at the start speaks for the whole story and one inside a route for that route. `[to be continued: none]` goes back to the default, *To be continued…*. Needs Datajack 2.1. |
| `[remember: The ghost's name]` | The profile remembers it for good, in every later playthrough; going back or loading an older save does not forget. |
| `[forget: The ghost's name]` | The profile forgets it, for good: a lasting flag the story can also clear, a key used up or a promise broken. Going back does not undo it either. Needs Datajack 2.0. |
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
out and why. The classes are renamed `author-<name>`, so that they reach the story's text, title
cards, text box and name plate, and never the player's own buttons and panels; players check a game's CSS again, and the
content security policy refuses anything from outside whatever happens. A paragraph holding a style
that draws text larger is cut into pages as if all of it were that large, so that its pages always
fit; pages cut before their style grew, or before a value they show grew longer, are listed in the tab, and editing one cuts it again.

**Title cards.** With *Show each chapter's title* on (Definitions), each chapter's title comes over
the stage as the chapter starts, before its text; moving on passes it, or it goes by itself. The
title takes the style `chapter title`, and the ending's name on the end screen the style `ending`:
declared like any style (`[style: Chapter title = gold, large, fade-in]`), or a class of the CSS.

**Text box and name plate.** The style `text box` draws the box the text is in, and `name plate`
the plate of the speaker's name: their colours, borders, rounded corners and shadows, declared as a
style or written as the classes `.text-box` and `.name-plate` of the CSS. A style or class named
after a character draws her plate alone (`.marie`), and a colour given to a character in Cast & files
colours her name. Two images, `text-box.png` and `name-plate.png` dropped in Cast & files, frame the
box and the plate, stretched by their edges so that their corners stay whole at any size. Stronger
contrast, in the player's settings, still puts a plain box behind the text, and the menus stay
Datajack's own. Needs Datajack 1.4.

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

In the storyboard, a `[play]` card's panel has **Open the scene**, and a scene's board says where it
is played from, each a link back to that `[play]`.

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
styles. They go away once nothing names them any more (`calm` replaced by `loud`, the values of
options renamed), and no undo could bring them back; one with a file or a setting of the author's is
offered for removal in Cast & files instead, so that no file is lost unasked (removing it forgets the
undo steps that would bring back what named it). A
directive whose name looks like a misspelled keyword (`[backgound: …]`) is reported rather than
taken for a new character. Images and sounds are then given to these entries by file name:
`rooftop.jpg`, `marie-smile.png` (Marie's `smile`), `marie.png` (her `normal`), `calm.mp3`,
`door.wav`, `opening.webm` and its captions `opening.vtt`, the frames `text-box.png` and
`name-plate.png`; case, spaces, hyphens and underscores do not matter. An entry without a file shows as
a placeholder. An animated picture (WebP, GIF or PNG: a character, a background, an illustration, a
grid's tile, the gallery's picture enlarged) is played by the stage itself, frame by frame, from its
start each time it is shown, in every browser (Firefox, left to it, plays a
picture once per page); one that plays once stops on its last frame, which players who ask for less
motion see at once. `docs/guide/examples/falling/` makes a character fall that way, its pictures
made by `scripts/examples/falling_assets.py`. Browsers without `ImageDecoder` show the file as it is.
The browser checks run in Chrome; those exporting `firefox = true` run in a headless Firefox too.

A paragraph longer than the textbox is cut into several pages: between sentences first, then
after `,` `;` `:` or a spaced dash, then between words as a last resort.

## Editing (Cyberdeck)

A **project** holds the whole game. Its screens:

- **Storyboard**, first at the **story's level**: every chapter as a card in playing order, with its
  page count and endings; chapters following one another under the same `[only if]` framed together
  as a route, the condition written once. A chapter's panel opens it, previews from it, exports it as
  text, renames or removes it (Ctrl+Z puts it back), and sets its condition, for it alone or for its
  whole route. The arrows move the focus, Enter opens, Ctrl+Shift+arrows and Ctrl+X, Ctrl+V move
  chapters, Delete removes, N adds one, P previews. Scenes follow, with the chapters and scenes
  playing each, which removing one warns about; a scene exported as text and imported again replaces
  itself. **New chapter** and **New scene** begin one with no page yet (`Chapter 2`, `Scene 1`,
  renamed at will), to be written page by page: a story needs no text to start from. **Start without
  a text**, in the Import tab of a new project, does the same for its first chapter. **↑ Story**, or
  Esc at a chapter's top level, goes back up.

  Inside, the chapter, or scene, as a grid of cards, read left to right and top to bottom, like a
  slide sorter. Pages and choices are numbered; pages inside branches carry the branch letters and
  colour (12a, 12b, 12ab when nested), the main line resuming after the longest branch. Endings,
  memories, breaks, plays of a scene (▷), assignments, definitions (◇) and
  staging are chips between cards, each opening for editing like a page. Each condition, and each loop (↻, its
  pages numbered on the main line), is **one block**, which
  selects, drags and moves as a whole: small, it shows its branches inside its frame; holding more
  pages than the limit set above the grid (5 by default, kept in the browser), it is a single
  stacked card giving its routes and pages, so that it never passes for a page. A block says when
  paths end inside it (★ every path ends, ★ 1 path ends, ★ by each branch). Pages that no path
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
  are edited, not moved. The **Graph** view draws the whole story as a map, laid out by itself:
  chapters one under the other, each choice and block forking into its branches and joining again,
  loops, endings where paths stop, and scenes apart, linked to each `[play]` that calls them. Drag or
  the arrows move it, the wheel or + and − zoom, Tab goes from box to box and Enter selects one and moves to
  its panel (Esc comes back); a box selected opens its
  card in the grid, adds a branch to its block or an option to its choice, or moves its branch.
  The **Text** view shows the level being worked on as the text it imports from, the whole chapter
  or the block opened in the grid, edited like a document with the tag editor's chips and
  suggestions; saving writes that part anew in place (pages and choices left as they were keep their
  identifiers, so saves made on them still resume there), its problems listed as in Import, and
  Ctrl+Z on the board puts the old text back. Leaving it with changes asks first.
  **B** adds a block after the focused card, written as text (`[if: ]`, `[else]`, `[end]`, ready for
  its condition); **E** edits a block's own text, its conditions and branches, as a page is edited,
  while Enter keeps opening it. A block's panel says how to do each.
  **Enter** on a card edits it, page or assignment, staging, ending, memory, break, as the text
  that imports into it, tags drawn as chips coloured by kind (red when the import would object,
  the reason shown under the text). Typing `[` suggests directives, then what each one takes as the
  tag goes: characters, expressions, positions, backgrounds, music, sounds, illustrations, scenes,
  styles, decisions and their values, endings and memories; **Insert tag** offers them by group,
  blocks (`[if]`, `[loop]`) written whole with the caret inside; a suggestion picked in the middle of a
  tag adds the space that follows. Backspace and Delete remove a chip whole and the arrows step over
  it, while a click into one, or **Alt+←** / **Alt+→** beside it, steps inside to change what it says;
  a line under the text says so whenever the caret is beside a tag. The text field stays underneath, so undo, copy and paste work as anywhere: problems show as you type, a page grown too long is
  cut as an import would, a new speaker becomes a character, and the page keeps its identifier so
  that saves on it stay valid. **N** writes new pages after the focused card the same way.
  **P** previews from the focused page or choice: Cyberdeck finds a way a player could get there
  (from the start of its chapter, then of the story, trying options at each choice), so that the
  preview opens with the stage and decisions of that path, as a save made there would. A page only
  reached through memories or endings of earlier playthroughs is previewed taking them as known.
  The preview's **State** button shows, beside the stage, each decision, counter and name as they
  stand on the page shown, what the profile remembers and the endings it has seen, and lets the
  author change any of them by hand to try what follows: a decision's value, a counter's number,
  a name, and memories and endings seen that no way through one playthrough could give (the cat
  knowing the player, as on a second playthrough). Memories and endings so changed are kept for the
  next previews, as a player's would be; the clock's counters stay as the clock reads them. The
  preview has the **Map** too, from its first page, as Datajack shows players theirs: the routes the previews explored (before any, it opens on every path),
  previewing from any point of them, `[no going back]` or not; **Every path** shows the map explored
  from the story itself, every option of every choice taken from the start, each choice from a few
  of the states it is reached in; a choice or an ending still missing, opened only by some values
  (Sakura Week's bonds of 2 or more), is searched for, the paths nearest to those values first, and
  its way drawn. The map says when some are still not on it, past a grid of picture buttons for
  instance. Each point tells, hovered, all its values, and previews from them; an option only other
  values open has its own ▶, previewing from a path where it is offered. A choice a loop asks again
  (a second stop of the afternoon) is drawn after the first, and an option leads to every place its
  paths went, so that every line goes forward and every point is reached by one.
  Ctrl+Enter saves, Esc cancels, Ctrl+Z undoes. The card being edited is marked (✎), the panel's
  title too while changes are not saved (●). Nothing written is thrown away unasked: opening
  another card, Esc, another chapter, another tab or leaving the project first asks to **Save**,
  **Discard** or **Keep editing**, and the browser asks before the page is closed.
- **Definitions**: the project's own decisions, counters and styles, edited as their declarations; those
  declared in chapters, each with where it is, to show or to **Move to Definitions**; those made
  by use, to declare here. Then the CSS of the styles, and title cards.
- **Index**: every decision, counter and memory, by kind in sections folded until opened, with a
  filter by kind; each with its values and every place that declares, gives, empties, tests or shows it
  (`Chapter 2 · page 7a`, `after 5`), grouped by use, a click away. The search finds names and
  values: `Truth` finds the decision `Answer`. First, what looks forgotten across the whole story,
  as an IDE would point it out, each with what to do: a decision or value tested but never given
  (that condition never holds), a memory tested but never remembered, an ending no path reaches, a
  scene never played; and, less pressing, what is declared or given but never used (tested nor shown), a
  value given but never tested. With nothing to look at, it says what it checked. A decision or a
  counter opened says whether players see it **in their journal**: never, always, or once an
  ending is reached, the menu writing the `[shown]` line among the definitions.
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
- **Cast & files**: drop images, music, sounds and videos (illustrations, voices and frames
  included); each file goes to the entry it is named after, replacing the file it had (the old one
  is deleted). A file's kind is known by its extension, whatever type the system gives it (`.ogg`
  arrives as `audio/ogg`, `application/ogg` or nothing at all); a file Datajack does not play is
  said so, apart from one no entry is named after. A `.zip` of files goes in as if unzipped and its
  files dropped, its folders passed over and what systems add beside them left out. Each kind is a section folded until opened, saying how many entries lack a file,
  with a filter by kind; names the story no longer uses but that keep a file come last, to remove.
  Each character may be given a colour for its name. Characters say which way their sprites were
  drawn looking, and how they are drawn: *full body*, standing on the bottom of the stage, at most
  960 pixels of its 1080, or *upper body*, as most Japanese visual novels draw them, at 1300 pixels
  whatever the file's size, the head near the top and the rest past the bottom of the stage. The
  project chooses for all its characters, each one may differ (Datajack 3.2). A font file (`.woff2`, `.woff`, `.ttf`, `.otf`) becomes a font of its name, which
  the CSS names: `font-family: "Cinzel"` for `Cinzel.woff2`. It is measured as it is added, how
  much wider or narrower than the text box's font it draws text, and pages in it are cut by that.
  Every game archive carries all the project's fonts; the player loads them from the archive, as
  bytes, never from elsewhere.
- **Details**: description, credits and cover, shown in players' libraries. The cover is shown at
  16:9, cut to fill it; Details says when an image is far from that shape. A picture named `cover`
  dropped in Cast & files, alone or in a zip, becomes the cover of a project that has none.
- **Export**: the release label, the chapters to include (of those left out, players see their
  titles, only how many there are, or nothing at all, as the author chooses) and, in a story of several languages, the
  languages players get (the first always; another only once it has a text for every chapter
  included and every scene, the tab naming those it lacks); and the whole story **as text**, in the
  language shown, its paragraphs one page each or as written.

**Text export** writes the story back in the syntax it was written in, with everything changed in
Cyberdeck: each page its own paragraph (so that the import cuts pages where they were), or, chosen in
the Export tab, its **paragraphs as written**, the pages the import cut from one paragraph joined again
by its own rules in reverse (a page of narration, or of the same speaker, goes on the one before it
when the import could not have fitted its first sentence there), for a text that reads like the one
written, to send to a translator; directives
written before a page on their own lines, those fired during its text where the typewriter reaches
them, conditions as `and` / `or` without parentheses. Importing it gives the same story: the tests
export, import, export again and compare. The whole story declares its decisions first and can
become a new project; a chapter (*Export as text* in its panel, on the story's level) leaves them out and, edited in Word
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
**Back up** downloads the project folder zipped, and **Restore a backup or a game** reads it back, on
this computer or another. Given a game exported, it makes the project again, for an author who lost
it: under the same identifier, so that players' saves still know the game, with what the game
carries (its chapters, scenes and files, the names and definitions of the project); the chapters it
left out are said, to be imported again, and entries whose file it did not carry wait for one.

**Several languages.** A story has one structure, its chapters in order, its scenes and its names
(decisions and their values, counters, endings, memories), and each language is a text laid over it;
no language is the main one, the first is only the first written. A project with nothing yet takes
the language of its first text. The language of a text is what its first line says, `[import: story
fr]`, or what the Import tab's **Language of the text** picks (a field that opens every language,
narrowed as one types a name in the editor's language or the language's own, or a code; a regional
code, `pt-BR`, is taken typed in full). In it, chapters correspond by their place: a new chapter of a
text goes to the first place its language has no text for yet, then to a new place, which the other
languages then show hollow, the title it has standing in; scenes correspond by their name, which
`[play]` uses and players never see; names are the same in every language, so they are declared from
any. **Story in**, at the top of the project, shows the story in one of its languages, nothing of the
others, or begins a new one (**Add a language…**); **Remove this language** takes out one that has no
text yet, and while the story has one language, **Change the story's language…** sets it right. A whole
story in a language other than the first (`[import: story fr]`) lays its chapters over the story's by
their place, those already translated included; the Import tab says where chapters go before importing.
Text exports always write their language, so that a text sent to a translator comes back as a
translation. Removing a chapter removes it in every language, as its confirmation says.
Pages are cut by each language's rules; in languages written without spaces between words (Chinese,
Japanese, Thai…), lines break between the words the browser finds, never before a closing mark nor
after an opening one. The words players read that the player itself writes (the end, the endings
count) are English in a language Datajack does not speak.

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
assets/frames/text-box.png     the frames of the text box and the name plate, in every archive
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
1.3, when it asks for names or has captions; 1.5, for Datajack 1.4, when it draws
numbers, shows counters or decisions in its text (or writes `{{`), frames its text box or name plate,
or colours a character's name; 2.0, for Datajack 2.0, when it has several languages, times its
choices, forgets memories or keeps lasting values, which an older player would play wrongly. A game
of one language that uses none of those keeps opening in Datajack 1.4. An older Datajack
says a newer game needs an update rather than failing on it, and Datajack 1.0 shows a game's text
without the CSS and title cards it does not know of. Projects are written in the current format, 2.0, and Datajack 2.0 reads every
1.x game.

When an archive is installed, the newer export (by date) brings the project, the release, the
chapter list and the scenes; an older archive only adds chapters still missing. Asset files go first and
`game.json` last, so an interrupted install leaves the previous state intact.

Cyberdeck exports in three ways: the story as text (to edit and import again), the whole game,
and selected chapters; the last two are this archive, made from a project's *Export* tab.

## Playing (Datajack)

### Library

After the profile, Datajack opens the library: the installed games with their cover, description,
release and chapters (those not installed counted, named, or not mentioned, as the author chose),
*Continue* from the profile's autosave, *New game*, credits, the *Map* and the *Gallery* of
illustrations seen, and removal (saves are kept). *Add a game…* or dropping an archive installs it.
**Settings** opens the profile's settings without starting a game, the same as in a game. A game's card has its own **Settings**: they are the profile's until the player chooses *its own* there (or in the game's settings), starting from the profile's; what changes then changes for that game alone, a slower text for one, a louder music for another, and going back to *the profile's* forgets them. Each card can also **Erase…** its game's progress, its saves, or both. A game in several languages has **Play in** on
its card: the language picked is kept for that game, by each profile; Datajack's own is taken first when
the game has it. A save resumes in the language it was played in; one loaded in another language from
the game's own Load panel resumes at the start of its chapter, with its decisions. On
the desktop, games live in the application's data folder (`library/games/<game>/…`, assets in
`library/assets/<sha-256>.<extension>`, shared by every game); in the browser, in IndexedDB.

### Controls

| Action | Default inputs |
|---|---|
| Show the whole page, then move on | Space, Enter, →, left click, mouse forward button, wheel down |
| Go back one step (a choice can be picked again) | ←, Backspace, Page Up, mouse back button, wheel up, the ◀ Back button |
| Log of past pages and choices (click a line to go back to it) | L, the Log button |
| Journal: what the author shows of what the player holds, and the endings reached | J, the Journal button (when the story shows anything) |
| Skip text already read | S, the Skip button |
| Auto mode: move on by itself, until any other input | A, the Auto ▶ button |
| Hide the text and the menu, to look at the picture (any input shows them again) | H, right click |
| Settings | O, the Settings button |
| Full screen | F |
| Leave a panel, or the game | Esc |
| Mark a tile of a game board, on a grid that marks (Minesweeper's flags) | F, right click: there only, where they do not go full screen or hide the text |

### Settings

The **Settings** screen has three categories. **General** sets the text speed (or each page shown
at once), the speed of auto mode, the volumes of the music (and videos), the sound effects and the voices, full screen and
the language. **Accessibility** sets the size of the text (100, 125 or 150 %, the text box growing
to hold it), a plainer font, a stronger contrast behind the text, pages and options read aloud by
the voice of the browser or the system (a page with a voice of its own is heard instead), timed
choices that wait for the player, the captions of videos that have them, and the name over the text
box: sliding to the character speaking (the default), jumping there, or staying put at the left,
middle or right, for players whom the moving name distracts, and *Motion*: as the system asks (the
default), less or all of it; with less, animated pictures stand still, pictures change without
turning, the stage does not shake and flashes are soft. Screen readers (NVDA,
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
profile has reached. Each profile keeps, per game, its progress beside its saves, the values of
lasting counters and decisions with it
(`<game>/progress.json`): the choices reached, where each option taken led, the endings, the pages
read, and what it remembers. The story reads only the memories and endings, through `remembered` and
`seen ending` conditions; decisions stay per playthrough.

**Map** (in the game, on the end screen and on the library card) shows the routes explored left to
right: each choice reached, its options (those not tried yet marked `?`), curves to where the tried
ones led, and the endings. Hovering a choice tells what the journal showed when it was reached, by
the same rule (nothing the author keeps from players). **Play from here** resumes the choice exactly
as it was reached, a new path for the autosave to follow. Two paths reaching the same choice merge
on the map when they agree on the decisions and counters the story still tests from there on,
whatever the stage shows (a scene may leave a character on it): otherwise characters could react
differently ahead, and they stay apart.

**Skip** (`S`) passes pages already read, and stops at new text, a choice or an end; in Cyberdeck's preview, it passes any text. **Auto** (`A`)
moves on by itself: a page with a voice waits for its line to end, another for a reading time
counted from the length of its text once it is all shown; videos are waited for, and choices, the
end and any other input stop it.

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

The game autosaves at every page and choice; Save and Load offer six slots more, each with a small
picture of the stage as it was saved. The Save panel also
offers the playthrough as a file (`<game> <date> <time>.json`), and the library's **Load a save or
progress…** (or dropping the `.json` on it) opens such a file in the current profile, on the web as
on the desktop, provided its game is installed. A game's card offers its **progress as a file**
(endings, map, gallery, read pages, lasting values), to carry to another computer or another build,
nothing being online: loaded the same way, it joins what the profile had reached, its lasting values
and language taken over. Saves are plain
JSON with decisions, background, music, characters (with their depth), the cover of a fade, the
tint, the text mode (and in full-screen text, the pages already on the screen) and the illustration
shown, by name, plus the list of options picked.
Loading a save whose page no longer exists (the story was updated) resumes at the start of its
chapter, or of the story, keeping the decisions. Save files are checked field by field before use.

### Security

The page runs only its own scripts and loads nothing from elsewhere (content security policy, as a
header on the desktop and a meta tag on the web). A game's CSS is checked before use and reaches
only the story's text, its text box and name plate (see Styles and CSS).

On the desktop it runs sandboxed, without Node, served from a private `datajack://` scheme;
navigation, new windows, web views and permission requests are refused. It reaches the disk only
through a short list of channels whose arguments the main process checks again: strings, bytes and
lists of strings only; identifiers that cannot leave their folder; asset files whose content matches
the SHA-256 in their name; and only save folders the player picked in the system dialog.

## Samples

`docs/sample/` holds stories to import, each a text and a zip of its files, dropped together in Cast &
files: **Sakura Week**, a week of school before a festival, in `sakura-week/` (its pictures and
sounds were made outside this repository: the zip is their only source), and six mini games in
`minigames/`, showing what conditions, loops, scenes, counters and decisions can do beyond a story.
Their pictures and sounds are made by code, `scripts/samples/`, so that nothing is downloaded and all
of it is as free as the rest of the repository.

- **Rock, paper, scissors** (`rock-paper-scissors/`): three choices against a random pick, text on a
  black screen, the score of this game and of every game played kept in the journal.
- **A virtual pet** (`virtual-pet/`): Pip, a round chick. A timed choice is its clock: feed, play,
  pet, let it nap, or just watch it live its own little life; lasting hunger, mood and energy, kept
  between 0 and 10. Never dies, only sulks a while; gladder to see players the longer they were
  away (`time away`); its room tinted at night (`hour`).
- **Blackjack** (`blackjack/`): a shoe of 1, 2, 4, 6 or 8 real decks, a list of 52 cards each,
  shuffled, dealt from the front (`[take]`), shuffled again between hands once a quarter is left;
  $1,000.00 to start (a lasting counter with decimals), bets chosen or typed, hit, stand, double
  down, the dealer's hidden card turned over, blackjack paying 3 to 2, five cards without going over
  winning at once (a five-card Charlie). Fourteen places on the table show one shared deck
  (`[character: p1 = card]`), each card named by the card drawn (`[enter: p1 {Card}]`).
- **Pairs** (`pairs/`): 16 tiles, 8 animals drawn as shapes, shuffled; a grid of picture buttons
  (`[choice: Cell grid 4 × 4 from Shown with tile]`) over two lists, the deck and what is shown; a
  pair stays face up, two different animals turn back at the next pick; the best number of turns kept.
- **Minesweeper** (`minesweeper/`): beginner 9 × 9 with 10 mines, intermediate 16 × 16 with 40, expert
  30 × 16 with 99, or a board of one's own (9 to 30 columns, 9 to 24 rows, 10 mines to
  (columns − 1) × (rows − 1), typed with `[ask number]`); the grid sized by counters
  (`grid {Columns} × {Rows}`); the mines placed after the first pick, so that it is never one; each
  cell's count kept in a list, and an empty area opened through a queue (`[add]`, `[take]`). The text
  box under the board tells the cells left to open (a grid's caption); a board cleared says how many
  seconds it took (`now`), and the best time of each level is kept, in the journal. A right click or
  F flags a cell (`marking Flag`), which picking then leaves closed.
- **Battle** (`battle/`): one duel, or three foes in a row with HP carried over and a short rest
  between them. Three creatures, fire beating leaf, leaf water, water fire; each turn strike, use a
  special move (three a battle), guard against the next hit or drink a potion, the foe choosing at
  random, a potion when low; the elements matter to special moves only. Both creatures' HP as bars
  (`[gauge]`), the moves along the bottom (`[choice: Action below]`), each side's poses through a
  scene choosing the right character, one scene working out any special move from who attacks whom
  (`[set: Attacker = {Mine}]`), hits shaking the screen; battles won and lost kept in the journal.

## Plan

What is left to do, in no particular order:

- **The map says which option each line follows.** Where a point branches, Sakura Week's Monday job
  for instance, the lines leaving it are alike: nothing tells which one goes on from *Decorations*
  and which from *The cashier's table*. Each line should carry the option it follows (its text, or
  its value when the text is long) where it leaves the point, in Datajack's map and in the
  preview's.
- **The map's lines go around points, not through them.** Points are laid out on one row, so a line
  that skips some of them crosses them: in Sakura Week's day loop, the option that heads home goes
  straight on to the next day, and its line runs over the points of the other options, so it is
  hard to tell where it goes. A line with a point in its way should step down below the row, run
  under it and come back up (`|_|`), in Datajack's map and in the preview's.

## License

Released into the public domain under the [Unlicense](LICENSE): anyone may use, change and
redistribute it, in source or built form, for any purpose, commercial or not, without giving
credit. The builds include third-party code (Vue, and Electron in the desktop builds), which keeps
its own licenses; the desktop builds ship Electron's license files with it.
