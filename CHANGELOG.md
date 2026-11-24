# Changelog

## 3.10.0 — 2026-11-24

### Cyberdeck
- The desktop application carries the guide: its About panel opens that copy in the system's
  browser, without an Internet connection. The guide's list of samples to download says it is
  online, for the latest version.
- An empty story level's "Or start without a text" begins with a capital, after a full stop.

### Datajack
- The About panel is for players: no links for authors, and, in the desktop application and the
  files opened in a browser (neither updates itself), one link, *Download the latest Datajack*,
  where a game asking for a newer Datajack sends them. Online or installed, it has no link.
- Installing an update names untitled chapters in the player's language and counts them: "added
  2 untitled chapters", « ajout de 2 chapitres sans titre ».

### Samples
- Knee-Deep's hero tips over on falling, to a boss too, and springs back up in the tavern
  whichever way the rescue comes.

### Both applications
- Save, Load and the map have keys: K, D and M, each closing what it opens, as L, J and O do. A
  new Accessibility setting, *Show the keys on the menu's buttons*, writes each button's first key
  beside its name.
- Keys follow the player's keyboard layout where the browser tells it (Chromium and the desktop
  applications): the default letters move to the keys printing them (on AZERTY, Auto mode is the
  key printed A) and keys are named as printed. Actions still on the US defaults of an earlier
  version move to the player's keyboard once; keys the player chose stay where they are, and a
  new default key another action already holds is left to it. Elsewhere, Settings says that keys
  are named as on a US keyboard.
- Keys act alone: with Ctrl, Alt or ⌘ held, they stay the browser's or the system's shortcuts
  (Ctrl+D bookmarks the page again). A key held down repeats only moving on and going back, so a
  panel or a mode no longer flickers on and off.
- The menu wraps onto a second row rather than leaving the stage when its buttons are long, in
  French or with long key names. Controls lists the actions in the menu's order.
- At the end of a game, Save does nothing (Load still works); while the end screen asks about a new
  game, other keys wait for the answer.

### Samples
- The mini games and Knee-Deep are in game mode from their first page: their introductions cannot
  be undone, saved or loaded, and their opening choices (Blackjack's rules and shoe, Knee-Deep's
  mode) are no longer points on the map.

## 3.8.1 — 2026-11-20

### Samples
- Knee-Deep: the Champion's Feast is on Barnaby's menu after any ending, game over included
  (Sightseeing aside); it no longer asks for a game without a single rescue.
- Battle: Rei's creature stands on its own platform again, at the back of the arena.

## 3.8.0 — 2026-11-20

### Both applications
- The end screen offers **New game**, first among its buttons: the story starts again from its
  first page, lasting values carried over, as from the library. It is one Tab away (not focused on
  arrival, so the key that read the last page cannot start a new game by accident), and always asks
  first: the autosave it replaces is where players come back to the end, or where the next
  chapters pick up a story to be continued. The question takes the focus on Cancel, which reads it
  out; Escape or Cancel puts it away and gives the focus back to New game.
- The player's panels take the keyboard focus as they open: the log on its list, where Space or
  Enter goes back nowhere, the first ↑, Home or End entering its lines and ↑/↓, Page Up/Down and
  Home/End moving from line to line, one Tab from Close; Save and Load on their first slot; the
  journal, the settings and full-screen text scroll with the arrows at once. Keys used in a panel
  stay the panel's, never acting on the story behind it, and Escape closes the state panel while it
  has the focus. Closing a panel opened by keyboard gives the focus back to its button; after a
  click, Space reads on as before.
- The map turns like a book's pages: Ctrl+→ (⌘+→ on a Mac), or the › strip at its edge, brings the last column in
  view to the left, so that every line can still be followed; Ctrl+← goes back, Ctrl+↑/↓ do the
  same by rows, taking the focus to the first card of the new page. Home and End go to the map's
  start and its last column.
- The map works from the keyboard: it opens with the focus on the card reached last, the arrows go
  from card to card, Tab goes through the card's buttons (its options' ▶ first), Enter plays from
  the card, and Escape closes the map from anywhere on it, as its close button says.
- For screen readers and the keyboard: full-screen text and the journal's entries have names; in
  Datajack's gallery, a locked illustration reads as one, and the illustration shown takes the focus
  and gives it back to its tile; in Cyberdeck, the question about unsaved changes focuses the first
  button that can be pressed, and Escape keeps editing.
- Scrollbars look the same everywhere: thin, tinted with the look's accent, stronger under the
  pointer. The stage and the map keep a light one over their dark screens, whatever the look.

### Datajack
- The library keeps its top buttons and the profile line on the right. In French, when they do not
  fit on one row, the profile line moves whole to a row of its own, rather than being left
  stranded at the bottom left. A long profile name wraps within a phone's screen.

### Knee-Deep
- Every new game first asks how to play: **the adventure**, as before, or **sightseeing**, for
  players who only want to see what the game holds: 2000 gold to spend, and the Rescue Gnomes
  carry you home for free, as often as it takes (no stamp, no gold lost, no *Gnomes Have a Policy*
  ending). Endings, trophies and blessings count as usual; a sightseeing game's gold does not carry
  over to the next game, and a boss beaten at level 1 is only recorded in the adventure.
- Barnaby's kitchen gains **the Champion's Feast**, 100 gold for three levels at once, once a
  game. It is on the menu for heroes who once reached an ending, the bakery aside, in the
  adventure without a single rescue.
- Every cheese brought home now also earns a **discount at Grizelda's**, 10% a cheese up to 30%,
  on everything she sells but the day's bargain and the humble hat. The Mayor mentions it, and
  Grizelda says so when you come in.

