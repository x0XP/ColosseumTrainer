#!/usr/bin/env node
/**
 * Extract the original OSRS cache 2746 starfield texture (ID 215).
 * It is referenced by the Ocellus floor-hole and transition models. Keep
 * it as an inspectable artifact before substituting it for the synthetic
 * void-floor texture; there is no claim yet that the UVs match the ground.
 */
import path from "node:path";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { loadConfig } from "osrs-sdk-assets";

const args = process.argv.slice(2);
const option = (key) => { const index = args.indexOf(key); return index < 0 ? undefined : args[index+1]; };
const cfg = await loadConfig({
  cwd: process.cwd(),
  config: arg("--config") ?? "osrs-assets.ocellus.config.ts",
  cacheDir: option("--cache-dir"),
  readerPath: option("--reader-path"),
});
if (cfg.cacheId !== 2746) throw new Error("Ocellus texture extraction requires game cache 2746, got " + cfg.cacheId);
const { RSCache, IndexType } = await import(pathToFileURL(path.join(cfg.readerPath, "src/index.js")).href);
const { createCanvas } = createRequire(path.join(cfg.readerPath, "package.json"))("canvas");
const cache = new RSCache(path.join(cfg.cacheDir, String(cfg.cacheId), "cache") + path.sep);
await cache.onload;
try {
  const definition = await cache.getDef(IndexType.TEXTURES.id, 0, 215, { loadSprites: true });
  const sprite = definition?.sprites?.[0]?.def?.sprites?.[0];
  if (!sprite?.width || !sprite?.height || !sprite?.pixels?.length)
    throw new Error("Native Ocellus starfield texture 215 not found in cache " + cfg.cacheId);
  if (sprite.width * sprite.height !== sprite.pixels.length)
    throw new Error("Texture 215 dimensions and pixel count disagree");
  const canvas = createCanvas(sprite.width, sprite.height);
  const context = canvas.getContext("2d");
  const rgba = context.createImageData(sprite.width, sprite.height);
  const alphaCount = { zero: 0, opaque: 0, other: 0 };
  const colours = new Set();
  const sample = [];
  sprite.pixels.forEach((raw, index) => {
    const value = raw >>> 0;
    const alpha = value >>> 24;
    if (alpha === 0) alphaCount.zero++;
    else if (alpha === 255) alphaCount.opaque++;
    else alphaCount.other++;
    colours.add(value);
    if (sample.length < 8 && index % Math.max(1, Math.floor(sprite.pixels.length / 8)) === 0)
      sample.push("0x" + value.toString(16).padStart(8, "0"));
    rgba.data.set([(value >>> 16) & 255, (value >>> 8) & 255, value & 255, alpha], index * 4);
  });
  context.putImageData(rgba, 0, 0);
  const filename = path.join(cfg.outDir, "textures", "215.png");
  await mkdir(path.dirname(filename), { recursive: true });
  await writeFile(filename, canvas.toBuffer("image/png"));
  console.log("OCELLUS_TEXTURE_215 " + JSON.stringify({
    cacheId: cfg.cacheId,
    size: [sprite.width, sprite.height],
    alphaCount, uniqueColours: colours.size, sample, file: filename,
  }));
} finally {
  cache.close();
}
