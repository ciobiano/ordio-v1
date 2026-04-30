type DebugIngestPayload = {
  location: string;
  message: string;
  data?: Record<string, unknown>;
  hypothesisId: string;
};

const DEBUG_ENDPOINT = 'http://127.0.0.1:7303/ingest/ea0527ef-c382-4800-867c-062d25f2a635';
const DEBUG_SESSION_ID = '381f43';
const DEBUG_RUN_ID = 'post-fix';

export function sendProcessingDebugIngest(payload: DebugIngestPayload) {
  fetch(DEBUG_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': DEBUG_SESSION_ID },
    body: JSON.stringify({
      sessionId: DEBUG_SESSION_ID,
      runId: DEBUG_RUN_ID,
      location: payload.location,
      message: payload.message,
      data: payload.data,
      timestamp: Date.now(),
      hypothesisId: payload.hypothesisId,
    }),
  }).catch(() => {});
}

