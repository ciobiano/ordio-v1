// apps/web/src/components/soul/export/types.ts

/** The three visual phases the Export screen's dock morphs through. */
export type ExportPhase = 'preview' | 'exporting' | 'done';

export interface DeriveExportPhaseInput {
  isExporting: boolean;
  exportedUrl: string | null;
  error: string | null;
}
