/**
 * Copies the MediaPipe WebAssembly runtime into /public so the camera checks
 * load it from this site rather than from a CDN.
 *
 * Same origin on purpose. An exam that depends on jsdelivr being reachable from
 * a college network fails in exactly the place nobody can debug it, and a CDN
 * copy can drift from the JS bundle's version — the loader and the binary must
 * match byte for byte. Copying from node_modules pins both to whatever
 * package-lock.json installed.
 *
 * Only the two variants the loader asks for in the main thread: SIMD, and the
 * non-SIMD fallback for older CPUs. The "module" pair is for ES-module workers,
 * which this does not use (see wasmLoaderPath in vision_bundle.mjs).
 *
 * The output is gitignored: ~25 MB of build artefact has no business in
 * history. The two .tflite models ARE committed, because nothing installs them.
 */
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "node_modules/@mediapipe/tasks-vision/wasm");
const to = join(root, "public/proctor/wasm");

const FILES = [
  "vision_wasm_internal.js",
  "vision_wasm_internal.wasm",
  "vision_wasm_nosimd_internal.js",
  "vision_wasm_nosimd_internal.wasm",
];

mkdirSync(to, { recursive: true });
for (const file of FILES) {
  const src = join(from, file);
  if (!existsSync(src)) {
    // Loud, because a build that silently ships without these ships a camera
    // that turns on and analyses nothing.
    console.error(`[proctor-wasm] missing ${src} — is @mediapipe/tasks-vision installed?`);
    process.exit(1);
  }
  copyFileSync(src, join(to, file));
}
console.log(`[proctor-wasm] copied ${FILES.length} files to public/proctor/wasm`);
