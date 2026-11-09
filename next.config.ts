import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Phones and the venue TV reach the dev server through a cloudflared quick tunnel.
  allowedDevOrigins: ["*.trycloudflare.com"],
  cacheComponents: true,
  // kokoro-js reads its voice files from its own package folder, so it must not be bundled.
  serverExternalPackages: ["kokoro-js"],
  // Kokoro's voice files and onnxruntime's Linux shared libraries are loaded at runtime,
  // so file tracing misses them; the Vercel function bundle must carry them explicitly.
  outputFileTracingIncludes: {
    "/api/tts": [
      "./node_modules/kokoro-js/voices/**",
      "./node_modules/.pnpm/kokoro-js@*/node_modules/kokoro-js/voices/**",
      "./node_modules/.pnpm/onnxruntime-node@*/node_modules/onnxruntime-node/bin/napi-v3/linux/x64/**",
    ],
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
