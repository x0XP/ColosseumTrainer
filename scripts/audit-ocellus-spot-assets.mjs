#!/usr/bin/env node
/** Verify the actual compiled Ocellus spot-animation payloads, not just
 * manifest keys. Values below were decoded from cache 2746's production pack. */
import fs from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";

export const EXPECTED_SPOTS = Object.freeze({
  4274:[14939,440,83,83],4275:[14949,440,83,83],4276:[14950,440,83,83],
  4306:[14910,30,64,96],4309:[14913,182,128,128],4310:[14914,32,128,128],
  4311:[14915,364,128,128],4312:[14916,30,128,128],4313:[14917,55,128,128],
  4314:[14919,55,128,128],4316:[14920,60,83,83],4328:[14963,210,83,83],
  4329:[14964,210,83,83],4330:[14965,210,83,83],4339:[14933,55,128,128],
  4340:[14934,90,128,128],
});
export const KNOWN_UNAVAILABLE = new Set([12812,12813,12815,12826]);

export function soundPackIds(buffer){
  if(buffer.length<6||buffer.toString("ascii",0,4)!=="SFX1")throw Error("Invalid compiled sound pack");
  let offset=6;
  const ids=new Set(),count=buffer.readUInt16BE(4);
  for(let i=0;i<count;i++){
    if(offset+4>buffer.length)throw Error("Truncated sound pack header");
    const id=buffer.readUInt16BE(offset),length=buffer.readUInt16BE(offset+2);
    if(!length||ids.has(id)||offset+4+length>buffer.length)throw Error("Invalid sound pack entry "+id);
    ids.add(id);offset+=4+length;
  }
  if(offset!==buffer.length)throw Error("Unexpected sound pack trailing bytes");
  return ids;
}
export function readPayload(buffer){
  if(buffer.length<8||buffer.toString("ascii",0,4)!=="OSRB"||buffer.readUInt32LE(4)!==buffer.length-8)throw Error("Invalid compiled OSRB payload");
  return JSON.parse(gunzipSync(buffer.subarray(8)).toString("utf8"));
}
export function validateSpot(id,payload,packedSounds){
  const [sequence,cycles,resizeX,resizeY]=EXPECTED_SPOTS[id]??[];
  const spot=payload.spotAnim,animation=payload.animations?.[String(sequence)];
  if(spot?.id!==id||spot.animationId!==sequence||spot.resizeX!==resizeX||spot.resizeY!==resizeY||spot.rotation!==0)throw Error("Native spot metadata mismatch "+id);
  if(!payload.positions?.length||!animation?.lengths?.length||animation.lengths.reduce((a,b)=>a+b,0)!==cycles)throw Error("Native spot duration mismatch "+id);
  const frames=animation.frames?.length||animation.mayaFrames?.length||animation.rawFrames?.length;
  if(!frames||frames!==animation.lengths.length)throw Error("Missing/incomplete native frames "+id);
  const sounds=[...new Set(Object.values(animation.frameSounds??{}).flat().map(s=>s.id))].sort((a,b)=>a-b);
  const missing=sounds.filter(s=>!packedSounds.has(s));
  if(missing.some(s=>!KNOWN_UNAVAILABLE.has(s)))throw Error("Unexpected missing native spot audio "+id+": "+missing.join(","));
  return {id,sequence,cycles,frames,resizeX,resizeY,sounds,missing};
}
export function auditSpotAssets(root){
  const manifest=JSON.parse(fs.readFileSync(path.join(root,"manifest.json"),"utf8"));
  const soundIds=soundPackIds(fs.readFileSync(path.join(root,manifest.soundEffects.file)));
  const spots=Object.keys(EXPECTED_SPOTS).map(Number).map(id=>{
    const key=manifest.spotAnims?.[String(id)],asset=manifest.assets?.[key];
    if(!asset)throw Error("Missing compiled native spot "+id);
    return validateSpot(id,readPayload(fs.readFileSync(path.join(root,asset.file))),soundIds);
  });
  return {cache:2746,spotCount:spots.length,soundPackCount:soundIds.size,spots,unavailable:[...new Set(spots.flatMap(s=>s.missing))].sort((a,b)=>a-b)};
}
if(process.argv[1]&&path.basename(process.argv[1])==="audit-ocellus-spot-assets.mjs"){
  const report=auditSpotAssets(process.argv[2]??"public/osrs-assets");
  fs.mkdirSync("artifacts/ocellus-scenery",{recursive:true});
  fs.writeFileSync("artifacts/ocellus-scenery/compiled-spot-animation-audit.json",JSON.stringify(report,null,2)+"\n");
  console.log("OCELLUS_COMPILED_SPOT_ANIMATIONS "+JSON.stringify(report));
}
