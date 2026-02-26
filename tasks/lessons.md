# Lessons Learned

## Next.js Version: Downgraded 16 → 15
- **Next.js 16 defaults to Turbopack**, which does NOT support webpack plugins (e.g. `copy-webpack-plugin`). Too many dependency incompatibilities.
- **Decision:** Downgraded to **Next.js 15 (15.3.3)** which uses webpack by default. This restored compatibility with `copy-webpack-plugin` for VAD asset copying and other deps.
- **Current config:** `next.config.ts` uses webpack `CopyPlugin` directly — no shell script workaround needed.
- **Lesson:** Don't jump to bleeding-edge framework versions when the ecosystem hasn't caught up. Next.js 15 is stable and well-supported.

## OpenAI SDK — No Module-Level Instantiation
- `new OpenAI()` at module top-level crashes the build if `OPENAI_API_KEY` is missing — Next.js evaluates route modules during `next build` (page data collection).
- **Fix:** Lazy-initialize with a `getOpenAIClient()` factory function called inside the request handler.

## pnpm Monorepo — Transitive Dependencies
- In pnpm strict mode, transitive deps (e.g. `onnxruntime-web` via `@ricky0123/vad-web`) aren't directly resolvable with `require.resolve()` from the workspace root.
- **Fix:** Walk up from the direct dependency's directory or search the `.pnpm` store. See `scripts/copy-vad-assets.sh` for the pattern.

## VAD in Next.js — SSR Safety
- `@ricky0123/vad-react`'s `useMicVAD` hook may fail during SSR. The Next.js example uses `dynamic()` with `ssr: false`.
- **Better approach for hooks:** Use `@ricky0123/vad-web`'s `MicVAD` class directly with dynamic `import()` inside a `useEffect`. Gives full lifecycle control and zero SSR risk.

## Web Speech API Gap
- `startLiveTranscription()` was defined in the hook but never called from `handleStartRecording` — the live captions panel was always showing "Listening..." with no words. Now fixed.

## Remotion — Not Suitable for Client-Side-First Architecture
- **`@remotion/web-renderer`** is experimental ("expect bugs and breaking changes") with severe CSS limitations: no `z-index`, `filter`, `clip-path`, `backdrop-filter`, `mix-blend-mode`, or `text-decoration`.
- **`@remotion/bundler`** uses Webpack directly — incompatible with Next.js 16's Turbopack default.
- **Licensing:** Free for ≤3 people, but $25/seat/month beyond that. Source-available, not truly open-source.
- **Server rendering** requires headless Chrome + FFmpeg — defeats $0 hosting constraint.
- **Remotion is migrating encoding to Mediabunny** (standalone, MPL-2.0, zero-dep). Use Mediabunny directly instead.
- **Lesson:** Always evaluate open-source tools for: license model, bundle size, SSR/build-tool compatibility, and whether the experimental features you need are actually stable.

## Library Selection Criteria (Established 2026-02-24)
When evaluating open-source libraries for Ordio:
1. **License** — must be permissive (MIT, BSD, MPL-2.0, Apache-2.0). Avoid GPL, source-available with commercial restrictions.
2. **Bundle size** — MVP target is <500KB gzipped total. Reject anything >200KB that can be replaced with Web APIs.
3. **Build compatibility** — must work with Next.js 16 + Turbopack (no Webpack plugin dependencies).
4. **SSR safety** — must handle server-side rendering gracefully (dynamic import or feature detection).
5. **Maintenance** — prefer actively maintained (commits within 6 months), >500 stars, >1 contributor.
6. **Web API preference** — if a native Web API (WebCodecs, MediaRecorder, Web Audio) does the job, prefer it over a library.

## Caption Editor — UX Pattern: Click vs Double-Click
- Single click for the most common action (seek/navigate), double-click for destructive/edit action.
- Keep `focusedIndex` (keyboard nav) separate from `editingIndex` (inline edit mode). They serve different purposes.
- For scrollable word chips: `max-h-*` + `overflow-y-auto` on the container, `scrollIntoView({ block: 'nearest', behavior: 'smooth' })` on the active element.

## Always Cross-Check TODO Before Planning
- Before recommending "next steps", always read `tasks/todo.md` and cross-check against actual files in the codebase. Previous sessions may have completed work that wasn't marked in the TODO.
- Check: is the package installed? Does the file exist? Is the hook wired up? Don't trust the checklist alone.