## 3.7.1 — 2026-11-19

### Both applications
- A splash screen, the application's icon and name, shows from the moment the page opens, while it
  loads: on a phone, the installed application no longer stays on a black screen for a while
  before its first screen appears. Datajack keeps it until its profiles are ready. Should the application
  fail to start, a line asking to reload the page appears after 15 seconds.
- Appearance: the plain box under the text now follows the text's colour, dark under light text and
  light under dark text, and goes as far as the text and the titles need to read (4.5:1). White text
  on a bright background no longer gets a near-white box.

### Knee-Deep
- Helping Sir Lorimer out of his tunnel takes a total of 8 or more to earn the potion, and says so;
  a lower total gets you sat on, for 2 damage. Any roll used to earn it.
- Backing away from Great-Uncle Flint leaves him in the Bedrock: he no longer follows you back to
  town, and the Bucket brings you back down to his floor whenever you like.
- Great-Uncle Flint is now the hardest fight of the Deep Delve, as the last boss should be: he
  was weaker than Gristle Goldgrin there (180 HP rather than 110, harder to hit, and he hits
  harder), and he warns you to bring potions before you choose to fight.
- In the *Long Overdue* ending, RENEWED is stamped on the side of the cheese wheel, inside its frame,
  rather than floating over the edge of the wheel.

## 3.7.0 — 2026-11-19

### Both applications
- `[shown while not zero: Inspired, Luck]` shows a counter in the players' journal only while it
  is not 0: a buff counting down, a bonus not yet earned. In the Index, a counter's *In the
  players' journal* menu offers it as **while not 0**. A story that uses it needs Datajack 3.7: the
  story format is now 3.7, its number matching the applications' again.
- `middle` beside a position is now the depth: `[move: marie 18% middle]` brings a character back
  from near or far. Alone, `middle` still means the centre, as before.
- A character drawn full body grows and shrinks around its feet, the lowest drawn line of its
  picture, when it comes nearer or goes farther: a picture with empty space under the feet no
  longer rises as it steps forward. Save pictures follow.
- An illustration now covers the characters on stage, as it always should have: they were drawn
  over it, unless a tint was on.
- `[transition: fade]`, `black` and `white` animate again, over the time asked for: a background
  change used to cut, or blink to black for a moment.
- A background change without a transition is a clean cut: the old background no longer lingers for
  a moment behind the new one, showing through while its picture is still loading.
- After `[fade out]`, what the story changes next, a background, a tint, a character, waits until the
  screen is covered, rather than showing while it darkens.

### Cyberdeck
- The import warns about a comma in a decision's value: tags read commas as spaces, so
  `The Lost Property, Again` is `The Lost Property Again`.

### Datajack
- A profile can have a **PIN**, a 4-digit code added, changed or removed from its own button next
  to the profile's name (*Add a PIN* until there is one). Entering the profile asks for it, at
  startup too, and so do erasing its saves or progress, and renaming, moving, exporting or removing it. Digits
  can be typed or tapped on large keys; after five wrong tries in a row, Datajack waits 30 seconds,
  then longer with each further one. A lock against other players, not against the browser's
  developer tools: a forgotten PIN cannot be recovered in Datajack, and *Forgot the PIN?* says what
  can be done.
- Each profile has its own **library**: games added, updated or removed in one profile leave the
  others alone, and a profile keeps the version it chose until it updates. Pictures and sounds two
  profiles share are stored once. Games installed before go into every profile.
- *Switch profile* now logs off: the next start shows the profiles instead of opening the last
  player's profile again.
- **Export to a file** saves a profile as one file (its games, saves, progress, settings, look,
  language and PIN), and **Import a profile** brings it back, on this device or another. An import
  always adds a new profile, never merging into or replacing one already there: when its name is
  taken, it offers the next free one, such as *Pascal 2*. The file is not encrypted; a zip locked
  with a password, a profile's or a game's, is refused with how to unlock it.
- Online, the note that a browser may erase what Datajack keeps now suggests exporting the profile.
- Removing a profile says its games go with it, and suggests exporting it first. *Erase what
  Datajack keeps…* in the library is now *Erase your games and saves…*.
- In French, the built-in games are now **Échantillons**.

### Samples
- **Sakura Week**: Mika and Mochi no longer stand in front of the pictures that already show them,
  nor stand up while the text has them asleep or in your lap.
- **Battle**: the three creatures line up on the stage, each named, to pick your partner; the one
  picked steps forward, the others step back, and you team up with it or see the others again.
- **Knee-Deep** grows:
  - The journal shows your to-hit and armour, your blessings (each saying what it gives), and
    Inspired and Luck while you have them.
  - Barnaby's kitchen is cheaper (the pie 15 gold, the rock cake 20), so a newcomer can afford a
    meal on the first day, and his bar pours **Anvil Ale**: two more on your next three rolls.
  - Grizelda sells a **Humble hat** that stops XP, for those who want to beat the bosses at
    level 1. The journal keeps which ones you have.
  - A new odd encounter, **the Lost Property**: a heap of everything ever dropped down the Delve,
    which cannot be talked to or run from. Slip past, or beat it for gold and plenty of XP; the
    first win ever earns Saint Gravel's thanks. Each win makes it come back bigger for the rest
    of the adventure, with a new name and entrance: a little more health, gold and XP every time,
    and now and then one more to its armour, to-hit and damage.
  - **The Deep Delve**: once you have won the cheese back, a new poster in the tavern offers a
    harder adventure with a sixth floor, someone even older than Ember, and a seventh ending.
  - A first game left before any ending now starts again with a short "back again" opening
    rather than the newcomer's introduction.
  - A game saved with Knee-Deep 3.6 keeps its to-hit and armour, now named *To hit* and *Armour
    class* in the journal.

