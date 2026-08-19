import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Emits a self-contained server bundle with only the needed node_modules,
  // which is what keeps the Cloud Run container small.
  output: "standalone",
  experimental: {
    // Keep server action payloads generous — case answers are long-form essays.
    serverActions: { bodySizeLimit: "2mb" },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
