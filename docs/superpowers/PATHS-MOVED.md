# Paths moved — 2026-08-20

The dated specs and plans in this directory record designs as they were built.
Their file paths are left as written, because rewriting them would falsify the
record. This table maps the old paths onto the current tree.

See `docs/superpowers/plans/2026-08-20-codebase-structure-consolidation.md` for why.

| Written in older docs | Where it lives now |
|---|---|
| `components/soul/…` | `components/mobile/…` |
| `components/desk/…` | `components/desktop/…` |
| `components/studio/…` | deleted — `/studio` redirects to `/create` |
| `components/primitives/…` | `components/media/…` |
| `components/mobile/captions/style/primitives/…` | `…/captions/style/controls/…` |
| `hooks/studio/…` | `hooks/session/…` (only `useSessionHydration` survives) |
| `lib/desk/…` | `lib/desktop/…` |
| `lib/variants.ts` | `lib/variants/` — split by concern |
| `lib/ordioVariants.ts` | merged into `lib/variants/` |
| `lib/desk/deskVariants.ts` | merged into `lib/variants/` |
| `lib/studioVariants.ts` | deleted |
| `lib/store.ts` | `stores/` — split into capture/processing/ui/history/director |

`soul`, `desk`, `studio` and `primitive` are retired words. See `CONTEXT.md`.
