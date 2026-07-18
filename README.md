# Ordio Monorepo

Ordio is an audio-to-caption/video workflow app built as a PNPM + Turborepo monorepo.

It includes:
- `apps/web`: Next.js app (recording, transcription, caption editing, export UX)
- `packages/convex`: Convex backend functions and schema
- `packages/shared`: Shared types/utilities used by apps

## Tech Stack

- Next.js 15, React 19, TypeScript
- Convex (backend + storage)
- Clerk (auth)
- Zustand (state)
- Turborepo + PNPM workspaces

## Repository Structure

```text
apps/
  web/         # Main product UI
packages/
  convex/      # Convex functions/schema
  shared/      # Shared code between apps
```

## Prerequisites

- Node.js `>=18`
- PNPM `>=8`

## Setup

1. Install dependencies:

```bash
pnpm install
```

2. Create local env file:

```bash
cp .env.example .env.local
```

3. Fill required keys in `.env.local`:
- Clerk keys
- `NEXT_PUBLIC_CONVEX_URL`
- `OPENAI_API_KEY`
- Payment keys if testing billing flows

## Run Locally

### Option A: Run all workspace dev processes

```bash
pnpm dev
```

### Option B: Run core services explicitly (recommended)

Terminal 1:
```bash
pnpm --filter @Ordio/convex dev
```

Terminal 2:
```bash
pnpm --filter web dev
```

## Common Commands

From repository root:

```bash
pnpm build
pnpm lint
pnpm test
pnpm type-check
pnpm format
```

App-specific examples:

```bash
pnpm --filter web test
pnpm --filter web test:e2e
pnpm --filter @Ordio/convex deploy
```

## CI/CD Notes

- Keep `main` green: run `lint`, `type-check`, and relevant tests before merge.
- Convex changes should be validated with local `convex dev` before pushing.
- If pagination/auth behavior changes, test with a clean browser session to avoid stale cursor/token artifacts.

## Security

- Never commit secrets to git.
- Keep production keys only in secure deployment envs/secrets managers.
- Rotate exposed keys immediately.

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE).