## 3.6.3 — 2026-11-18

### Both applications
- The French interface has been rewritten throughout to read like natural French software, in
  Cyberdeck, Datajack and the player. Some English messages that were too terse to be clear were
  reworded too.

### Samples
- Every sample was proofread. **Blackjack** now explains the rules as the game plays them: a win
  pays as much as you bet, and a blackjack counts only on your first two cards. In **Sakura Week**,
  Hayashi's words on the porch now match how you liked her dango. The rest are small fixes to wording
  and grammar in Knee-Deep, Sakura Week and the minigames.

## 3.6.2 — 2026-11-17

### Both applications
- Online, a sample that cannot be loaded because the page is still an older version (kept on the
  device, while the site only has the latest version's samples) now says it comes with the new
  version, with a Reload button beside it. The page checks for a new version straight away, and
  the new-version bar comes back even after *Later*.

## 3.6.1 — 2026-11-17

### Both applications
- The map no longer leaves a point on its own when the player goes back a page after picking an
  option (the left arrow, Backspace, the mouse's back button, or the wheel turned up): the next
  choice is still joined to the option picked. Only going back to the choice itself undoes the pick.

### Samples
- **Knee-Deep** keeps more from one playthrough to the next. A boss beaten once gives its reward at
  the start of every later game: King Fungus's crown (+10 HP), Sir Rattlebones' shield (+1 armour)
  and a fresh golden parachute. So do the blessings marked "for good": the wishing well's 4 HP, the
  humming mushroom's 3 HP and Saint Gravel's wink (+1 on every swing); met again, they give
  something else instead of stacking. Barnaby's cellar now keeps the keepsake until the next ending,
  so quitting a game half-way no longer loses it, and choosing it offers **Back to the shelves**,
  each fighting item saying what it does.
- **Knee-Deep**'s next game starts with some of the last one's gold: half of it after an ending
  (Barnaby kept it behind the bar; the council borrowed the rest for bunting), a quarter after the
  Rescue Gnomes' policy or a game left unfinished.

## 3.6.0 — 2026-11-17

### Both applications
- The samples are built in, with nothing to download. **Datajack**'s library has a **Samples**
  shelf: each sample with its cover and description, **Add to library** to install it (nothing is
  installed until then), **In your library** once it is, and **Update** when the sample built into
  Datajack differs from the one added; saves are kept, and the sample is played from its own card
  like any game. **Cyberdeck**'s projects screen has **New project from a sample**: the sample opens
  as a new project of its own, never replacing or merging into yours; if a project has its name,
  **Open mine** opens it and **Fresh copy** makes *Name (2)*. In the web builds, a sample is fetched
  when picked, and kept for offline use from then on. Each sample's chapters, pages and entries keep
  their identifiers when its text is edited, so a save made before an update still finds its place.

### Datajack
- Each profile has its own **Appearance** and language: a child can play with Playground while a
  parent keeps Dusk. The profiles screen shows those of the profile played last, and no longer
  offers **Appearance**; its language menu still works before anyone is chosen. Existing profiles
  start with the look and language chosen until now, and so do new ones.

### Samples
- **Knee-Deep** carries something over from one playthrough to the next: a keepsake left in
  Barnaby's cellar, a bigger starting purse for every cheese returned, free meals for the hero, a
  Gold Card from the Rescue Gnomes for their best customer, trophies on the tavern wall, and a
  Mayor and a dragon who remember how the last game ended.
- Grizelda's curiosity shelf has a new bargain after every trip, one of nineteen: mostly cheap and
  silly, a few modestly useful.
- Three optional bosses for strong heroes, behind WANTED posters on the landings of floors 2, 3
  and 4: King Fungus the Fourth, Sir Rattlebones the Undefeated and Gristle Goldgrin, Chief
  Executive Goblin, each with a reward and a trophy.
- Barnaby's kitchen serves one treat at a time, good until the gnomes carry the hero home: a
  Quickstout that sometimes lets the hero act twice, a meat pie for harder hits, or a rock cake
  for a harder skin. Beating a boss again while carrying its trophy gives a hearty meal and a
  laugh instead of a second trophy.
- **Sakura Week**'s pictures are drawings (SVG) instead of PNG: as before on screen, sharp at any
  size, and its files shrink from 7.1 MB to 560 KB.

## 3.5.1 — 2026-11-17

### Both applications
- The About panel reads more easily, in English and French: how the application runs and where its
  data stays on two short lines, the install help as one line per browser, and plainer wording for
  the license and for the note that a browser may erase the data.

### Documentation
- The guide has a section on the logic itself, *Thinking it through*: a decision not made yet,
  how `and` and `or` combine (and without brackets), the order of `[else if]` tests, and a way out
  of every loop.

## 3.5.0 — 2026-11-17

### Both applications
- Three more **Appearance** presets: **Playground**, bright and sunny, for children (a sky, sun,
  mint and candy gradient under a white box, wide letters); **Forest**, dark green; **Ocean**, deep
  blue.

## 3.4.2 — 2026-11-16

### Both applications
- The **Look** setting is now called **Appearance**, the usual word, as in French.
- The map of what was played keeps every place an option led to: the same option leading to
  different points on different playthroughs (Sakura Week's Tuesday, rainy or not after the same
  afternoon) no longer leaves the earlier one with nothing leading to it.

## 3.4.1 — 2026-11-16

### Both applications
- Online, the site's root opens Datajack straight away, with no landing page: players needn't know
  Cyberdeck. Cyberdeck and the guide keep their addresses, given in the README.
- How to install the web builds, browser by browser, in the About panel of a web page, the guide and
  the README: Firefox on a computer installs no web page, and installing from a private window
  brings none of its data along.

### Samples
- **Knee-Deep**, a comic dungeon crawl: a tiny dwarf, a town to come back to, five floors of rooms
  drawn at random behind doors that hint at what they hold, fights decided by a twenty-sided die,
  chests picked from a grid, eighteen odd encounters, five endings. Its pictures, music and sounds
  are made by code (`scripts/samples/knee_deep_assets.py`). Also a download of its own beside each
  release.
- **Sakura Week** redrawn in a late-2000s chibi style, its pictures now made by code too
  (`scripts/samples/sakura_week_assets.py`).
- Every sample is online beside the applications, its text and its files linked from the guide.

## 3.4.0 — 2026-11-16

### Both applications
- A **Look** setting for Cyberdeck's and Datajack's own screens: a preset (Cyberpunk, the default,
  Graphite, Paper, Dusk, High contrast), or each part in depth: the background as one colour or a
  gradient from four corners, the font and its colour, the borders' colour and kind. A box under the
  text keeps it readable over any background, dark or light as the background is, and the setting
  shows the text's contrast, warning below 4.5:1, and the borders', warning below 3:1. The look is the application's alone: games, the
  preview, their settings and map keep the look their author gave them.
- The version at the foot of each first screen, with an **About** panel: version, how the
  application runs (desktop, files, web page or installed), licence, links to the guide and the
  repository.
- Online at https://pnguyen9.github.io/Cyberdeck/, both applications and the guide, published on
  each release. Online, the applications say that a browser may erase what a site keeps, and what to
  export to keep it safe.
- The web builds are installable (progressive web apps): they open offline once visited, and offer
  to reload when a newer version is online. Not in the desktop or double-click builds. Every web
  build uses relative paths, so it works from any folder of a web host.

### Datajack, the player
- Touch screens: a tap moves on, a long press hides the text (or marks a tile on a game board that
  marks), swiping right goes back and swiping left moves on. Keyboard and mouse play is unchanged.
- On phones and tablets, Datajack asks to turn the device sideways and offers full screen, locking
  the orientation where the browser allows it. The leave button's label, shown on hover with a
  mouse, is always shown on screens without one; a map point's journal is behind an **i** button.
- The map says which option each line follows: where a choice branches, each line carries the
  option's text (or its value, when the text is long) as it leaves the point, here and in
  Cyberdeck's preview. Lines no longer run through points: one with a choice in its way steps down
  below the row, runs under it and comes back up. The columns are wider apart to make room.

## 3.3.0 — 2026-11-11

### Stories
- `[gauge: HP / {MaxHP} bottom right numbers = {Hero}]`: a counter shown as a bar in a corner of the
  stage, out of a number or of another counter, sliding as the counter changes. Green, gold then red
  as it empties, or a colour of its own; its numbers if wished; named after `=`, values allowed.
  `[gauge: HP none]` takes it away, `[gauge: none]` every bar. Saves keep the bars. The bottom
  corners stay above the row of buttons, however large the text. Stories that use it need
  Datajack 3.3 (format 3.3).
- `[choice: Move below]`: the options side by side along the bottom of the stage, where the text box
  stands, leaving the pictures in view: a row of up to three, two by two for four, then three or four
  columns; options too many for the place scroll, none out of reach. A decision whose own name ends
  in *below* keeps it. Needs Datajack 3.3.

### Datajack, the player
- A picture shown for the first time no longer blinks: the pictures of the next stops are made ready
  while the current one is read, and a new expression replaces the one before only once it can be
  drawn, the old one staying until then.
- The map no longer starts a new point, alone at its left, when a game resumes at a choice reached
  just after an `[unset]`, as Sakura Week's first stop of each afternoon: closing the map, or playing
  from one of its points, did so. Points recorded before are joined.

### Samples
- **Battle**, a sixth mini game: one duel, or three foes in a row; three creatures, fire beating leaf,
  leaf water, water fire; strike, special move, guard or potion each turn, both creatures' HP as
  gauges and the moves along the bottom.

### Cyberdeck, the editor
- `[gauge]` and `below` are suggested while typing, each word of a gauge once and never two corners
  at odds; `[gauge]` is in Insert tag; a mistake in a gauge is named, a maximum or a word not
  understood; the Index lists the counters a gauge shows and the names in its label; the storyboard
  and the text export write them as typed.
- The preview's way back to the project is an arrow until pointed at, hiding less of the stage's
  corner.

## 3.2.1 — 2026-11-11

### Stories
- A list's size compared with a counter, `[if: Cards size < {Cut}]`, compares with what the counter
  holds: it was read as 0, so the test never held. Games using it need Datajack 3.2.1 to play it
  right; older ones still read 0.

### Datajack, the player
- Playing from a point of the map keeps the lasting values as the profile holds them now, the
  blackjack's money: it brought back what they held then, taking back what was won since or giving
  back what was lost.
- The map no longer tells points apart by lasting values: a second game begun with more money is
  the same choice, not a second start. Points recorded before are joined when the values match.

### Samples
- Blackjack's shoe is filled again between hands once a quarter is left, never during one: a card
  could show twice on the table, as two nines of hearts, with a single deck.
- Blackjack: five cards without going over 21 win at once, a five-card Charlie, rather than a sixth
  card drawn out of sight; the dealer's sixth to ninth cards fan out over the right of the hand.

### Cyberdeck, the editor
- The preview offers its map from the first page: before any choice is played, it opens on *Every
  path*; it waited for a choice to be reached.
- *Every path*: an option only other values open, as Sakura Week's evening with Sota, Hayashi, the
  cat or everyone, has its own ▶ that previews from a path where it is offered; *Play from here*
  offered only what the first path to the point could pick.
- *Every path*: a choice a loop asks again, the afternoon's second stop, is drawn after the first,
  with what its scenes ask; lines went back to the first, and an option leading elsewhere on another
  path left the choices it reached alone, unlinked.

## 3.2.0 — 2026-11-11

### Stories
- `[game mode]` … `[game mode: off]`: a part played as a game, where players cannot go back, save
  or load, so that a card drawn or a mine opened cannot be undone; the log and the journal can still
  be read. Its choices make no points on the map, which goes from the choice before it to the one
  after. Cyberdeck's preview lets the author go back anyway. Stories that use it need Datajack 3.2
  (format 3.2).
- `[no going back]` … `[no going back: off]`: a part played forward only, for a story whose choices
  are final: the same lock, its choices still points of the map, shown without *Play from here*.
- `: until an ending`, for either: the lock lifts once the player has reached an ending of the game.
- A grid's caption: a line under it, `> {Left} cells left to open`, shown in the text box while the
  grid waits, its values filled in each time.
- A grid that marks too, `, marking Flag`: a right click or F on a tile gives its number to `Flag`
  rather than to the picking counter. Players change those inputs in the settings, *Mark a tile of a
  game board*; elsewhere, F and the right click still go full screen and hide the text.
- `now`, the player's clock in seconds, beside `hour`, `weekday` and `time away`: a story keeps it
  when something starts and takes it away at the end, to time the player.

### Datajack, the player
- A game's own settings, from its card or its settings in the game: the profile's until the player
  chooses *its own*, starting from them, then changed for that game alone; back to the profile's,
  they are forgotten.
- Each game's card can erase that game's progress alone, its saves alone, or both, the game staying
  installed; *Erase what Datajack keeps…* still erases every game at once.
- A game removed can be installed again from the same file: picking it again did nothing.
- A timed choice goes on from the time it had left once a panel opened over it is closed: the log,
  the settings or the journal gave it the whole time again.
- An animated picture plays from its start each time it is shown, in Firefox too, which played it
  once per page and then showed its last frame: the stage now plays it frame by frame itself, for
  characters, backgrounds, illustrations and a grid's tiles, and so does the gallery, enlarged.
  Players who ask for less motion see where it ends at once.
- *Motion*, in the accessibility settings: less motion, as the system asks unless the player
  chooses, stands animated pictures still, changes pictures without turning, keeps the stage from
  shaking and softens flashes; a game's gallery follows it too.
- Hovering a choice on the map tells what the journal showed when it was reached.
- Paths reaching a choice with different stages, a scene having left a character on it, are one
  point of the map; points recorded before keep their place.
- The map records an option as soon as it is picked, and links it to the next choice even when the
  game was left, or the map opened, in between: it kept points with nothing picked, and lines missing.
- The map shows each option with the values of its moment, `Everything: 1,000.00 dollars`, rather
  than as written, `Everything: {Money} dollars`.

### Cyberdeck, the editor
- The preview's map shows *Every path* too, explored from the story itself, every option of every
  choice taken from the start, and the choices and endings only some values open searched for, the
  paths nearest to those values first: Sakura Week's six endings are all on it. Each point tells all
  its values; and the preview's Skip passes any text, read or not.
- The preview has the map, as Datajack shows players theirs: the routes its previews explored,
  previewing from any point, `[no going back]` or not.
- Upper-body characters, as most Japanese visual novels draw them, chosen in Cast & files for the
  project or for one character: drawn taller than the stage, whatever the file's size, the head near
  its top and the rest past its bottom; `near` zooms on the face, `far` shrinks from the bottom of
  the stage. Games that use it need Datajack 3.2.
- From a `[play]` to its scene and back: the play's panel opens the scene, and a scene's board says
  where it is played from, each a link to that `[play]`.
- A choice of many options keeps its card readable in the storyboard grid: the first options and how
  many more, rather than every line squeezed into the card.
- Each project can erase the progress of its previews alone, their saves alone, or both.
- A picture named `cover`, dropped in Cast & files alone or in a zip, becomes the game's cover when
  it has none: the samples' zips set their covers by themselves.
- An exported game carries the pictures of a grid's tiles: Pairs and Minesweeper, exported, showed
  their tiles without pictures, no tag naming them.

### Samples
- The mini games are played in game mode, from their first round.
- Minesweeper flags cells: a right click or F, picking then leaving them closed.
- Blackjack deals from a real shoe of 1, 2, 4, 6 or 8 decks, a list of the cards left, shuffled again
  when a quarter is left.
- Minesweeper tells the cells left to open under the board, the seconds a board cleared took, and
  keeps each level's best time, in the journal.

## 3.1.0 — 2026-11-10

### Stories
- A picture turns over, as a card does: `[card: {Hole} flip]` narrows the old picture to its edge,
  then widens the new one from it, in 0.4 s unless told (`flip 0.6s`), holding the text with `wait`.
  Players who ask for less motion see it change at once. Stories that use it need Datajack 3.1
  (format 3.1).
- `[wait]` holds the tags written after it too, before the text and inside it: `[card: back]
  [wait: 0.3] [card: ace]` shows the back, then the ace. Before, they all played at once and only
  the text waited.

### Datajack, the player
- The options of a choice share one width, the widest one's: a long option no longer stands out
  wider than the others.

### Cyberdeck, the editor
- After a picture's name in a tag, the suggestions offer `flip`, then `wait`.

### Samples
- Blackjack turns the dealer's hidden card over, rather than showing it face up at once.
- A short example in the guide, `docs/guide/examples/falling/`: a character falls, an animated WebP
  that plays once, each time it is shown, `[wait]` letting it finish before the next picture.

## 3.0.0 — 2026-11-10

### Datajack, the player
- Settings scroll when a category is taller than the screen: in Datajack, the language, last of the
  General settings, was out of reach.
- *Erase what Datajack keeps…*, below the games, removes every game, and if wished the profile's
  saves and progress (removing games alone keeps them, for when the games come back).
- The map tells paths apart by fewer values: only those that can still change what follows, tested
  ahead before the story gives them again. A number drawn just before each test of it, or a choice
  given again each round of a loop, no longer makes new points (progress recorded before keeps its
  points). Its lines cross less: each column is ordered after what leads to it and what it leads to,
  each point's lines leaving in the order of its options.
- *Progress to a file*, on a game's card, writes its progress (endings, map, gallery, read pages,
  lasting values) to carry to another computer or build; *Load a save or progress…* joins it to what
  the profile had reached.
- **Settings** in the library opens the profile's settings without starting a game: players find the
  accessibility settings before they need them.
- Settings, Accessibility: the name over the text box slides to the character speaking, as before,
  jumps there, or stays put at the left, middle or right, for players whom the moving name
  distracts. It no longer slides for players whose system asks for less motion.
- A game exported with only some of its chapters, played to the last one installed, says *To be
  continued…* rather than *The end.*, and the map no longer shows an end there: once the rest of the
  game is installed, the choice before links to what follows.
- `[to be continued: …]` gives the words of that moment, for the whole story or for a route: the last
  one passed counts. Stories that use it need Datajack 2.1 (format 2.1).

### Stories
- Counters with decimals: `[counter: Money = 1000.00]` counts in hundredths, exactly, and shows its
  number as the game's language writes numbers (`1,000.50`, `1 000,50`).
- `[ask number: Bet = 10, from 1 to {Money}]` asks the player for a number: the field takes a comma
  or a point, says what it understood, and refuses, saying why, a number out of bounds or with too
  many decimals.
- The player's clock, with nothing to declare: `hour` (0 to 23), `weekday` (1 for Monday to 7 for
  Sunday) and `time away` (minutes since the profile last played), tested and shown as counters.
