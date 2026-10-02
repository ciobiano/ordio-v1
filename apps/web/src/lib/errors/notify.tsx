'use client';

import { toast } from 'sonner';
import type { ErrorCode } from './catalog';
import { isAbortError, toOrdioError } from './OrdioError';

interface NotifyOptions {
  /** Used when `err` carries no code of its own. */
  fallback?: ErrorCode;
  /** Replaces the catalog detail — for copy that names the file involved. */
  detail?: string;
  action?: { label: string; onClick: () => void };
}

/**
 * The reference line under every error toast. It names the failure exactly,
 * so a person reporting a problem can say which one they saw.
 */
export function ErrorReference({ code }: { code: ErrorCode }) {
  return <span className="mt-1 block font-mono ord-type-footnote opacity-60">Ref: {code}</span>;
}

/**
 * Tell the person about a failure, by name.
 *
 * Cancellations are not failures and are dropped here, so callers can pass
 * whatever they caught. The toast's id is the code: the same failure firing
 * twice — a retry loop, a double click — replaces itself instead of stacking.
 */
export function notifyError(err: unknown, options: NotifyOptions = {}): void {
  if (isAbortError(err)) return;
  const ordio = toOrdioError(err, options.fallback);
  const { title, detail, severity } = ordio.copy;

  console.error(`[${ordio.code}]`, err);

  const show = severity === 'warning' ? toast.warning : severity === 'info' ? toast.info : toast.error;
  show(title, {
    id: ordio.code,
    description: (
      <>
        {options.detail ?? detail}
        <ErrorReference code={ordio.code} />
      </>
    ),
    action: options.action,
  });
}
