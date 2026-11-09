// Copies the Silero VAD model, worklet and onnxruntime wasm into public/vad so they are
// served as static files. The wasm is ~15 MB, over the Vercel function response limit,
// so a route handler cannot serve it there. Runs before `next dev` and `next build`.
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const vad = fs.realpathSync(path.join(root, "node_modules", "@ricky0123", "vad-web"));
const vadDist = path.join(vad, "dist");
// pnpm keeps onnxruntime-web next to vad-web inside the store.
const ortDist = path.join(vad, "..", "..", "onnxruntime-web", "dist");
const out = path.join(root, "public", "vad");
fs.mkdirSync(out, { recursive: true });

const files = [
  [vadDist, "silero_vad_v5.onnx"],
  [vadDist, "silero_vad_legacy.onnx"],
  [vadDist, "vad.worklet.bundle.min.js"],
  [ortDist, "ort-wasm-simd-threaded.wasm"],
  [ortDist, "ort-wasm-simd-threaded.mjs"],
  [ortDist, "ort-wasm-simd-threaded.jsep.wasm"],
  [ortDist, "ort-wasm-simd-threaded.jsep.mjs"],
];
for (const [dir, name] of files) fs.copyFileSync(path.join(dir, name), path.join(out, name));
console.log(`[copy-vad] ${files.length} files -> public/vad`);
