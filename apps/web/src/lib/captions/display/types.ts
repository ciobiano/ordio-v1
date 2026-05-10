import type { Word } from '@Ordio/shared/schemas';

export interface CaptionDisplaySegment {
  startIndex: number;
  endIndex: number;
  start: number;
  end: number;
  text: string;
  words: Word[];
}

export type MeasureCaptionText = (text: string) => number;
