#!/usr/bin/env node
/** Verify compiled cache-derived NPCs, scenery, and actual default equipment
 * before webpack and Pages deployment. Pinned reference values were recovered
 * from the successful 7daca07 production bundle (OpenRS2 2746).
 * Geometry/sequence identity is not proof of matching rendered gameplay. */
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {readPayload} from "./audit-ocellus-spot-assets.mjs";

export const NATIVE_MODELS=Object.freeze({
 "npc:16677":{vertices:14373,triangles:4791,scale:.6484375,animations:{
  14840:[90,24],14844:[210,56],14846:[90,26],14849:[60,16],14851:[90,24],14855:[90,23],14857:[60,17],14863:[60,17],14864:[60,17],14865:[120,35],14872:[440,58]}},
 "npc:16678":{vertices:999,triangles:333,scale:.75,animations:{14895:[40,8],14896:[30,7],14897:[30,8],14898:[60,18]}},
 "model:62440":{vertices:8316,triangles:2772,animations:{14833:[85,17]}},
 "model:62357":{vertices:1704,triangles:568,animations:{}},
 "model:62739":{vertices:474,triangles:158,animations:{10772:[128,64]}},
 "model:62508":{vertices:540,triangles:180,animations:{14891:[40,8]}},
});
export const VISIBLE_EQUIPMENT=[20997,22325,12926,27235,27238,27241,26235,33639,28951,31097];
export const NON_MESH_ITEMS=[11212,28310,6685,3024,12695,2444];
const framesOf=a=>a?.mayaFrames?.length||a?.rawFrames?.length||a?.frames?.length||0;
export function checkGeometry(label,p,{vertices,triangles}={}){
 const fail=reason=>{throw Error(label+": "+reason);};
 const n=p.positions?.length/3,t=p.indices?.length/3;
 if(!Number.isInteger(n)||!Number.isInteger(t)||n<1||t<0||!p.positions.every(Number.isFinite))fail("invalid position or triangle array");
 if(vertices!==undefined&&n!==vertices||triangles!==undefined&&t!==triangles)fail("native geometry count mismatch");
 if(p.indices.some(i=>!Number.isInteger(i)||i<0||i>=n))fail("invalid triangle index");
 if(t>0){
  for(const [key,expected] of [["colors",n],["alphas",n],["uvs",2*n],["textureIds",n]]){
   if(!Array.isArray(p[key])||p[key].length!==expected||!p[key].every(Number.isFinite))fail("invalid "+key);
  }
  for(const texture of new Set(p.textureIds.filter(i=>i>=0))){
   if(!p.textures?.[String(texture)])fail("unpacked model texture "+texture);
  }
 }
 return {vertices:n,triangles:t};
}
export function checkSequence(label,id,a,expected){
 const frameCount=framesOf(a);
 if(!a?.lengths?.length||!a.lengths.every(x=>Number.isFinite(x)&&x>0)||frameCount!==a.lengths.length)throw Error(label+": incomplete sequence "+id);
 const cycles=a.lengths.reduce((a,b)=>a+b,0);
 if(expected&&(cycles!==expected[0]||frameCount!==expected[1]))throw Error(label+": native sequence mismatch "+id);
 return {id:Number(id),cycles,frames:frameCount};
}
export function checkNativeModel(label,p,expected){
 const geometry=checkGeometry(label,p,expected);
 if(expected.scale!==undefined&&p.scale!==expected.scale)throw Error(label+": native scale mismatch");
 const ids=Object.keys(expected.animations);
 if(Object.keys(p.animations??{}).sort().join(",")!==ids.sort().join(","))throw Error(label+": native sequence list mismatch");
 for(const id of Object.values(p.poseMap??{}))if(!p.animations?.[String(id)])throw Error(label+": missing mapped pose "+id);
 return {label,...geometry,scale:p.scale??1,sequences:ids.map(id=>checkSequence(label,id,p.animations[id],expected.animations[id]))};
}
/** Inspect initially opaque native payloads for type-5 transforms which
 * actually alter one or more exported vertices. Same alpha delta as SDK. */
export function auditAnimatedAlpha(payload,id){
 const groups=payload.alphaGroups??[],frames=payload.animations?.[String(id)]?.rawFrames??[];
 let changedFrames=0,maximum=0;
 const changedVertices=new Set();
 if(payload.alphas?.some(a=>a!==0))throw Error("Animated alpha fixture must start opaque");
 for(const frame of frames){
  const alpha=new Map();
  (frame.indexFrameIds??[]).forEach((index,i)=>{
   if(frame.types[index]!==5||!frame.x[i])return;
   for(const group of frame.maps[index]??[])for(const vertex of groups[group]??[]){
    alpha.set(vertex,Math.max(0,Math.min(255,(alpha.get(vertex)??0)+frame.x[i]*8)));
   }
  });
  let changed=false;
  for(const [vertex,value] of alpha)if(value>0){changed=true;changedVertices.add(vertex);maximum=Math.max(maximum,value);}
  if(changed)changedFrames++;
 }
 return {id:Number(id),changedFrames,affectedVertices:changedVertices.size,maximum};
}
/** Every visible equipment vertex must retain a native skin group and
 * source identity, otherwise it may remain at bind pose during combat. */
