#!/usr/bin/env node
/**
 * Read the exact native map square used by Ocellus's final arena.
 * This is a build-time diagnostic, never a replacement for the game files.
 * The original RuneLite combat logs place the surviving P4 platform in
 * cache square 16472, plane 1, at local x=32+column, y=40-row.
 */
import path from "node:path";
import { pathToFileURL } from "node:url";
import { mkdir, writeFile } from "node:fs/promises";
import { loadConfig } from "osrs-sdk-assets";
import { backdropPlacements, backdropFaces } from "./ocellus-backdrop.mjs";
import { readNativeRegion } from "./ocellus-native-region.mjs";

const args = process.argv.slice(2);
const option = (flag) => {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
};
const cfg = await loadConfig({
  cwd: process.cwd(),
  config: option("--config") ?? "osrs-assets.ocellus.config.ts",
  cacheDir: option("--cache-dir"),
  readerPath: option("--reader-path"),
});
if (cfg.cacheId !== 2746) throw new Error("Ocellus map audit requires game cache 2746, got " + cfg.cacheId);
const module = await import(pathToFileURL(path.join(cfg.readerPath, "src/index.js")).href);
const { RSCache, IndexType, ConfigType } = module;
const cache = new RSCache(path.join(cfg.cacheDir, String(cfg.cacheId), "cache") + path.sep);
await cache.onload;
try {
  const rx = 64, ry = 88;
  const square = (rx << 8) | ry;
  const index = cache.indicies[IndexType.MAPS.id];
  const { default: MapLoader } = await import(pathToFileURL(path.join(cfg.readerPath, "src/cacheReader/loaders/MapLoader.js")).href);
  const decoded = await readNativeRegion(cache, index, square, MapLoader).catch(error => ({format:"unavailable",files:[],map:null,loc:null,error:String(error)}));
  const {map, loc} = decoded;
  console.log("OCELLUS_REGION_FORMAT " + JSON.stringify({named:index.named, square, directGroup:!!index.archives[square],format:decoded.format,files:decoded.files,error:decoded.error,locations:loc?.locations?.length ?? null}));
  if (!map?.tiles?.[1] || !Array.isArray(loc?.locations)) console.warn("Native region decode unavailable; retaining reconstructed arena.",decoded.error);
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
  // Inspect the native overlay definition as well as its decoded placements.
  // Do not assume its secondary RGB equals the scene's lit surface colour.
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

  // Source-accurate censer supports are not included in the reconstructed
  // platform. Search nearby cache object definitions for the actual model;
  // do not fabricate another geometric bowl or change gameplay scenery here.
  const sceneryCandidates = [];
  for (let id = 62640; id <= 62780; id++) {
    const def = await cache.getDef(IndexType.CONFIGS.id, ConfigType.OBJECT.id, id).catch(() => null);
    if (!def) continue;
    const models = def.objectModels ?? def.objectModelsAndTypes ?? [];
    if (!models.length) continue;
    sceneryCandidates.push({
      id, name: def.name || null, models,
      animation: def.animationID >= 0 ? def.animationID : null,
    });
  }
  console.log("OCELLUS_SCENERY_AUDIT " + JSON.stringify(sceneryCandidates));
  const diagnostic = {
    cache: cfg.cacheId, square, plane: 1, origin, mapAvailable: !!map?.tiles?.[1],
    locAvailable: Array.isArray(loc?.locations), archiveCount: archives.length, archiveLookup: wanted,
    regionFormat: decoded.format, regionFiles: decoded.files, decodeError: decoded.error ?? null,
    samples, placements, definitions, curbOverlay, sceneryCandidates,
  };
  await mkdir(cfg.outDir, { recursive: true });
  await writeFile(path.join(cfg.outDir, "ocellus-map-audit.json"), JSON.stringify(diagnostic, null, 2) + "\n");
  console.log("OCELLUS_MAP_AUDIT " + JSON.stringify(diagnostic));
  if (map?.tiles?.[1] && Array.isArray(loc?.locations)) {
    // Preserve the actual source tiles, heights, and all object placements
    // (not just our earlier candidate IDs) for independent scene validation.
    const plane = 1;
    const heights = map.getHeights();
    const backdrop={cache:cfg.cacheId,square,plane,models:[],positions:[],vertexColors:[]};
    // The outer edge of the north wall lands exactly on the next map square.
    const north=await readNativeRegion(cache,index,square+1,MapLoader);
    const northHeights=north.map.getHeights();
    const wallHeights=heights.map((grid,p)=>grid.map((column,x)=>[...column,northHeights[p][x][0]]));
    for(const object of backdropPlacements(loc.locations,origin)){
      const def=await cache.getDef(IndexType.CONFIGS.id, ConfigType.OBJECT.id, object.id);
      if(def.objectModels?.[0]!==object.model||def.animationID>=0||
        [def.modelSizeX,def.modelSizeY,def.modelSizeHeight].some(size=>size!==128))
        throw Error("Ocellus rear scenery placement changed: "+object.id);
      const model=await cache.getDef(IndexType.MODELS.id,object.model);
      const mesh=backdropFaces(model,object,def,wallHeights[object.plane],heights[plane][origin.x][origin.y]);
      if(!mesh.positions.length||!mesh.positions.every(Number.isFinite))throw Error("Invalid rear scenery "+object.model);
      if(!backdrop.models.includes(object.model))backdrop.models.push(object.model);
      backdrop.positions.push(...mesh.positions);
      backdrop.vertexColors.push(...mesh.vertexColors);
    }
    await writeFile(path.join(cfg.outDir,"ocellus-native-backdrop.json"),JSON.stringify(backdrop));
    const area = [];
    for (let y = -2; y < 15; y++) for (let x = -2; x < 16; x++) {
      const lx = origin.x + x, ly = origin.y - y;
      area.push({x,y,localX:lx,localY:ly,...map.tiles[plane][lx][ly],heightUnits:heights[plane][lx][ly]});
    }
    const areaLocations = loc.locations.filter(l=>l.position.height===plane && l.position.localX>=origin.x-2 && l.position.localX<origin.x+16 && l.position.localY<=origin.y+2 && l.position.localY>origin.y-15).map(l=>({id:l.id,type:l.type,orientation:l.orientation,x:l.position.localX-origin.x,y:origin.y-l.position.localY}));
    const objectDefs = [];
    for (const id of [...new Set(areaLocations.map(l=>l.id))].sort((a,b)=>a-b)) {
      const def = await cache.getDef(IndexType.CONFIGS.id, ConfigType.OBJECT.id, id).catch(()=>null);
      if (!def) {objectDefs.push({id,missing:true});continue;}
      objectDefs.push({id,name:def.name??null,models:def.objectModels??[],types:def.objectTypes??[],animation:def.animationID>=0?def.animationID:null,...Object.fromEntries(Object.entries(def).filter(([key])=>/size|offset|scale|ambient|contrast|recolor|retexture/i.test(key)))});
    }
    const floorDefs = {underlays:[],overlays:[]};
    for (const [key,field,config] of [["underlays","underlayId",ConfigType.UNDERLAY],["overlays","overlayId",ConfigType.OVERLAY]]) {
      for (const rawId of [...new Set(area.map(t=>t[field]).filter(id=>Number.isInteger(id)&&id>0))].sort((a,b)=>a-b)) {
        const id=rawId-1;
        const def=await cache.getDef(IndexType.CONFIGS.id,config.id,id).catch(()=>null);
        floorDefs[key].push({rawId,definitionId:id,definition:def??null});
      }
    }
    const dir = "artifacts/ocellus-scenery";
    await mkdir(dir,{recursive:true});
    await writeFile(path.join(dir,"native-region-16472.json"),JSON.stringify({cache:cfg.cacheId,square,plane,origin,format:decoded.format,files:decoded.files,area,areaLocations,objectDefs,floorDefs},null,2)+"\n");
    console.log("OCELLUS_NATIVE_REGION_EVIDENCE " + JSON.stringify({tiles:area.length,locations:areaLocations.length,uniqueObjects:objectDefs.length,underlays:floorDefs.underlays.length,overlays:floorDefs.overlays.length}));
  }
} finally {
  cache.close();
}
