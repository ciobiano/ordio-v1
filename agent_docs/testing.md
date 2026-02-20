# Testing Strategy & Verification

## Testing Philosophy
- **Test browser API integrations** through custom hooks
- **Test canvas utilities** with unit tests
- **Test user flows** with E2E tests
- **Pre-commit hooks enforce test passing**
- **No commits with failing tests**

## Test Types

### 1. Unit Tests (Vitest)
**Location:** Co-located with source files (`*.test.ts`)

**Focus Areas:**
- `lib/canvas.ts` — bar layout, caption rendering math
- `lib/audio.ts` — audio processing utilities
- `lib/transcription.ts` — Web Speech API wrapper logic
- `lib/export.ts` — MediaRecorder utilities

**Example:**
```typescript
// lib/canvas.test.ts
import { describe, it, expect } from 'vitest';
import { precomputeBarLayout } from './canvas';

describe('precomputeBarLayout', () => {
  it('generates correct number of bars', () => {
    const layout = precomputeBarLayout(1000, 48);
    expect(layout).toHaveLength(48);
  });

  it('bars do not overlap', () => {
    const layout = precomputeBarLayout(1000, 48);
    for (let i = 1; i < layout.length; i++) {
      expect(layout[i].x).toBeGreaterThan(
        layout[i - 1].x + layout[i - 1].barWidth
      );
    }
  });
});
```

### 2. Hook Tests (Vitest + Testing Library)
**Focus:**
- `useAudioRecorder` — recording state machine
- `useVideoExporter` — export flow
- `useCapabilities` — browser detection

### 3. E2E Tests (Playwright)
**Location:** `tests/e2e/`

**Core Scenarios:**
- Record audio → preview waveform → export → download
- Upload file → transcription → edit caption → export
- Theme toggle persists across reload
- Mobile viewport testing (375px width)

**Example:**
```typescript
// tests/e2e/record-export.spec.ts
import { test, expect } from '@playwright/test';

test('full record to export flow', async ({ page }) => {
  await page.goto('/');

  // Grant microphone permission
  await page.context().grantPermissions(['microphone']);

  // Start recording
  await page.click('[data-testid="record-button"]');
  await page.waitForTimeout(3000);

  // Stop recording
  await page.click('[data-testid="stop-button"]');

  // Wait for transcription
  await expect(page.locator('[data-testid="transcript"]')).toBeVisible();

  // Export
  await page.click('[data-testid="export-button"]');

  // Wait for download
  const download = await page.waitForEvent('download');
  expect(download.suggestedFilename()).toMatch(/\.webm$/);
});
```

### 4. Cross-Browser Testing

| Browser | Test Level | Notes |
|---------|-----------|-------|
| Chrome 90+ | Full E2E | Primary target |
| Edge 90+ | Full E2E | Same engine as Chrome |
| Firefox 90+ | Full E2E | WebM only |
| Safari 15+ | Manual | No video export — verify graceful messaging |
| iOS Safari | Manual | Verify recording + preview work, export blocked gracefully |

## Pre-Commit Hooks (Husky + Lint-Staged)

```json
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write",
      "vitest related --run"
    ],
    "*.{json,md}": ["prettier --write"]
  }
}
```

## Verification Commands

### Local Development
```bash
pnpm test              # Run all unit tests
pnpm test:watch        # Run tests in watch mode
pnpm test:coverage     # Generate coverage report
pnpm test:e2e          # Run E2E tests (requires dev server)
```

### CI Pipeline (GitHub Actions)
```bash
- pnpm install
- pnpm lint
- pnpm type-check
- pnpm test
- pnpm test:e2e
- pnpm build
```

## Manual Verification Checklist

After each feature implementation:
- [ ] All automated tests passing
- [ ] Manual test on Chrome (desktop)
- [ ] Manual test on Chrome Android (mid-range device)
- [ ] Manual test on iOS Safari (verify graceful degradation)
- [ ] Theme toggle works correctly
- [ ] No console errors or warnings

## Verification Loop (MANDATORY)
After implementing ANY feature:
1. **Run tests:** `pnpm test` (fix failures immediately)
2. **Type check:** `pnpm type-check` (fix errors immediately)
3. **Lint:** `pnpm lint` (fix warnings immediately)
4. **Manual test:** Test the feature in browser
5. **Commit:** Only when all checks pass
