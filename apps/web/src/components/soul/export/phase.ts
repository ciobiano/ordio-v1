// apps/web/src/components/soul/export/phase.ts
import type { DeriveExportPhaseInput, ExportPhase } from './types';

/**
 * Pure, total derivation of the dock's visual phase. Check isExporting first so an
 * in-flight export always wins over a stale error or a stale exportedUrl left over
 * from a previous attempt; check error next so a failed export falls back to preview
 * (the state-exit rule) rather than getting stuck showing a stale success state.
 */
export function deriveExportPhase(input: DeriveExportPhaseInput): ExportPhase {
  const { isExporting, exportedUrl, error } = input;

  if (isExporting) return 'exporting';
  if (error) return 'preview';
  if (exportedUrl) return 'done';
  return 'preview';
}
