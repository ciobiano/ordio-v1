'use client';

interface CaptureCaptionsProps {
  committedLines: string[];
  interimText: string;
}

/**
 * Live caption strip shown above the dock while recording. Committed lines
 * are solid; the in-progress utterance renders muted+italic until its final
 * text arrives. Disposable UI — the exported video's captions come from the
 * post-recording Whisper pass, not from here.
 */
export function CaptureCaptions({ committedLines, interimText }: CaptureCaptionsProps) {
  // Only the tail is useful while talking; older lines would crowd the stage.
  const recentLines = committedLines.slice(-2);
  const interim = interimText.trim();

  if (recentLines.length === 0 && !interim) return null;

  return (
    <div
      className="absolute left-5 right-5 bottom-28 z-10 flex flex-col items-center gap-1 text-center pointer-events-none"
      aria-live="polite"
    >
      {recentLines.map((line, i) => (
        <p key={`${committedLines.length - recentLines.length + i}`} className="text-base leading-snug text-white/85">
          {line}
        </p>
      ))}
      {interim && <p className="text-base leading-snug text-white/45 italic">{interim}</p>}
    </div>
  );
}
