# Handoff — dsh-plugin-workbench

Continuation brief for a fresh session working on this repo. Read this fully,
then `~/dsh/PLAN-dsh-plugins.md` (design history + 34-item pitfall list, local
machine only, NOT in git) and `~/dsh/OPS-dsh.md` (install/restart/upgrade
runbook). The GitHub repo is public: keep secrets and anything sensitive out.


## Working agreement — git is the source of truth

This repo is edited from more than one place: a parked continuation session for
this repo, and whichever session the user happens to be in. That drifted once —
the same repo had uncommitted work in one place while another session was
building on top of it — so:

**Commit and push as soon as a change is finished. Do not leave finished work
sitting uncommitted, and never assume the working tree is what git has.**

Before starting anything: `git pull` (or at minimum `git status && git log --oneline -3`).
Whatever is on `main` is what everyone else — and every `github:` install —
sees. `lib/` is committed here, so it must be rebuilt and committed with the
source in the same commit, or a git install serves stale code.

The bundle is byte-reproducible (the preset sorts lightningcss's CSS Modules
export map), so a `lib/` diff always means a real change — treat an unexpected
one as a signal, not noise.

## What this is

A DeepSeek Harness (dsh) out-of-tree plugin: file browser + preview/edit +
raw-PTY web terminal, docked to the right of the active session. v0.3.0.
This repo is the standalone development home (it was split out of the old
`dsh-plugins` monorepo, which is now only the auth gateway,
`ghbhiee/dsh-auth-gateway`). Sibling repos: `dsh-plugin-mobile-shell`,
`dsh-plugin-cli-session`.

## Feature state (all live-verified)

- **Docked right of the session** by default; full-frame ⇄ dock toggle; drag /
  arrow-key resizable split (width persists). Docking = `data-workbench-docked`
  + `--wb-dock-width` on the AppFrame + `margin-inline-end` on the conversation
  column (frame's 2nd grid child). Never overrides `grid-template-columns`.
- **Two launchers**: sidebar footer (root scope, binds the store) and
  conversation header top-right (`conversation.session.header.utilities`,
  session scope — drives the surface via the window-event bridge in
  `workbench-events.ts`, because a store handle mounts at ONE scope only).
- **Session-aware**: file tree roots at the active session's cwd (via the
  `useSessions` prop — no extra inject/external) and re-roots on session
  switch; terminal spawns there too (cwd rides the PTY handshake URL /
  `create` message, fenced by `resolveCwdWithinRoots` before spawn).
- **Safe HTML preview**: `<iframe srcdoc sandbox>`, inert by default
  (`sandbox=""`); per-file "Enable scripts" opt-in = `allow-scripts` alone,
  NEVER with `allow-same-origin`. Toggling remounts the iframe (React `key`) —
  mutating `sandbox` on a live srcdoc frame does not reload it.
- **Narrow drill-in**: below **720px** pane width the browser stacks list →
  preview with a Back button (`data-narrow`/`data-view`, measured by
  ResizeObserver on the pane, not the window). The threshold is about the
  preview being usable, not both panes merely fitting: the list wants ~300px,
  so the old 560 left a ~260px preview — columns in name only.
- **PDF preview + download everywhere**: `.pdf` renders in the browser's own
  viewer straight off the bytes route (skipping the text read that used to
  earn it a `binary_file` dead end). Every preview — including the kinds
  nothing can render — carries a Download hitting `bytes?…&download=1`
  (`content-disposition: attachment`). Verified in Chrome that the strict CSP
  does NOT block its PDF viewer, so nothing was relaxed for it.
- **Conversation file links → panel preview** (`link-preview.ts` + interceptor
  in `WorkbenchOverlay`): dsh's file links (inline mentions, produced chips,
  tool-card paths) natively open through the HOST opener — useless remotely.
  A document-capture click listener, scoped to the conversation/details
  columns and excluding `[data-workbench-panel]`, recognizes links purely by
  content (button title/text path-shaped), resolves + stats the path, then
  opens the docked panel **preview-only** (no list; Back resumes browsing).
  Same link again closes and restores (`linkClick` pure transition). It also
  catches **inline `<code>` dsh left inert** — dsh only linkifies files it
  tracked, so a path a bash step wrote is plain code, and that is exactly the
  file with no other way to open it; resolvable paths get a hover affordance,
  and a click that finishes a text selection is ignored. Content heuristic by
  necessity: the service can't be re-registered and the buttons only have hash
  classes.
- **The resize divider uses pointer capture**, not document listeners: the
  panel renders iframes (PDF/HTML previews) and a drag crossing one delivers
  its pointerup INSIDE that frame, so the listeners were never removed and the
  divider kept following the mouse. A `buttons === 0` move also settles a drag
  whose release was lost.

## Architecture map

Host half (`src/`): `index.ts` (config + mounting), `api.ts` (HTTP routes),
`roots.ts` (read fence + cwd fence), `write-guard.ts`, `search.ts`,
`origin.ts` (same-origin gate), `pty.ts` (WS terminal gateway).
Client half (`src/client/`): `index.tsx` (seat registrations),
`WorkbenchOverlay.tsx` (surface + dock + interceptor), `FileBrowser.tsx`,
`FilePreview.tsx`, `TerminalPane.tsx` + `terminal-model.ts`, `store.ts`
(one root-scope handle), `workbench-events.ts` (cross-scope bridge),
`link-preview.ts`, `artifact-resolve.ts`, `session-root.ts`, `dock-width.ts`
(pure helpers live OUTSIDE store.ts — importing store.ts runs the module
loader side-effect and breaks node tests).

## Hard constraints (do not relearn)

- **Client bundle contract** is replicated in `scripts/tsdown-preset.ts`:
  CJS wrapped in `window.__ModuleLoader__.load`, exactly 10 externals, CSS
  inlined. Do not add an external.
- **Styling**: only `--dsw-alias-*` tokens and stable data attributes
  (`data-shell-overlay`, `data-sidebar-collapsed`, …). NEVER hash class names.
- **Security invariants** (all tested, several mutation-tested): read-root
  fence (`resolveInRoot`), writes off by default, same-origin gate on PTY +
  mutating routes, symlink-write refusal, CSP+sandbox on served bytes
  (stored-XSS fix — do not regress), PTY cwd fence, HTML sandbox pairing rule.
- **lib/ is committed** (bare `github:ghbhiee/dsh-plugin-workbench` installs
  serve it). Rebuild + commit lib/ with every source change, and always build
  it from THIS repo's checkout (CSS hashes derive from the build path).
- `exactOptionalPropertyTypes` is on: optional props that receive a possibly-
  undefined value must be typed `?: T | undefined`.

## Build / verify loop

```sh
pnpm install          # once
pnpm run check        # typecheck → vitest (342 tests) → tsdown build
```

Local deployment (this Mac): the dsh `web` profile links to this clone
(`dsh plugin --profile web add ~/dsh/dsh-plugin-workbench`), so:

```sh
pnpm run build && launchctl kickstart -k gui/$(id -u)/com.tokencv.dsh-web
curl -s http://127.0.0.1:3080/plugins/workbench/api/health
# UI: http://127.0.0.1:3080 (raw dsh) or https://mac.tokencv.com (passkey)
```

Add tests for every new behavior; mutation-test security-relevant guards
(revert the guard, confirm the test fails). CI = `pnpm install
--frozen-lockfile && pnpm run check` — commit the lockfile when deps change.
