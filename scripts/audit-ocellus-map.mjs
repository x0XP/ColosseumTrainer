#!/usr/bin/env node
/**
 * Read the exact native map square used by Ocellus's final arena.
 * This is a build-time diagnostic, never a replacement for the game files.
 * The original RuneLite combat logs place the surviving P4 platform in
 * cache square 16472, plane 1, at local x=32+column, y=40-row.
 */
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { mkdir, writeFile } from "node:fs/promises";
import { loadConfig } from "osrs-sdk-assets";

const args = process.argv.slice(2);
const option = (flag) => {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
};
const cfg = await loadConfig({
  cwd: process.cwd(),
  cacheDir: option("--cache-dir"),
  readerPath: option("--reader-path"),
});
const module = await import(pathToFileURL(path.join(cfg.readerPath, "src/index.js")).href);
const { RSCache, IndexType, ConfigType } = module;
const cache = new RSCache(path.join(cfg.cacheDir, String(cfg.cacheId), "cache") + path.sep);
await cache.onload;
try {
  const rx = 64, ry = 88;
  const square = (rx << 8) | ry;
  // Some OpenRS2 snapshots do not include the named map archives even when
  // their NPC/object definitions are present. Audit this without blocking the
  // playable trainer: the build does not depend on these map files.
  const map = await cache.getMap(rx, ry).catch(() => null);
  const loc = await cache.getLoc(rx, ry).catch(() => null);
  if (!map?.tiles?.[1]) console.warn("Cache map m64_88 is unavailable; retaining validated reconstructed arena.");
  if (!Array.isArray(loc?.locations)) console.warn("Cache map l64_88 is unavailable; retaining reconstructed walkways.");
  const hash = (str) => {
    let result = 0;
    for (const char of str) result = (Math.imul(result, 31) + char.charCodeAt(0)) | 0;
    return result;
  };
  const archives = Object.values(cache.indicies[IndexType.MAPS.id]?.archives ?? {});
  const wanted = ["m64_88", "l64_88"].map((name) => ({
    name, hash: hash(name), matches: archives.filter((a) => a.nameHash === hash(name)).map((a) => a.id),
  }));
  const origin = { x: 32, y: 40 };
  const localTile = (x, y) => map?.tiles?.[1]?.[origin.x + x]?.[origin.y - y];
  const samples = [
    { label: "upper floor", x: 5, y: 1 },
    { label: "boss centre", x: 5, y: 5 },
    { label: "east wall", x: 11, y: 4 },
    { label: "diagonal wall", x: 10, y: 5 },
    { label: "walkway", x: 12, y: 4 },
  ].map(({ label, x, y }) => {
    const tile = localTile(x, y);
    return { label, x, y,
      underlay: tile?.underlayId ?? null,
      overlay: tile?.overlayId ?? null,
      shape: tile?.overlayPath ?? null,
      rotation: tile?.overlayRotation ?? null,
    };
  });
  const interesting = [4451, 7261, 62697, 62701];
  const placements = (loc?.locations ?? [])
    .filter((l) => l.position?.height === 1
      && interesting.includes(l.id)
      && l.position.localX >= origin.x && l.position.localX < origin.x + 14
      && l.position.localY <= origin.y && l.position.localY > origin.y - 13)
    .map((l) => ({
      id: l.id, type: l.type, orientation: l.orientation,
      x: l.position.localX - origin.x, y: origin.y - l.position.localY,
    }))
    .sort((a,b) => a.id-b.id || a.y-b.y || a.x-b.x);
  const definitions = [];
  for (const id of interesting) {
    const def = await cache.getDef(IndexType.CONFIGS.id, ConfigType.OBJECT.id, id);
    const modelFields = Object.fromEntries(Object.entries(def ?? {})
      .filter(([key]) => /model|size|offset|scale|ambient|contrast/i.test(key)));
    definitions.push({ id, modelFields });
  }
  // The P4 diagonal walls sit over overlay 656. The map-placement archives
  // are unavailable in this snapshot, but the overlay definition is still
  // in index 2. Inspect its native HSL colour and texture ID before changing
  // the hand-coloured raised curb.
  const overlayId = 656;
  const overlay = await cache.getDef(IndexType.CONFIGS.id, ConfigType.OVERLAY.id, overlayId);
  const curbOverlay = overlay ? {
    id: overlayId,
    packedHsl: overlay.color,
    texture: overlay.texture,
    hideUnderlay: overlay.hideUnderlay,
    secondaryRgb: overlay.secondaryColor,
  } : null;
  console.log("OCELLUS_CURB_OVERLAY " + JSON.stringify(curbOverlay));
  const diagnostic = {
    cache: cfg.cacheId, square, plane: 1, origin, mapAvailable: !!map?.tiles?.[1],
    locAvailable: Array.isArray(loc?.locations), archiveCount: archives.length, archiveLookup: wanted,
    samples, placements, definitions, curbOverlay,
  };
  await mkdir(cfg.outDir, { recursive: true });
  await writeFile(path.join(cfg.outDir, "ocellus-map-audit.json"), JSON.stringify(diagnostic, null, 2) + "\n");
  console.log("OCELLUS_MAP_AUDIT " + JSON.stringify(diagnostic));
} finally {
  cache.close();
}
