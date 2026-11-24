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
/** The original index buffer is priority-sorted for some graphics. Read
 * the texture ID via the actual triangle indices, not sequential vertices. */
export const TEXTURED_SPOTS=Object.freeze({4276:[82,2],4306:[86,4],4328:[144,33],4329:[144,33],4330:[144,33]});
export function auditSpotTexture(id,payload){
 const expected=TEXTURED_SPOTS[id];
 const ids=payload.textureIds??[],indices=payload.indices??[];
 if(!expected)return null;
 if(ids.length!==payload.positions.length/3||payload.uvs?.length!==ids.length*2||!payload.uvs.every(Number.isFinite)||indices.length%3)throw Error("Invalid native spot UVs "+id);
 let textured=0,runs=0,last;
 for(let i=0;i<indices.length;i+=3){
  const [a,b,c]=indices.slice(i,i+3);
  if(![a,b,c].every(v=>Number.isInteger(v)&&v>=0&&v<ids.length)||ids[a]!==ids[b]||ids[a]!==ids[c])throw Error("Invalid native spot texture triangle "+id);
  const texture=ids[a];
  if(texture!==last){runs++;last=texture;}
  if(texture>=0){if(texture!==215)throw Error("Unexpected native spot texture "+id);textured++;}
 }
 const image=payload.textures?.["215"];
 if(image?.width!==128||image?.height!==128||image.pixels?.length!==16384||!image.pixels.every(v=>Number.isInteger(v)&&(v>>>24)===255))throw Error("Invalid native texture 215 "+id);
 if(textured!==expected[0]||runs!==expected[1])throw Error("Native spot texture coverage mismatch "+id);
 const texturedUvs=ids.flatMap((texture,i)=>texture===215?payload.uvs.slice(i*2,i*2+2):[]);
 const repeatedCoordinates=texturedUvs.filter(v=>v<0||v>1).length;
 if(id===4276&&repeatedCoordinates!==255)throw Error("Native death crack repeated UV coverage mismatch");
 if(id!==4276&&repeatedCoordinates!==0)throw Error("Unexpected repeated native spot UVs "+id);
 return {texturedTriangles:textured,drawRuns:runs,texture:215,repeatedCoordinates};
}
/** Native untextured core lighting was verified directly from the deployed
 * cache 2746 payload. Texture 215 handles the formerly white textured faces. */
export function auditTransitionCore(id,payload){
 if(![4328,4329,4330].includes(id))return null;
 const colors=payload.colors??[],faces=payload.faceColors??[],textures=payload.textureIds??[];
 if(colors.length!==5628||faces.length!==colors.length||textures.length!==colors.length)throw Error("Native transition colour array mismatch "+id);
 const shades=new Map();let textured=0;
 for(let i=0;i<colors.length;i++){
  if(faces[i]!==4)continue;
  if(textures[i]>=0){if(textures[i]!==215)throw Error("Unexpected transition core texture");textured++;continue;}
  shades.set(colors[i],(shades.get(colors[i])??0)+1);
 }
 if(textured!==432||shades.size!==3||shades.get(0x090707)!==540||shades.get(0x0c0a0a)!==336||shades.get(0x0f0e0e)!==12)throw Error("Native transition core shade mismatch "+id);
 return {untextured:888,textured,shades:Object.fromEntries([...shades].sort((a,b)=>a[0]-b[0]).map(([color,count])=>[color.toString(16).padStart(6,"0"),count]))};
}
export function auditSpotAssets(root){
  const manifest=JSON.parse(fs.readFileSync(path.join(root,"manifest.json"),"utf8"));
  const soundIds=soundPackIds(fs.readFileSync(path.join(root,manifest.soundEffects.file)));
  const spots=Object.keys(EXPECTED_SPOTS).map(Number).map(id=>{
    const key=manifest.spotAnims?.[String(id)],asset=manifest.assets?.[key];
    if(!asset)throw Error("Missing compiled native spot "+id);
    const payload=readPayload(fs.readFileSync(path.join(root,asset.file)));
    return {...validateSpot(id,payload,soundIds),textureAudit:auditSpotTexture(id,payload),coreAudit:auditTransitionCore(id,payload)};
  });
  return {cache:2746,spotCount:spots.length,soundPackCount:soundIds.size,spots,unavailable:[...new Set(spots.flatMap(s=>s.missing))].sort((a,b)=>a-b)};
}
if(process.argv[1]&&path.basename(process.argv[1])==="audit-ocellus-spot-assets.mjs"){
  const report=auditSpotAssets(process.argv[2]??"public/osrs-assets");
  fs.mkdirSync("artifacts/ocellus-scenery",{recursive:true});
  fs.writeFileSync("artifacts/ocellus-scenery/compiled-spot-animation-audit.json",JSON.stringify(report,null,2)+"\n");
  console.log("OCELLUS_COMPILED_SPOT_ANIMATIONS "+JSON.stringify(report));
}
