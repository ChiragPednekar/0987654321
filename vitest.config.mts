import { defineConfig } from "vitest/config";
// `import.meta.dirname` avoids the CJS `__dirname` shim Vite now warns about.

export default defineConfig({
  test: {
    environment: "node",
    // Authorization tests hit the live project over the network, so the
    // default 5s timeout is far too tight.
    testTimeout: 120_000,
    hookTimeout: 120_000,
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
      // `server-only` throws on import unless the loader is running under the
      // react-server condition — which is why `npm run verify:ai` passes
      // --conditions=react-server. Vitest has no such flag, so it is pointed at
      // the same empty module the condition would have selected. Without this,
      // anything reachable from a route handler is untestable, which is most of
      // the code worth testing.
      "server-only": new URL(
        "./node_modules/server-only/empty.js",
        import.meta.url,
      ).pathname,
    },
  },
});
