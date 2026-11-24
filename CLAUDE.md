# Working on Cyberdeck

Conventions for anyone (or any assistant) working in this repository. The README's
**Development** section explains how to build and run; this file covers how work is finished.

## Setup

- Use the Node version in `.nvmrc` (`nvm use`). An older default Node (npm without workspaces)
  makes `npm test` and `npm run typecheck` exit 0 without running anything.
- Browser checks: `npm run checks [-- name…]`; desktop builds: `npm run checks:desktop`. Output
  lands in `checks/output/<check>/`. Set `CHECKS_PORT_OFFSET` (e.g. `7`) when another run, or another
  copy of the repository, may be using the ports at the same time. A port clash looks like a failing
  check: rerun with an offset before suspecting the code.

## Words and syntax

- README **## Vocabulary** is the shared language: use its words in code, docs and discussion. A
  feature bringing a new notion adds its row there.
- The writing syntax reads as prose, a bit like Gherkin; keep new syntax readable as sentences.
  Advanced features need logic (algorithmic thinking), never "programming": describe them that way.

## Generated files

- `docs/guide/guide.md` is generated from `docs/guide/index.html`: never edit it by hand.
  `npm run guide:images` retakes the guide screenshots and regenerates it.

## French text

- Natural French, not a translation: non-breaking spaces (written `\u00a0` in the message
  files) before `: ; ! ? »` and after `«`.
- Plurals agree with the count wherever it is known; 0 and 1 are singular (`count <= 1`). Pass the
  count or the array to a message rather than a joined string. Only when no count can reach the
  message, use the classic parenthesised plural: « 3 fichier(s) importé(s) ».

## Finishing a version

Once a version's features are all in (not between them), in this order:

1. Unit tests and typecheck (`npm test`, `npm run typecheck`); new tests and browser checks for the
   new features.
2. All web checks and desktop checks. They take about half an hour together: run them once, at the
   end, rather than after every small change; a targeted check is enough along the way.
3. Two reviews of the whole diff since the previous tag, run in parallel:
   - `/code-review high --max-findings all <previous tag>...HEAD`, without `--fix`: bugs,
     optimisation (efficiency, dead code, duplication, reuse of existing helpers) and the
     `CLAUDE.md` conventions. Its opening line must show cleanup angles (`3+5 angles`); a bugs-only
     run needs a separate optimisation review. `/simplify` is not run on top: these cleanup angles
     are its review;
   - usability and GUI, with a fresh eye (an agent: `/code-review` does not cover it).

   Pool the findings of both, then fix them by package, not by review: one worker for `core` and `stage`, one for
   `cyberdeck`, one for `datajack` and `desktop`, so each owns its files and none carries every fix.
   A finding spanning two groups goes to one worker. A small round of fixes can stay with one worker.
4. Rerun the tests and checks after the review fixes.
5. Documentation: README (and its Vocabulary), the guide (`npm run guide:images`), CHANGELOG.
6. Reread every French string added or changed since the last tag:
   `git diff <tag> -- packages/*/src/i18n packages/cyberdeck/src/importing/problemMessages.ts`.
7. Bump the version in the root `package.json` and every `packages/*/package.json`.
8. `npm run release`, once the version's content is settled (not once per late fix).
9. Commit locally, then stop: pushing, tagging and publishing a GitHub release are the
   maintainer's call. A pushed tag is never rewritten; later fixes go in the next version.
   Pushing a `v*` tag publishes the apps and guide on GitHub Pages (`.github/workflows`).