- A picture named by a decision's value, `[enter: card1 {Card}]`, `[bg: {Place}]`: the one named like
  the value it holds as the tag plays, with no branch.
- `[set: Drawn = random not in Dealt]` draws a value of a decision, leaving out those another holds;
  `[set: Dealt = {Drawn}]` gives a decision the value named like another's.
- `[character: card1 = card]`: a character showing another's pictures.
- A counter counting with another: `[add: Money -{Bet}]`, `[add: Money {Bet} * 2.5]`,
  `[set: Score = {Points}]`, `[if: Money >= {Bet}]`.
- All of these need Datajack 2.1 (format 2.1).
- **Lists** (format 3.0): `[list: Board = 16 × none]`, places given, tested and shown by a number or
  a counter, `[add]` and `[take]` as a queue, `[shuffle]`, kept by saves.
- **A grid of picture buttons**, `[choice: Cell grid 4 × 4 from Shown with tile]`: each tile the
  picture its list's place names; the arrows and Enter, or the mouse, pick one.

### Cyberdeck, the editor
- The preview's **State** panel changes values by hand: decisions, counters, names, and memories and
  endings seen, which no single playthrough could give, to try a branch without playing to it.
- A **Text** view in the storyboard, beside Grid, Tree and Graph: the chapter, or the block opened,
  as the text it imports from, edited like a document and saved in place; pages and choices left as
  they were keep their identifiers, so that saves on them still resume there.
