import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Phones and the venue TV reach the dev server through a cloudflared quick tunnel.
  allowedDevOrigins: ["*.trycloudflare.com"],
  cacheComponents: true,
  // kokoro-js reads its voice files from its own package folder, so it must not be bundled.
  serverExternalPackages: ["kokoro-js"],
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
