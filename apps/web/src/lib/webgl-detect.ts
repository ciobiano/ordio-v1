/**
 * Returns true if WebGL is available in this environment.
 * Cached after the first call since availability never changes mid-session.
 */
let _cache: boolean | null = null;

export function isWebGLAvailable(): boolean {
  if (_cache !== null) return _cache;

  try {
    const canvas = document.createElement('canvas');
    const ctx =
      canvas.getContext('webgl2') ??
      canvas.getContext('webgl') ??
      canvas.getContext('experimental-webgl');
    _cache = !!ctx;
    // Lose the context immediately to free GPU resources
    if (ctx && 'getExtension' in ctx) {
      (ctx as WebGLRenderingContext)
        .getExtension('WEBGL_lose_context')
        ?.loseContext();
    }
  } catch {
    _cache = false;
  }

  return _cache;
}
