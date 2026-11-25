#!/usr/bin/env node
// Diagnostic only: recover native animation poses for the two mapped
// collapse objects. Do not infer the authoritative post-collapse state.
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {readPayload} from "./audit-ocellus-spot-assets.mjs";
import {checkGeometry,checkSequence} from "./audit-ocellus-native-actors.mjs";
import {makeSheet} from "./ocellus-scenery-preview.mjs";
export const COLLAPSE_OBJECTS=[
 {id:62950,model:62278,x:-2,y:12,type:10,orientation:0,sizeX:3,sizeY:11},
 {id:62951,model:62273,x:-1,y:12,type:22,orientation:0,sizeX:3,sizeY:1},
];
export function collapsePlacement(native,expected){
 const loc=native.areaLocations.find(l=>["id","x","y","type","orientation"].every(k=>l[k]===expected[k]));
 const def=native.objectDefs.find(d=>d.id===expected.id);
 if(!loc||!def||def.models?.join(",")!==String(expected.model)||def.animation!==15027||
  def.sizeX!==expected.sizeX||def.sizeY!==expected.sizeY||def.offsetHeight!==769||
  [def.modelSizeX,def.modelSizeY,def.modelSizeHeight].some(n=>n!==128))
  throw Error("Native collapse placement changed: "+expected.id);
 return {...expected,offsetHeight:def.offsetHeight};
}
export function posedScenery(payload,frame){
 const n=payload.positions.length/3;
 if(!Array.isArray(frame)||frame.length%3||payload.sourceVertices?.length!==n)
  throw Error("Missing original posed scenery frame");
 const vertices=payload.sourceVertices.map(i=>{
  if(!Number.isInteger(i)||i<0||i*3+2>=frame.length)throw Error("Invalid original source vertex");
  const [x,y,z]=frame.slice(i*3,i*3+3);
  if(![x,y,z].every(Number.isFinite))throw Error("Invalid original posed vertex");
  // Payload positions are in tiles, preview uses native units.
  return [x*128,y*128,z*128];
 });
 const triangles=[];
 for(let i=0;i<payload.indices.length;i+=3){
  const indices=payload.indices.slice(i,i+3);
  if(indices.some(j=>j<0||j>=n))throw Error("Invalid original face");
  if(indices.every(j=>(payload.alphas?.[j]??0)===255))continue;
  triangles.push({indices,transparent:false});
 }
 const bounds=[0,1,2].map(axis=>{
  let min=Infinity,max=-Infinity;
  for(const v of vertices){min=Math.min(min,v[axis]);max=Math.max(max,v[axis]);}
  return {min,max,span:max-min};
 });
 return {vertices,triangles,bounds};
}
export function sampleCollapseFrames(payload){
 const sequence=payload.animations?.["15027"];
 const metadata=checkSequence("collapse",15027,sequence);
 if(!Array.isArray(sequence.frames)||sequence.frames.length!==metadata.frames)throw Error("Native baked collapse frames unavailable");
 let elapsed=0;
 const frames=sequence.frames.map((frame,index)=>{
  const geometry=posedScenery(payload,frame);
  const result={index,cycle:elapsed,bounds:geometry.bounds,faces:geometry.triangles.length};
  elapsed+=sequence.lengths[index];return result;
 });
 const indexes=[...new Set([0,Math.floor((frames.length-1)/3),Math.floor((frames.length-1)*2/3),frames.length-1])];
 return {metadata,frames,previews:indexes.map(index=>({index,cycle:frames[index].cycle,geometry:posedScenery(payload,sequence.frames[index])}))};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const root=process.argv[2]??"public/osrs-assets";
 const manifest=JSON.parse(fs.readFileSync(path.join(root,"manifest.json"),"utf8"));
 const dir="artifacts/ocellus-scenery";
 const native=JSON.parse(fs.readFileSync(path.join(dir,"native-region-16472.json"),"utf8"));
 if(native.cache!==2746||native.square!==16472||native.plane!==1)throw Error("Wrong native collapse region");
 const records=[],summary=[];
 for(const expected of COLLAPSE_OBJECTS){
  const placement=collapsePlacement(native,expected),ids=manifest.references?.["model:"+expected.model];
  if(ids?.length!==1)throw Error("Missing compiled collapse model "+expected.model);
  const payload=readPayload(fs.readFileSync(path.join(root,manifest.assets[ids[0]].file)));
  const geometry=checkGeometry("collapse:"+expected.model,payload);
  const result=sampleCollapseFrames(payload);
  summary.push({placement,geometry,sequence:result.metadata,frames:result.frames});
  for(const preview of result.previews)records.push({id:expected.model,label:"frame "+preview.index+" / cycle "+preview.cycle,locs:[expected.id],geometry:preview.geometry});
 }
 fs.writeFileSync(path.join(dir,"native-collapse-15027.json"),JSON.stringify({cache:2746,objects:summary},null,2)+"\n");
 fs.writeFileSync(path.join(dir,"native-collapse-15027.svg"),makeSheet(records,2746));
 console.log("OCELLUS_NATIVE_COLLAPSE "+JSON.stringify(summary.map(({placement,geometry,sequence,frames})=>({placement,geometry,sequence,first:frames[0],last:frames.at(-1)}))));
}
