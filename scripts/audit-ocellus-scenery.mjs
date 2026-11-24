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
const native = JSON.parse(await readFile("artifacts/ocellus-scenery/native-region-16472.json", "utf8"));
if (native.cache !== 2746 || native.square !== 16472 || native.plane !== 1) throw new Error("Wrong original region");
// These are static-map placements, not guessed models from the nearby ID range.
const fixtures = [{id:62894, model:62357, type:22, orientation:3, animation:null}, {id:62895, model:62739, type:10, orientation:1, animation:10772}];
for (const fixture of fixtures) {
  const loc = native.areaLocations.find(l=>l.id===fixture.id && l.x===8 && l.y===8 && l.type===fixture.type && l.orientation===fixture.orientation);
  const def = native.objectDefs.find(d=>d.id===fixture.id);
  if (!loc || !def || def.models[def.types.indexOf(fixture.type)]!==fixture.model || def.animation!==fixture.animation || def.offsetHeight!==-64 || def.offsetX!==0 || def.offsetY!==0 || def.modelSizeX!==128 || def.modelSizeY!==128 || def.modelSizeHeight!==128) throw new Error("Native censer fixture metadata mismatch: " + fixture.id);
}
console.log("OCELLUS_NATIVE_CENSER_FIXTURES " + JSON.stringify(fixtures));
const candidates = new Map();
for (const loc of [...report.sceneryCandidates.filter(loc => loc.id <= 62738), ...native.objectDefs.filter(def=>Array.isArray(def.models))]) {
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
  for (const id of [62440, 62357, 62739]) if (!success.some(r=>r.id===id)) throw new Error("Native censer model preview missing: " + id);
  const placed = records.filter(r=>[62440,62357,62739,62740].includes(r.id));
  await writeFile(path.join(dir,"native-censer-fixtures.svg"),makeSheet(placed,cfg.cacheId));
} finally { cache.close(); }
