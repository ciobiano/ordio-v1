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
const ffmpegCoreDist = path.join(
  path.dirname(require.resolve('@ffmpeg/core-st/package.json')),
  'dist'
);

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Cross-origin isolation — required for SharedArrayBuffer, which
          // ffmpeg.wasm needs on the Safari export path.
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
            from: path.join(ffmpegCoreDist, 'ffmpeg-core.js'),
            to: '../public/ffmpeg/ffmpeg-core.js',
          },
          {
            from: path.join(ffmpegCoreDist, 'ffmpeg-core.wasm'),
            to: '../public/ffmpeg/ffmpeg-core.wasm',
          },
        ],
      })
    );

    return config;
  },
};

export default nextConfig;
