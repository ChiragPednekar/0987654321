import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Emits a self-contained server bundle with only the needed node_modules,
  // which is what keeps the Cloud Run container small.
  output: "standalone",
  /**
   * sql.js is a UMD bundle that assigns to `module.exports` in a way the
   * bundler's ESM interop breaks — it loads as undefined and throws "cannot
   * set properties of undefined" on first use. Keeping it external means Node
   * requires it directly at runtime, which is the shape it was built for.
   */
  serverExternalPackages: ["sql.js"],

  /**
   * sql.js ships its engine as a .wasm that the tracer cannot see, because it
   * is read by a path built at runtime rather than imported. Without this the
   * SQL routes work locally and throw ENOENT the moment they are deployed.
   */
  outputFileTracingIncludes: {
    "/api/sql/**": ["./node_modules/sql.js/dist/sql-wasm.wasm"],
  },
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
