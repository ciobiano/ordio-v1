# GEMINI.md — Gemini Configuration for Ordio v1.0

## Project Context
**App:** Ordio v1.0 (Audiogram Generator)
**Stack:** Next.js 14, Zustand, Web Audio API, Canvas API, Tailwind CSS
**Architecture:** Client-side first ($0 hosting), server fallback planned for P1
**Stage:** MVP Development (8-week timeline)
**User Level:** Developer (codes with AI assistance)

## Directives

1. **Master Plan:** ALWAYS read `AGENTS.md` first. It contains current phase, roadmap, and critical constraints.

2. **Documentation:** Load relevant `agent_docs/` files based on the task:
   - Implementation → `tech_stack.md`, `code_patterns.md`
   - Testing → `testing.md`
   - Architecture questions → `architecture.md`
   - Requirements clarification → `product_requirements.md`

3. **Plan-First Workflow:**
   - Propose a brief implementation plan
   - Explain architectural implications and trade-offs
   - Wait for approval before writing code
   - Ask clarifying questions if requirements are ambiguous

4. **Incremental Build:**
   - Build one small feature at a time
   - Follow existing patterns in codebase
   - Test after each change (unit → manual)
   - Commit when verification passes

5. **Type Safety (STRICT):**
   - NEVER use `any` type — use `unknown` with type guards
   - All exported functions must have explicit return types
   - Enable TypeScript strict mode

6. **Testing Discipline:**
   - Write tests BEFORE or WITH implementation (TDD preferred)
   - Run tests after every change: `pnpm test`
   - Fix failing tests immediately—do not proceed

7. **Pre-Commit Verification:**
   - Run: `pnpm lint && pnpm type-check && pnpm test`
   - Fix all errors before committing

8. **Communication Style:**
   - Be concise and solution-focused
   - Do NOT apologize for errors—fix them immediately
   - Ask ONE specific question if context is missing
   - Explain trade-offs when recommending approaches

## Critical Constraints (DO NOT VIOLATE)

### Client-Side First (CORE ARCHITECTURE)
- MVP is 100% client-side. No server dependencies.
- All audio processing happens in the browser
- Web Audio API for analysis, Canvas API for rendering
- MediaRecorder + captureStream for video export
- Web Speech API for transcription (post-recording)
- $0 hosting cost for MVP

### Timing (CRITICAL)
- Use `AudioContext.currentTime` as single source of truth
- NEVER use `Date.now()` for audio/video timing
- This prevents A/V drift in recordings

### Browser Compatibility
- Chrome 90+ and Edge 90+: Full support (primary targets)
- Firefox 90+: Full support (WebM only)
- Safari 15+: Partial (no video export — show clear messaging)
- iOS Safari: Preview only (server fallback in P1)

### Budget Constraint
- Client-side MVP: $0/month
- Vercel free tier for hosting
- No paid APIs in MVP

## Key Commands

### Development
```bash
pnpm install              # Install dependencies
pnpm dev                  # Start Next.js dev server
```

### Testing
```bash
pnpm test                 # Run unit tests
pnpm test:watch           # Watch mode
pnpm test:e2e             # Run E2E tests (Playwright)
pnpm test:coverage        # Generate coverage report
```

### Verification
```bash
pnpm lint                 # ESLint check
pnpm type-check           # TypeScript check
pnpm format               # Prettier format
pnpm build                # Build all packages
```

## What NOT To Do
- ❌ Delete files without confirmation
- ❌ Add server-side dependencies for MVP features
- ❌ Add features not in current phase roadmap
- ❌ Skip tests for "simple" changes
- ❌ Bypass failing pre-commit hooks
- ❌ Use `Date.now()` for audio timing
- ❌ Use `any` type
- ❌ Add authentication (not needed for MVP)

## Session Memory Pattern
After implementing a feature, update `AGENTS.md`:
```markdown
## Current State
**Last Updated:** [today's date]
**Working On:** [next task]
**Recently Completed:** [what you just finished]
**Blocked By:** [any blockers or "None"]
```

---

**Remember:** I'm a developer who codes alongside you. Explain your reasoning, propose solutions, and verify together. Let's build systematically!
