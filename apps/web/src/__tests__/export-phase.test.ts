// apps/web/src/__tests__/export-phase.test.ts
import { describe, it, expect } from 'vitest';
import { deriveExportPhase } from '@/components/soul/export/phase';

describe('deriveExportPhase', () => {
  it('is preview when nothing has started', () => {
    expect(deriveExportPhase({ isExporting: false, exportedUrl: null, error: null })).toBe('preview');
  });

  it('is exporting while isExporting is true, even if a stale exportedUrl exists', () => {
    expect(deriveExportPhase({ isExporting: true, exportedUrl: 'blob:old', error: null })).toBe('exporting');
  });

  it('is done once exportedUrl is set and export has finished', () => {
    expect(deriveExportPhase({ isExporting: false, exportedUrl: 'blob:new', error: null })).toBe('done');
  });

  it('falls back to preview on error, even if a stale exportedUrl exists', () => {
    expect(deriveExportPhase({ isExporting: false, exportedUrl: 'blob:old', error: 'boom' })).toBe('preview');
  });

  it('prioritizes isExporting over a simultaneous error from a previous attempt', () => {
    expect(deriveExportPhase({ isExporting: true, exportedUrl: null, error: 'stale error' })).toBe('exporting');
  });
});
