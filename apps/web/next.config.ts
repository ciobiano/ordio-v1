import type { NextConfig } from 'next';
import CopyPlugin from 'copy-webpack-plugin';
import { createRequire } from 'module';
import path from 'path';

const require = createRequire(import.meta.url);

// Resolve actual paths inside the pnpm store
const vadWebDist = path.dirname(
  require.resolve('@ricky0123/vad-web/dist/vad.worklet.bundle.min.js')
);
const onnxDist = path.dirname(require.resolve('onnxruntime-web'));
// The ffmpeg.wasm core has to be the build @ffmpeg/ffmpeg was made against
// (its CORE_VERSION), and the UMD one: webpack turns the wrapper's module
// worker into a classic worker, which can only importScripts() the core.
// `require` resolves to the UMD build.
const ffmpegCoreJs = require.resolve('@ffmpeg/core');
const ffmpegCoreWasm = require.resolve('@ffmpeg/core/wasm');

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Cross-origin isolation, which is what makes SharedArrayBuffer
          // available. ffmpeg.wasm no longer needs it (Ordio ships the
          // single-thread core); onnxruntime-web uses it to run VAD on
          // several threads.
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },

          // Clickjacking. The app has one-tap destructive and paid actions, so
          // it must never render inside someone else's frame.
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },

          // Stop the browser second-guessing our Content-Types.
          { key: 'X-Content-Type-Options', value: 'nosniff' },

          // Never leak a session URL (which carries a Convex session id) to a
          // third-party origin; same-origin still gets the full path.
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },

          // Mic is the one capability this app legitimately needs.
          {
            key: 'Permissions-Policy',
            value: 'camera=(), geolocation=(), interest-cohort=(), microphone=(self)',
          },

          // HSTS. Vercel serves https only, so there is no http origin to strand.
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },
  experimental: {
    optimizePackageImports: [
      'three',
      'framer-motion',
      '@react-three/fiber',
      '@hugeicons/core-free-icons',
    ],
  },
  webpack: (config) => {
    config.resolve.fallback = { ...config.resolve.fallback, fs: false };

    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      {
        message:
          /require function is used in a way in which dependencies cannot be statically extracted/,
      },
    ];

    config.plugins.push(
      new CopyPlugin({
        patterns: [
          {
            from: path.join(vadWebDist, 'vad.worklet.bundle.min.js'),
            to: '../public/vad/[name][ext]',
          },
          {
            from: path.join(vadWebDist, '*.onnx'),
            to: '../public/vad/[name][ext]',
          },
          {
            from: path.join(onnxDist, '*.wasm'),
            to: '../public/vad/[name][ext]',
          },
          {
            from: path.join(onnxDist, '*.mjs'),
            to: '../public/vad/[name][ext]',
          },
          {
            from: ffmpegCoreJs,
            to: '../public/ffmpeg/ffmpeg-core.js',
          },
          {
            from: ffmpegCoreWasm,
            to: '../public/ffmpeg/ffmpeg-core.wasm',
          },
        ],
      })
    );

    return config;
  },
};

export default nextConfig;
