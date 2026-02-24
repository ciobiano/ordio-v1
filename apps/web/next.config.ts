import type { NextConfig } from "next";
import CopyPlugin from "copy-webpack-plugin";
import { createRequire } from "module";
import path from "path";

const require = createRequire(import.meta.url);

// Resolve actual paths inside the pnpm store
const vadWebDist = path.dirname(
  require.resolve("@ricky0123/vad-web/dist/vad.worklet.bundle.min.js")
);
const onnxDist = path.dirname(require.resolve("onnxruntime-web"));

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.resolve.fallback = { ...config.resolve.fallback, fs: false };

    config.plugins.push(
      new CopyPlugin({
        patterns: [
          {
            from: path.join(vadWebDist, "vad.worklet.bundle.min.js"),
            to: "../public/vad/[name][ext]",
          },
          {
            from: path.join(vadWebDist, "*.onnx"),
            to: "../public/vad/[name][ext]",
          },
          {
            from: path.join(onnxDist, "*.wasm"),
            to: "../public/vad/[name][ext]",
          },
          {
            from: path.join(onnxDist, "*.mjs"),
            to: "../public/vad/[name][ext]",
          },
        ],
      })
    );

    return config;
  },
};

export default nextConfig;
