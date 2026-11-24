#!/usr/bin/env node
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { loadConfig } from "osrs-sdk-assets";
import { foundationBoxes, extractFoundation, extractCurb } from "./ocellus-native-foundation.mjs";
import { sampleTopSurface, surfaceSvg, floorPixels } from "./ocellus-native-surface.mjs";

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
  const positions=[],colors=[],vertexColors=[],sources=[],surfaceSources=[];
  // Exact original objects on the two sides of the standing quadrant.
  const expected=[{id:62924,model:62274,x:1,y:9,orientation:3},{id:62925,model:62275,x:1,y:12,orientation:0}];
  for(const e of expected){
    const loc=native.areaLocations.find(l=>l.id===e.id&&l.type===10&&l.x===e.x&&l.y===e.y&&l.orientation===e.orientation);
    const def=native.objectDefs.find(d=>d.id===e.id);
    if(!loc||!def||def.models.length!==1||def.models[0]!==e.model||def.offsetHeight!==769||def.sizeX!==9||def.sizeY!==12||def.modelSizeX!==128||def.modelSizeHeight!==128||def.modelSizeY!==128)throw Error("Original foundation placement mismatch: "+e.id);
    const model=await cache.getDef(IndexType.MODELS.id,e.model);
    if(!model)throw Error("Missing native rock model "+e.model);
    surfaceSources.push({id:e.model,model,placement:loc,definition:def});
    const r=extractFoundation(model,loc,def,boxes);
    for(const value of r.positions)positions.push(value);
    for(const value of r.colors)colors.push(value);
    for(const value of r.vertexColors)vertexColors.push(value);
    sources.push({...e,offsetHeight:def.offsetHeight,sourceFaces:r.sourceFaces,clippedFaces:r.clippedFaces,skippedTextureFaces:r.skippedTextureFaces});
  }
  // Include the original north-side ledge in the clipped foundation.
  const ledge=native.areaLocations.find(l=>l.id===62928&&l.x===2&&l.y===0&&l.type===10&&l.orientation===3);
  const ledgeDef=native.objectDefs.find(d=>d.id===62928);
  if(!ledge||ledgeDef?.models?.[0]!==62277)throw Error("Missing native north-side ledge");
  const ledgeModel=await cache.getDef(IndexType.MODELS.id,62277);
  if(!ledgeModel)throw Error("Missing north-side ledge model 62277");
  surfaceSources.push({id:62277,model:ledgeModel,placement:ledge,definition:ledgeDef});
  const lr=extractFoundation(ledgeModel,ledge,ledgeDef,boxes);
  for(const value of lr.positions)positions.push(value);
  for(const value of lr.colors)colors.push(value);
  for(const value of lr.vertexColors)vertexColors.push(value);
  sources.push({id:62928,model:62277,x:ledge.x,y:ledge.y,orientation:ledge.orientation,offsetHeight:ledgeDef.offsetHeight,sourceFaces:lr.sourceFaces,clippedFaces:lr.clippedFaces,skippedTextureFaces:lr.skippedTextureFaces});
  const mesh={cache:2746,square:16472,plane:1,positions,colors,vertexColors,sources,lighting:"cache-object"};
  if(!colors.length||positions.length!==colors.length*9||vertexColors.length!==colors.length*3)throw Error("No usable native lit foundation faces");
  await mkdir(cfg.outDir,{recursive:true});
  await writeFile(path.join(cfg.outDir,"ocellus-native-foundation.json"),JSON.stringify(mesh));
  await writeFile("artifacts/ocellus-scenery/native-foundation-summary.json",JSON.stringify({cache:2746,square:16472,sources,faces:colors.length},null,2)+"\n");
  console.log("OCELLUS_NATIVE_FOUNDATION "+JSON.stringify({sources,faces:colors.length}));
  const report=sampleTopSurface(surfaceSources,rows);
  const summary={cache:2746,square:16472,plane:1,models:surfaceSources.map(s=>s.id),resolution:report.resolution,tiles:report.tiles};
  const playable=report.tiles.filter(t=>t.kind==="#");
  const coverage=playable.reduce((sum,t)=>sum+t.coverage,0)/playable.length;
  await writeFile("artifacts/ocellus-scenery/native-upper-surface.json",JSON.stringify({...summary,coverage},null,2)+"\n");
  await writeFile("artifacts/ocellus-scenery/native-upper-surface.svg",surfaceSvg(report,rows));
  console.log("OCELLUS_NATIVE_UPPER_SURFACE "+JSON.stringify({models:summary.models,playableTiles:playable.length,coverage,fullyCovered:playable.filter(t=>t.coverage===1).length}));
  // The complete source floor was verified at 16 samples/tile. Bake the
  // original HSL face pattern at 64 samples/tile, not a procedural checkerboard.
  if(playable.length!==84||coverage!==1||playable.some(t=>t.medianHeight!==-1/128))throw Error("Native floor has not been verified at the expected height");
  // Render the original curb mesh, not full reconstructed square tiles.
  // All three static models have been confirmed in the recovered region.
  const curb=extractCurb(surfaceSources,rows);
  if(curb.tiles!==29||curb.sources.map(s=>s.model).join(",")!=="62274,62275,62277"||curb.colors.length===0||curb.positions.length!==curb.colors.length*9||curb.vertexColors.length!==curb.colors.length*3)throw Error("Missing native lit curb geometry");
  const curbMesh={cache:2746,square:16472,plane:1,lighting:"cache-object",...curb};
  await writeFile(path.join(cfg.outDir,"ocellus-native-curb.json"),JSON.stringify(curbMesh));
  const curbSummary={tiles:curb.tiles,faces:curb.colors.length,sources:curb.sources};
  await writeFile("artifacts/ocellus-scenery/native-curb-summary.json",JSON.stringify(curbSummary,null,2)+"\n");
  console.log("OCELLUS_NATIVE_CURB "+JSON.stringify(curbSummary));
  const floorRows=rows.map(row=>row.replace(/[^#]/g,"."));
  const floorOnly=sampleTopSurface(surfaceSources,floorRows,16,-1/128);
  const high=sampleTopSurface(surfaceSources,floorRows,64,-1/128);
  const baked=floorPixels(high,floorOnly,rows);
  const {createCanvas}=createRequire(path.join(cfg.readerPath,"package.json"))("canvas");
  const canvas=createCanvas(baked.width,baked.height),context=canvas.getContext("2d");
  const image=context.createImageData(baked.width,baked.height);
  image.data.set(baked.rgba);
  context.putImageData(image,0,0);
  const png=canvas.toBuffer("image/png");
  await mkdir(path.join(cfg.outDir,"textures"),{recursive:true});
  await writeFile(path.join(cfg.outDir,"textures","ocellus-native-floor.png"),png);
  await writeFile("artifacts/ocellus-scenery/native-floor-texture.png",png);
  const proof={cache:2746,square:16472,plane:1,lighting:"cache-object",models:summary.models,width:baked.width,height:baked.height,pixels:baked.pixels,fallbackPixels:baked.fallbackPixels,extendedPixels:baked.extendedPixels,repairs:baked.repairs,floorY:baked.floorY,tiles:84};
  await writeFile(path.join(cfg.outDir,"ocellus-native-floor.json"),JSON.stringify(proof)+"\n");
  console.log("OCELLUS_NATIVE_FLOOR "+JSON.stringify(proof));
}finally{cache.close();}
