import { ERROR_CATALOG, type ErrorCode, type ErrorCopy } from './catalog';

/**
 * A failure Ordio knows the name of.
 *
 * `message` is for logs and may carry detail the person should not see (a
 * status, a provider's wording). What goes on screen always comes from the
 * catalog by `code`, so a new message never needs a new string match.
 */
export class OrdioError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, options: { message?: string; cause?: unknown } = {}) {
    super(options.message ?? ERROR_CATALOG[code].title, { cause: options.cause });
    this.name = 'OrdioError';
    this.code = code;
  }

  get copy(): ErrorCopy {
    return ERROR_CATALOG[this.code];
  }
}

export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

/**
 * Whatever was thrown, as an `OrdioError`.
 *
 * Walks the `cause` chain first, so a named failure wrapped by an outer layer
 * (the processing pipeline wraps everything it touches) keeps its name instead
 * of collapsing into the wrapper's generic one. A failed `fetch` — the browser
 * reports those as a bare `TypeError` — becomes a connection error rather than
 * `fallback`, because "check your connection" is the one advice that helps.
 */
export function toOrdioError(err: unknown, fallback: ErrorCode = 'UNKNOWN'): OrdioError {
  const named = findOrdioError(err);
  if (named) return named;
  if (isNetworkFailure(err)) {
    return new OrdioError(isOffline() ? 'NETWORK_OFFLINE' : 'NETWORK_FAILED', { cause: err });
  }
  const message = err instanceof Error ? err.message : undefined;
  return new OrdioError(fallback, { message, cause: err });
}

function findOrdioError(err: unknown): OrdioError | null {
  let current: unknown = err;
  for (let depth = 0; depth < 5 && current; depth++) {
    if (current instanceof OrdioError) return current;
    current = current instanceof Error ? current.cause : undefined;
  }
  return null;
}

/** `fetch` rejects with a TypeError, and only a TypeError, when the request never landed. */
export function isNetworkFailure(err: unknown): boolean {
  return err instanceof TypeError && /fetch|network|load failed/i.test(err.message);
}

function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}
