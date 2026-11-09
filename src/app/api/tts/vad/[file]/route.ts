import fs from "node:fs/promises";
import path from "node:path";

// GET /api/tts/vad/<file> : the Silero VAD model, worklet and onnxruntime wasm, served from
// node_modules so the phone never waits on a CDN (venue wifi is slow) and no 15 MB binary lives in git.

function vadDir() {
  return fs.realpath(path.join(process.cwd(), "node_modules", "@ricky0123", "vad-web", "dist"));
}

async function ortDir() {
  // pnpm keeps onnxruntime-web next to vad-web inside the store.
  const vad = await fs.realpath(path.join(process.cwd(), "node_modules", "@ricky0123", "vad-web"));
  return path.join(vad, "..", "..", "onnxruntime-web", "dist");
}

const FILES: Record<string, { dir: () => Promise<string>; type: string }> = {
  "silero_vad_v5.onnx": { dir: vadDir, type: "application/octet-stream" },
  "silero_vad_legacy.onnx": { dir: vadDir, type: "application/octet-stream" },
  "vad.worklet.bundle.min.js": { dir: vadDir, type: "text/javascript" },
  "ort-wasm-simd-threaded.wasm": { dir: ortDir, type: "application/wasm" },
  "ort-wasm-simd-threaded.mjs": { dir: ortDir, type: "text/javascript" },
  "ort-wasm-simd-threaded.jsep.wasm": { dir: ortDir, type: "application/wasm" },
  "ort-wasm-simd-threaded.jsep.mjs": { dir: ortDir, type: "text/javascript" },
};

export async function GET(_request: Request, ctx: RouteContext<"/api/tts/vad/[file]">) {
  const { file } = await ctx.params;
  const entry = FILES[file];
  if (!entry) return new Response("not found", { status: 404 });
  try {
    const data = await fs.readFile(path.join(await entry.dir(), file));
    return new Response(new Uint8Array(data), {
      headers: { "content-type": entry.type, "cache-control": "public, max-age=86400" },
    });
  } catch {
    return new Response("not found", { status: 404 });
  }
}
