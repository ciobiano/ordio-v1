'use client';

import { useState, useEffect } from 'react';

export default function RecordingTimer() {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  return (
    <span
      className="text-[length:var(--text-display)] font-extralight tabular-nums tracking-tight"
      role="timer"
      aria-label="Recording duration"
    >
      {mins.toString().padStart(2, '0')}:{secs.toString().padStart(2, '0')}
    </span>
  );
}