export function auditEquipmentSkin(label,payload){
 const n=payload.positions.length/3;
 const sources=payload.sourceVertices??[];
 if(sources.length!==n||!sources.every(v=>Number.isInteger(v)&&v>=0))throw Error(label+": invalid source vertices");
 const seen=new Uint8Array(n);
 for(const group of payload.vertexGroups??[]){
  for(const index of group){
   if(!Number.isInteger(index)||index<0||index>=n||seen[index])throw Error(label+": invalid or duplicate skin vertex");
   seen[index]=1;
  }
 }
 if(seen.some(v=>v!==1))throw Error(label+": unskinned equipment vertex");
 return {skinnedVertices:n,uniqueSourceVertices:new Set(sources).size};
}
/** Static native boss alpha triangles are homogeneous and untextured.
 * Record actual index runs, not just vertex counts. */
export function auditBossAlpha(payload){
 if(payload.textureIds?.some(id=>id>=0)||Object.values(payload.animations??{}).some(a=>a.rawFrames?.some(f=>f.types.includes(5))))throw Error("Boss alpha no longer static/untextured");
 const {indices,alphas}=payload;
 let opaque=0,translucent=0,runs=0,last;
 for(let i=0;i<indices.length;i+=3){
  const a=indices.slice(i,i+3).map(v=>alphas[v]);
  if(a.length!==3||a.some(v=>!Number.isFinite(v)||v<0||v>255)||a.some(v=>v!==a[0]))throw Error("Mixed native boss alpha triangle");
  const flag=a[0]>0;
  if(flag)translucent++;else opaque++;
  if(flag!==last){runs++;last=flag;}
 }
 return {opaque,translucent,runs};
}
export function auditNativeActors(root){
 const manifest=JSON.parse(fs.readFileSync(path.join(root,"manifest.json"),"utf8"));
 if(manifest.cache?.source!=="openrs2:2746")throw Error("Unexpected Ocellus compiled cache source");
 const load=id=>{
  const a=manifest.assets?.[id];
  if(!a)throw Error("Missing compiled asset "+id);
  return readPayload(fs.readFileSync(path.join(root,a.file)));
 };
 const native=Object.entries(NATIVE_MODELS).map(([ref,expected])=>{
  const ids=manifest.references?.[ref];
  if(ids?.length!==1)throw Error("Missing or ambiguous native reference "+ref);
  return checkNativeModel(ref,load(ids[0]),expected);
 });
 const items=[...VISIBLE_EQUIPMENT,...NON_MESH_ITEMS].map(id=>{
  const asset=manifest.playerItems?.["item:"+id];
  if(!asset)throw Error("Missing compiled equipment "+id);
  const payload=load(asset);
  const geometry=checkGeometry("item:"+id,payload);
  if(VISIBLE_EQUIPMENT.includes(id)&&geometry.triangles===0)throw Error("Missing visible equipment mesh "+id);
  if(NON_MESH_ITEMS.includes(id)&&geometry.triangles!==0)throw Error("Unexpected equipped mesh "+id);
  const skin=VISIBLE_EQUIPMENT.includes(id)?auditEquipmentSkin("item:"+id,payload):null;
  return {id,asset,...geometry,skin};
 });
 const player=load(manifest.sharedAssets?.playerAnimations);
 const poses=Object.values(player.poseMap??{});
 if(poses.length!==26||poses.some(id=>!player.animations?.[String(id)]))throw Error("Incomplete player movement/combat pose map");
 const animations=Object.entries(player.animations??{}).map(([id,a])=>checkSequence("player",id,a));
 if(animations.length!==38)throw Error("Unexpected player sequence count");
 const animatedAlpha=[
  {...auditAnimatedAlpha(load("model-62739"),10772),asset:"model-62739"},
  {...auditAnimatedAlpha(load("spotanim-4306"),14910),asset:"spotanim-4306"},
  {...auditAnimatedAlpha(load("npc-16678"),14898),asset:"npc-16678"},
 ];
 const expected=[[64,474],[10,504],[10,504]];
 animatedAlpha.forEach((entry,i)=>{
  if(entry.changedFrames!==expected[i][0]||entry.affectedVertices!==expected[i][1]||entry.maximum!==255)
   throw Error("Native animated alpha mismatch: "+entry.asset);
 });
 const bossAlpha=auditBossAlpha(load("npc-16677"));
 if(bossAlpha.opaque!==4645||bossAlpha.translucent!==146||bossAlpha.runs!==3)throw Error("Native boss alpha triangle coverage mismatch");
 return {cache:2746,native,items,player:{poses:poses.length,animations},animatedAlpha,bossAlpha};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const report=auditNativeActors(process.argv[2]??"public/osrs-assets");
 fs.mkdirSync("artifacts/ocellus-scenery",{recursive:true});
 fs.writeFileSync("artifacts/ocellus-scenery/compiled-native-actors.json",JSON.stringify(report,null,2)+"\n");
 console.log("OCELLUS_COMPILED_ACTORS "+JSON.stringify({models:report.native.length,nativeSequences:report.native.reduce((n,m)=>n+m.sequences.length,0),equipment:report.items.length,playerSequences:report.player.animations.length}));
}
