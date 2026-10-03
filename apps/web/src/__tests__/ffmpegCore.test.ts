import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// Resolve the way next.config.ts does, from apps/web.
const require = createRequire(import.meta.url);

/** The core version the installed @ffmpeg/ffmpeg worker was built against. */
function wrapperCoreVersion(): string {
  // Under the node condition the wrapper resolves into dist/esm/, beside const.js.
  const constJs = path.join(path.dirname(require.resolve('@ffmpeg/ffmpeg')), 'const.js');
  const match = readFileSync(constJs, 'utf8').match(/CORE_VERSION = "([^"]+)"/);
  if (!match) throw new Error(`No CORE_VERSION in ${constJs}`);
  return match[1];
}

function installedCoreVersion(): string {
  const coreJs = require.resolve('@ffmpeg/core'); // <pkg>/dist/umd/ffmpeg-core.js
  const pkg = JSON.parse(readFileSync(path.join(path.dirname(coreJs), '../../package.json'), 'utf8'));
  return pkg.version;
}

/*
 * Ordio shipped @ffmpeg/ffmpeg 0.12 with a 0.11 core, so ffmpeg.wasm could
 * never load. These pin the pair next.config.ts copies into public/ffmpeg.
 */
describe('ffmpeg.wasm core', () => {
  it('is the version the @ffmpeg/ffmpeg wrapper expects', () => {
    expect(installedCoreVersion()).toBe(wrapperCoreVersion());
  });

  it('resolves to the UMD build, the only one a classic worker can importScripts()', () => {
    expect(require.resolve('@ffmpeg/core')).toMatch(/\/dist\/umd\/ffmpeg-core\.js$/);
    expect(require.resolve('@ffmpeg/core/wasm')).toMatch(/\/dist\/umd\/ffmpeg-core\.wasm$/);
  });
});
