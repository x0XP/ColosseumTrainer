#!/usr/bin/env node
/** Native cache scenery model sheet for identifying the missing censer base.
 * No candidate is placed in the live arena without independent visual evidence.
 * Uses raw model geometry, not object transforms, textures or in-game lighting.
 */
import path from "node:path";
import { pathToFileURL } from "node:url";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { loadConfig } from "osrs-sdk-assets";
import { geometryOf, makeSheet } from "./ocellus-scenery-preview.mjs";
const args = process.argv.slice(2);
const option = (flag) => { const i = args.indexOf(flag); return i < 0 ? undefined : args[i + 1]; };
const cfg = await loadConfig({config: option("--config") ?? "osrs-assets.ocellus.config.ts", cacheDir: option("--cache-dir"), readerPath: option("--reader-path")});
if (cfg.cacheId !== 2746) throw new Error("Scenery audit requires cache 2746");
const report = JSON.parse(await readFile(path.join(cfg.outDir, "ocellus-map-audit.json"), "utf8"));
if (report.cache !== cfg.cacheId) throw new Error("Scenery audit cache mismatch");
const candidates = new Map();
for (const loc of report.sceneryCandidates.filter(loc => loc.id <= 62738)) {
  for (const id of loc.models) {
    if (!Number.isInteger(id) || id < 0) continue;
    const record = candidates.get(id) ?? {id, locs: [], names: []};
    record.locs.push(loc.id);
    if (loc.name && !record.names.includes(loc.name)) record.names.push(loc.name);
    candidates.set(id, record);
  }
}
const { RSCache, IndexType } = await import(pathToFileURL(path.join(cfg.readerPath, "src/index.js")).href);
const cache = new RSCache(path.join(cfg.cacheDir, String(cfg.cacheId), "cache") + path.sep);
await cache.onload;
try {
  const records = [];
  for (const entry of [...candidates.values()].sort((a,b)=>a.id-b.id)) {
    const r = {...entry,label:entry.names.join(" / ").slice(0,29) || "unnamed"};
    try { r.geometry = geometryOf(await cache.getDef(IndexType.MODELS.id, entry.id)); }
    catch (error) { r.error = String(error); }
    records.push(r);
  }
  const success = records.filter(r=>r.geometry);
  const failed = records.filter(r=>!r.geometry);
  const dir = "artifacts/ocellus-scenery";
  await mkdir(dir, {recursive:true});
  // Small individual sheets are easier to review than one tall image.
  for (let i=0;i<records.length;i+=24) {
    await writeFile(path.join(dir,"models-"+String(i/24+1).padStart(2,"0")+".svg"),makeSheet(records.slice(i,i+24),cfg.cacheId));
  }
  const summary=records.map(({geometry,...record})=>({...record,bounds:geometry?.bounds,vertices:geometry?.vertices.length,faces:geometry?.triangles.length}));
  await writeFile(path.join(dir,"models.json"),JSON.stringify({cache:cfg.cacheId,models:summary},null,2)+"\n");
  console.log("OCELLUS_SCENERY_PREVIEWS "+JSON.stringify({models:records.length,decoded:success.length,failed:failed.map(r=>r.id)}));
  if (!success.some(r=>r.id===62440) || !success.some(r=>r.id===55960)) throw new Error("Known censer/fire control model preview missing");
} finally { cache.close(); }
