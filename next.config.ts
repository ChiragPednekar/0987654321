import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

/**
 * Content-Security-Policy: which origins the browser may load anything from.
 *
 * The point is damage control if a script ever does get injected — it cannot
 * load more code from elsewhere, send what it reads to another host, or frame
 * the site. Every source below is something the app actually uses:
 *
 *   * Supabase (REST, auth, realtime websockets, signed photo URLs).
 *   * 'wasm-unsafe-eval': the camera checks compile MediaPipe's WebAssembly,
 *     served from /proctor on this origin.
 *   * img https:/data:/blob:: Google profile photos, and camera snapshots.
 *   * media blob:/mediastream:: the camera preview and group-discussion video.
 *
 * 'unsafe-inline' scripts remain, honestly stated: Next.js streams its
 * hydration data as inline scripts, and the nonce alternative forces every
 * page to render dynamically. External script sources are still refused,
 * which is what most injected payloads rely on.
 *
 * Production only. The dev server evaluates code for hot reload, which this
 * policy rightly forbids.
 */
const SUPABASE = "https://*.supabase.co";
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://checkout.razorpay.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${SUPABASE} wss://*.supabase.co https://lumberjack.razorpay.com https://api.razorpay.com`,
  "media-src 'self' blob: mediastream:",
  "worker-src 'self' blob:",
  "frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  `form-action 'self' ${SUPABASE}`,
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // No "X-Powered-By: Next.js": naming the framework helps nobody but a scanner.
  poweredByHeader: false,
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
          // HTTPS only, remembered for two years, so a first plain-HTTP
          // request cannot be intercepted before the redirect.
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
          // Camera and microphone for the proctoring and group discussions,
          // on this origin only; everything else a page could ask for, off.
          {
            key: "Permissions-Policy",
            value:
              "camera=(self), microphone=(self), fullscreen=(self), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), hid=(), magnetometer=(), gyroscope=(), accelerometer=(), browsing-topics=()",
          },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          ...(isProd ? [{ key: "Content-Security-Policy", value: CSP }] : []),
        ],
      },
    ];
  },
};

export default nextConfig;