- *Restore a backup or a game…* makes a project again from a game exported, for an author who lost
  it: under the same identifier, players' saves still knowing the game, with the chapters and files
  the game carried; the chapters it left out are said.
- *Erase what Cyberdeck keeps…*, below the projects, erases the saves and progress of the previews,
  for a story played from a clean start, its lasting values back to what it declares; and if wished,
  every project too (on the desktop, to the system's trash).
- Exporting only some chapters, the author chooses what players see of those left out: their
  titles, only how many there are (the default, the titles giving nothing away), or nothing, the
  game seeming whole, for a story still being written or kept a mystery; the endings only those
  chapters lead to then go uncounted too, until they are installed.
- In the tree view, a long condition wraps inside its box, rather than running out of a pill's round
  ends.

### Samples
- A mini game, rock, paper, scissors, in `docs/sample/minigames/`, its sounds made by code.
- Sakura Week plays each extra scene of a character once before any comes back.
- A fifth mini game, Minesweeper: three levels or a board of one's own, the first cell never a
  mine, empty areas opened in turn; the grid sized by counters, `grid {Columns} × {Rows}`.
- A fourth mini game, Pairs: 16 tiles in a grid of picture buttons, the best number of turns kept.
- A third mini game, blackjack: a single deck or a six-deck shoe, bets chosen or typed, hit, stand
  and double down, the dealer's card turned over, cards and music made by code.
- A second mini game, a virtual pet: Pip, cared for or left to live its own life, gladder to see
  players the longer they were away, its pictures and sounds made by code.
- Sakura Week names the coming day at the end of each chapter, for a game exported a day at a time.

## 2.0.3 — 2026-11-06

### Datajack, the player
- *Save to a file*, in the Save panel, downloads the save again: clicking it closed the panel, which
  threw the file away before the browser could download it, so that nothing happened.
- The field for the player's name, and its OK button, glow when focused, rather than showing the
  browser's square ring, whose corners stuck out of the rounded field.
- The key chips of Settings, Controls, are drawn so that Firefox, zoomed and drawing with the
  graphics card, no longer leaves stray lines on them.

### Cyberdeck, the editor
- In the tree view, a column is never narrower than the block it holds: branches of a block inside a
  block no longer run into the next column.

### Downloads
As before, nothing to install: unpack a download and start the application inside.
- `Cyberdeck-2.0.3-windows-x64.zip` and `Datajack-2.0.3-windows-x64.zip`: for Windows; start
  `Cyberdeck.exe` or `Datajack.exe` (*More info → Run anyway* the first time: they are not signed).
- `Cyberdeck-2.0.3-linux-x64.zip` and `Datajack-2.0.3-linux-x64.zip`: for Linux; start `cyberdeck`
  or `datajack`.
- `Cyberdeck-2.0.3-web.zip` and `Datajack-2.0.3-web.zip`: for any computer with a browser; open
  `index.html`, without a server.
- `Cyberdeck-2.0.3-documentation.zip`: the illustrated guide for authors (open
  `docs/guide/index.html` in a browser, or read `docs/guide/guide.md`), the README, these changes
  and the licence.
- `Cyberdeck-2.0.3-sample-sakura-week.zip`: a sample story to try Cyberdeck with. Import
  `sakura-week.txt`, then drop `sakura-week-assets.zip` in Cast & files (and its `cover.png` in
  Details).
- `SHA256SUMS`: the checksum of each download.

## 2.0.2 — 2026-11-06

### Datajack, the player
- Choices with many options fit the screen: from five on, options are drawn closer; a list still too
  long scrolls in its place above the text box, its edges fading where more options lie, reached by
  the keyboard and the wheel. Six options used to run off the top of the screen and under the menu
  buttons.

### Cyberdeck, the editor
- The import points out a choice of more than eight options, which players see in a list that scrolls.

### Downloads
As before, nothing to install: unpack a download and start the application inside.
- `Cyberdeck-2.0.2-windows-x64.zip` and `Datajack-2.0.2-windows-x64.zip`: for Windows; start
  `Cyberdeck.exe` or `Datajack.exe` (*More info → Run anyway* the first time: they are not signed).
- `Cyberdeck-2.0.2-linux-x64.zip` and `Datajack-2.0.2-linux-x64.zip`: for Linux; start `cyberdeck`
  or `datajack`.
- `Cyberdeck-2.0.2-web.zip` and `Datajack-2.0.2-web.zip`: for any computer with a browser; open
  `index.html`, without a server.
- `Cyberdeck-2.0.2-documentation.zip`: the illustrated guide for authors (open
  `docs/guide/index.html` in a browser, or read `docs/guide/guide.md`), the README, these changes
  and the licence.
- `Cyberdeck-2.0.2-sample-sakura-week.zip`: a sample story to try Cyberdeck with. Import
  `sakura-week.txt`, then drop `sakura-week-assets.zip` in Cast & files (and its `cover.png` in
  Details).
- `SHA256SUMS`: the checksum of each download.

## 2.0.1 — 2026-11-06

### Cyberdeck, the editor
- Files are known by their extension, whatever type the browser or the system gives them: `.ogg`
  sounds and music dropped in Cast & files were refused in some browsers, said to have no entry of
  their name. A file of a kind Datajack does not play now says so.
- A `.zip` of files dropped in Cast & files goes in as if unzipped.
- Details says when a cover is far from 16:9, the shape the library shows it in, cutting the rest.
- French wording of 2.0 read again and made clearer, with some English alongside.
- A sample story, *Sakura Week*, with its files and a 16:9 cover, in `docs/sample`.

### Downloads
As before, nothing to install: unpack a download and start the application inside.
- `Cyberdeck-2.0.1-windows-x64.zip` and `Datajack-2.0.1-windows-x64.zip`: for Windows; start
  `Cyberdeck.exe` or `Datajack.exe` (*More info → Run anyway* the first time: they are not signed).
- `Cyberdeck-2.0.1-linux-x64.zip` and `Datajack-2.0.1-linux-x64.zip`: for Linux; start `cyberdeck`
  or `datajack`.
- `Cyberdeck-2.0.1-web.zip` and `Datajack-2.0.1-web.zip`: for any computer with a browser; open
  `index.html`, without a server.
- `Cyberdeck-2.0.1-documentation.zip`: the illustrated guide for authors (open
  `docs/guide/index.html` in a browser, or read `docs/guide/guide.md`), the README, these changes
  and the licence.
- `Cyberdeck-2.0.1-sample-sakura-week.zip`: a sample story to try Cyberdeck with. Import
  `sakura-week.txt`, then drop `sakura-week-assets.zip` in Cast & files (and its `cover.png` in
  Details).
- `SHA256SUMS`: the checksum of each download.

## 2.0.0 — 2026-11-05

A story in several languages, things the profile carries from one playthrough to the next, a journal
for players, and timed choices whose waiting is shown. A major version, because translating works
differently; nothing old stops working: Cyberdeck opens 1.x projects as stories of one language, and a
game of one language that uses none of what is new here keeps opening in Datajack 1.4. Datajack 2.0
reads every 1.x game.

### Cyberdeck, the editor
- Several languages in one game: one story, each language a text laid over it. The language of a text
  is what its first line says, `[import: story fr]`, or what the Import tab picks; chapters correspond
  by their place, scenes by their name, and a chapter a language has no text for yet shows hollow,
  its title standing in. **Story in**, at the top of the project, shows one language at a time, or adds
  one; the Export tab ships the languages that have every chapter chosen. Ending names are translated
  with `[ending: The Empty Room = La Chambre vide]`. Any language, picked by its name or its code;
  lines of languages written without spaces (Chinese, Japanese…) break between words.
- *Copy without the story* is gone: a translation is a language of the same project. A new project no
  longer asks for a language: its first text says it.
- `[forget: …]` takes a memory away, as `[remember]` gives it.
- `[counter lasting: …]` and `[decision lasting: …]`: values the profile keeps into the next
  playthrough.
- `[shown: …]` and `[shown after an ending: …]` choose what players see in their journal; the Index
  writes them too.
- Timed choices: any option may be the one waiting takes, and it is offered as the others.
- Text export may join the pages cut from one paragraph, to read as written (for a translator).

### Datajack, the player
- Plays a game in the language picked on its card, Datajack's own first when the game has it.
- The Journal (J): what the author shows of what the player holds, and the endings reached.
- Timed choices offer the option waiting takes, the time running out along it.
- Carries lasting values into the next playthrough, and forgets what the story forgets.

### Downloads
As before, nothing to install: unpack a download and start the application inside.
- `Cyberdeck-2.0.0-windows-x64.zip` and `Datajack-2.0.0-windows-x64.zip`: for Windows; start
  `Cyberdeck.exe` or `Datajack.exe` (*More info → Run anyway* the first time: they are not signed).
- `Cyberdeck-2.0.0-linux-x64.zip` and `Datajack-2.0.0-linux-x64.zip`: for Linux; start `cyberdeck`
  or `datajack`.
- `Cyberdeck-2.0.0-web.zip` and `Datajack-2.0.0-web.zip`: for any computer with a browser; open
  `index.html`, without a server.
- `Cyberdeck-2.0.0-documentation.zip`: the illustrated guide for authors (open
  `docs/guide/index.html` in a browser, or read `docs/guide/guide.md`), the README, these changes
  and the licence.
- `SHA256SUMS`: the checksum of each download.

## 1.4.0 — 2026-11-04

The story as a map, values and chance in the text, the look of the text box, auto mode and save
pictures. Projects of 1.3.0 open as they were; games using what is new here need Datajack 1.4, which
an older one says rather than failing.

### Cyberdeck, the editor
- The story is the storyboard's first level, replacing the Chapters tab: every chapter a card in
  playing order, those under the same `[only if]` framed together as a route, its condition set
  from the panel for one chapter or the whole route. Esc or ↑ Story goes up from a chapter.
- A Graph view draws the whole story as a map: chapters, choices and blocks forking and joining,
  loops, endings, and scenes linked to where they are played. From there, add a branch or an option,
  or move a branch. Usable from the keyboard as from the mouse.
- Blocks are made and edited from the storyboard: B adds an `[if]` written as text, E edits a
  block's own text, conditions and branches included.
- Values in the text: `{Hour}` shows a counter, `{Clues}` a decision's values, as `{Hero}` already
  showed a name; a `{…}` naming nothing known is reported, and `{{` writes a brace.
- Chance: `[set: Weather = random 1 6]` draws a counter's number.
- The text box and the name plate take the styles `text box` and `name plate` (or the classes
  `.text-box` and `.name-plate`), a frame each from `text-box.png` and `name-plate.png`, and each
  character a colour for their name.
- The preview's State button shows the decisions, counters and names on the page shown, what is
  remembered and the endings seen.
- Names nothing uses any more go away by themselves; those keeping a file are offered for removal
  in Cast & files.
- The Index and Cast & files are in folded sections with a filter by kind; the Index shows its
  warnings first, each with what to do, groups each name's places by use, finds values by search,
  and points out a value given but never tested.
- Suggestions add the space that follows; Alt+← and Alt+→ step into a tag beside the caret.
- Removing a chapter or a scene can be undone. The guide gains recipes for bigger stories, and a Markdown version, `docs/guide/guide.md`, readable
  on GitHub.

### Datajack, the player
- Auto mode (A, or Auto ▶): pages move on by themselves, waiting for a voice or for a reading time,
  with a speed of its own in Settings.
- Each save slot shows a picture of the stage as it was saved.
- Shows values and draws numbers in the text, frames and colours the text box and name plates.

### Downloads
As before, nothing to install: unpack a download and start the application inside.
- `Cyberdeck-1.4.0-windows-x64.zip` and `Datajack-1.4.0-windows-x64.zip`: for Windows; start
  `Cyberdeck.exe` or `Datajack.exe` (*More info → Run anyway* the first time: they are not signed).
- `Cyberdeck-1.4.0-linux-x64.zip` and `Datajack-1.4.0-linux-x64.zip`: for Linux; start `cyberdeck`
  or `datajack`.
- `Cyberdeck-1.4.0-web.zip` and `Datajack-1.4.0-web.zip`: for any computer with a browser; open
  `index.html`, without a server.
- `Cyberdeck-1.4.0-documentation.zip`: the illustrated guide for authors (open
  `docs/guide/index.html` in a browser, or read `docs/guide/guide.md`), the README, these changes
  and the licence.
- `SHA256SUMS`: the checksum of each download.

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
