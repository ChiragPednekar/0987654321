import { defineConfig } from "vitest/config";
import path from "node:path";

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
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
