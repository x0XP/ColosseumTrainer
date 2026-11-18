#!/usr/bin/env node
// Extract only Ocellus's actual curse sprites from OpenRS2 cache 2746.
// Archive 440 is headicons_prayer: 11 Soul Split, 15 Deflect Melee,
// 16 Deflect Range. The SDK manifest builder does not extract sprites.
import path from "node:path";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { loadConfig } from "osrs-sdk-assets";

const args = process.argv.slice(2);
const option = (name) => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
};
const config = await loadConfig({
  cwd: process.cwd(),
  cacheDir: option("--cache-dir"),
  readerPath: option("--reader-path"),
});
const { RSCache } = await import(pathToFileURL(path.join(config.readerPath, "src/index.js")).href);
const { createCanvas } = createRequire(path.join(config.readerPath, "package.json"))("canvas");
const cache = new RSCache(path.join(config.cacheDir, String(config.cacheId), "cache") + path.sep);
await cache.onload;
try {
  const definition = await cache.getDef(8, 440);
  for (const frameNumber of [11, 15, 16]) {
    const frame = definition?.sprites?.[frameNumber];
    if (!frame?.width || !frame?.height) {
      throw new Error(`Missing Ocellus head icon 440:${frameNumber} in cache ${config.cacheId}`);
    }
    const canvas = createCanvas(frame.width, frame.height);
    const context = canvas.getContext("2d");
    const image = context.createImageData(frame.width, frame.height);
    const noAlpha = frame.pixels.every((pixel) => (pixel >>> 24) === 0);
    frame.pixels.forEach((pixel, i) => {
      const alpha = noAlpha ? (frame.pixelIdx[i] === 0 ? 0 : 255) : ((pixel >>> 24) & 255);
      image.data.set([(pixel >>> 16) & 255, (pixel >>> 8) & 255, pixel & 255, alpha], i * 4);
    });
    context.putImageData(image, 0, 0);
    const file = path.join(config.outDir, "sprites", `440-${frameNumber}.png`);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, canvas.toBuffer("image/png"));
    console.log(`Extracted Ocellus overhead: 440-${frameNumber}.png`);
  }
} finally {
  cache.close();
}
