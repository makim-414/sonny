import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Phones and the venue TV reach the dev server through a cloudflared quick tunnel.
  allowedDevOrigins: ["*.trycloudflare.com"],
  cacheComponents: true,
  // kokoro-js reads its voice files from its own package folder, so it must not be bundled.
  serverExternalPackages: ["kokoro-js"],
  // Its voice files are read at runtime, so the Vercel function bundle must carry them.
  outputFileTracingIncludes: {
    "/api/tts": ["./node_modules/kokoro-js/voices/**"],
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
