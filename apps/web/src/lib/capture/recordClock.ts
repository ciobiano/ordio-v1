/**
 * The record screen's clock: `MM:SS` large, hundredths small beside it.
 *
 * Minutes are not capped at 59 — a 72-minute take reads 72:04, which is what a
 * voice memo app shows, rather than rolling into an hours field nobody reads.
 */
export interface RecordClock {
  main: string;
  hundredths: string;
  /** For assistive tech: "1 minute 4 seconds". */
  spoken: string;
}

export function formatRecordClock(elapsedMs: number): RecordClock {
  const safe = Math.max(0, Math.floor(elapsedMs));
  const totalSeconds = Math.floor(safe / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const hundredths = Math.floor((safe % 1000) / 10);

  const spokenParts = [
    minutes > 0 ? `${minutes} minute${minutes === 1 ? '' : 's'}` : '',
    `${seconds} second${seconds === 1 ? '' : 's'}`,
  ].filter(Boolean);

  return {
    main: `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
    hundredths: String(hundredths).padStart(2, '0'),
    spoken: spokenParts.join(' '),
  };
}
