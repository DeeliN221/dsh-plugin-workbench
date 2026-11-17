# Port to the 0.2.2-rc.1 client platform (0.4.0)

Upstream 0.3.0 targets the 0.1.0-rc.6 client packages. The shell that serves it
(0.2.2-rc.1) has a frozen module table, and a browser bundle may only `require`
a specifier the table can answer: a platform seed word, an already-materialized
module, or a registered package factory. Anything else throws at boot and takes
the whole client entry down with it:

```
dsh-plugin-workbench: import failed: client-modules:
require("@deepseek-ai/dsh-client-runtime/client") missed the module table
```

## What changed

| Upstream 0.3.0 | 0.4.0 |
|---|---|
| `@deepseek-ai/dsh-client-runtime/client` provides `defineStore` | `@deepseek-ai/dsh-client-store` (a seed word) |
| `ClientContext` exported by the client runtime | `Context as ClientContext` from `@deepseek-ai/cordis` |
| `ctx.slots` merged in by the runtime | merged in by `@deepseek-ai/dsh-client-ui-renderer/client` (type-only) |
| `GlobalStandardProps.useSessions` from the runtime | from `@deepseek-ai/dsh-client-ui-session/client` (type-only) |
| `MarkdownText` / `ReadBlock` take no chrome | both require `labels`; the plugin's dictionary fills them |
| `sandbox.confine()` synchronous | `await`ed |
| externals: `dsh-client-web-react`, `dsh-client-ui-attachment`, `dsh-client-schema-form`, `dsh-client-runtime/client` | `PLATFORM_MODULES` of 0.2.2-rc.1: react, react/jsx-runtime, react-dom, @deepseek-ai/cordis, zod, @tanstack/react-virtual, dsh-client-store, dsh-client-ui-slots, dsh-client-ui-primitives, dsh-client-ui-dockkit |

The external list in `scripts/tsdown-preset.ts` mirrors
`packages/client/web/src/platform.ts` in the harness for 0.2.2-rc.1. Keep it
exact on the next bump: one specifier too many is a boot-time throw, one too few
inlines a module the shell already shares (two Reacts, two slot registries).

Built client bundle (`lib/client.js`) requires exactly:

```
@deepseek-ai/dsh-client-store
@deepseek-ai/dsh-client-ui-primitives
react
react/jsx-runtime
```

## Test-only dependencies

The published `@deepseek-ai/dsh-client-ui-primitives` and `dsh-client-store`
leave their own runtime deps to the shell (they declare none), so a standalone
repository has to supply them to run the client specs: `clsx`, `anser`,
`diff`, `katex`, `shiki` + `@shikijs/langs`, `simple-icons`,
`mdast-util-*`, `micromark-*`, `zustand`, `immer`, and the two
`@deepseek-ai/dsh-util-*` packages. They are `devDependencies` only — none of
them reaches `lib/`.

## Verification

```sh
pnpm run check   # typecheck → vitest (342 tests) → tsdown build
```

Deployment acceptance is a real browser load against the serving shell: no
`did not activate` banner, the sidebar workbench launcher renders, and the panel
opens with its files/terminal tabs.
