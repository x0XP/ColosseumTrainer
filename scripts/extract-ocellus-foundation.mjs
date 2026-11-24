#!/usr/bin/env node
import path from "node:path";
import { pathToFileURL } from "node:url";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { loadConfig } from "osrs-sdk-assets";
import { foundationBoxes, extractFoundation } from "./ocellus-native-foundation.mjs";

const args=process.argv.slice(2);
const option=flag=>{const i=args.indexOf(flag);return i<0?undefined:args[i+1];};
const cfg=await loadConfig({cwd:process.cwd(),config:option("--config")??"osrs-assets.ocellus.config.ts",cacheDir:option("--cache-dir"),readerPath:option("--reader-path")});
if(cfg.cacheId!==2746)throw Error("Native foundation requires cache 2746");
const native=JSON.parse(await readFile("artifacts/ocellus-scenery/native-region-16472.json","utf8"));
if(native.cache!==2746||native.square!==16472||native.plane!==1)throw Error("Wrong foundation region");
const rules=await readFile("src/ocellus/Phase4Rules.ts","utf8");
const rows=[...rules.split("export const PLATFORM_ROWS = [")[1].split("] as const;")[0].matchAll(/"([.?#wb/]+)"/g)].map(m=>m[1]);
if(rows.length!==13||rows.join("").split("#").length-1!==84)throw Error("Unexpected P4 footprint");
const boxes=foundationBoxes(rows);
const {RSCache,IndexType}=await import(pathToFileURL(path.join(cfg.readerPath,"src/index.js")).href);
const cache=new RSCache(path.join(cfg.cacheDir,String(cfg.cacheId),"cache")+path.sep);
await cache.onload;
try{
  const positions=[],colors=[],sources=[];
  // Exact original objects on the two sides of the standing quadrant.
  const expected=[{id:62924,model:62274,x:1,y:9,orientation:3},{id:62925,model:62275,x:1,y:12,orientation:0}];
  for(const e of expected){
    const loc=native.areaLocations.find(l=>l.id===e.id&&l.type===10&&l.x===e.x&&l.y===e.y&&l.orientation===e.orientation);
    const def=native.objectDefs.find(d=>d.id===e.id);
    if(!loc||!def||def.models.length!==1||def.models[0]!==e.model||def.offsetHeight!==769||def.sizeX!==9||def.sizeY!==12||def.modelSizeX!==128||def.modelSizeHeight!==128||def.modelSizeY!==128)throw Error("Original foundation placement mismatch: "+e.id);
    const model=await cache.getDef(IndexType.MODELS.id,e.model);
    if(!model)throw Error("Missing native rock model "+e.model);
    const r=extractFoundation(model,loc,def,boxes);
    for(const value of r.positions)positions.push(value);
    for(const value of r.colors)colors.push(value);
    sources.push({...e,offsetHeight:def.offsetHeight,sourceFaces:r.sourceFaces,clippedFaces:r.clippedFaces,skippedTextureFaces:r.skippedTextureFaces});
  }
  const mesh={cache:2746,square:16472,plane:1,positions,colors,sources};
  if(!colors.length||positions.length!==colors.length*9)throw Error("No usable native foundation faces");
  await mkdir(cfg.outDir,{recursive:true});
  await writeFile(path.join(cfg.outDir,"ocellus-native-foundation.json"),JSON.stringify(mesh));
  await writeFile("artifacts/ocellus-scenery/native-foundation-summary.json",JSON.stringify({cache:2746,square:16472,sources,faces:colors.length},null,2)+"\n");
  console.log("OCELLUS_NATIVE_FOUNDATION "+JSON.stringify({sources,faces:colors.length}));
}finally{cache.close();}
