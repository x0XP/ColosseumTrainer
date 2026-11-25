import test from "node:test";
import assert from "node:assert/strict";
import {COLLAPSE_OBJECTS,collapsePlacement,posedScenery,sampleCollapseFrames,collapseWorldCandidate} from "./audit-ocellus-collapse.mjs";
test("original collapse placements require sequence and exact transform",()=>{
 const e=COLLAPSE_OBJECTS[0],native={areaLocations:[e],objectDefs:[{...e,models:[e.model],animation:15027,offsetHeight:769,modelSizeX:128,modelSizeY:128,modelSizeHeight:128}]};
 assert.equal(collapsePlacement(native,e).offsetHeight,769);
 assert.throws(()=>collapsePlacement({...native,areaLocations:[{...e,x:0}]},e),/placement changed/);
});
test("native collapse audit maps source vertices and measures final pose without guessing",()=>{
 const p={positions:Array(9).fill(0),indices:[0,1,2],sourceVertices:[1,0,2],alphas:[0,0,0],animations:{"15027":{lengths:[3,7],frames:[[0,0,0,1,1,0,0,0,1],[0,-2,0,1,-1,0,0,-2,1]]}}};
 assert.deepEqual(posedScenery(p,p.animations[15027].frames[0]).vertices[0],[128,128,0]);
 const r=sampleCollapseFrames(p);assert.equal(r.metadata.cycles,10);assert.equal(r.frames[1].cycle,3);assert.equal(r.frames[1].bounds[1].max,-128);
 assert.equal(r.previews.length,2);
 assert.throws(()=>posedScenery({...p,sourceVertices:[1,0,9]},p.animations[15027].frames[0]),/source vertex/);
});

test("terminal candidate uses native world placement and rejects upper, transparent and textured faces",()=>{
 const p={positions:Array(18).fill(0),indices:[0,1,2,3,4,5],sourceVertices:[0,1,2,0,1,2],alphas:[0,0,0,255,255,255],textureIds:Array(6).fill(-1),colors:Array(6).fill(0x345678)};
 const e={...COLLAPSE_OBJECTS[0],offsetHeight:769};
 const candidate=collapseWorldCandidate(p,[0,4,0,1,4,0,0,4,1],e);
 assert.equal(candidate.retainedFaces,1);assert.equal(candidate.sourceFaces,1);
 assert.ok(candidate.positions.filter((_,i)=>i%3===1).every(y=>Math.abs(y-(4-769/128))<1e-9));
 assert.ok(candidate.positions.filter((_,i)=>i%3===0).every(x=>x>=-.5&&x<=.5));
 assert.equal(collapseWorldCandidate(p,[0,7,0,1,7,0,0,7,1],e).retainedFaces,0);
});

test("terminal pose uses the original map footprint height delta",()=>{
 const e=COLLAPSE_OBJECTS[1],origin={x:32,y:40};
 const area=Array.from({length:40},(_,x)=>Array.from({length:50},(_,y)=>({localX:x,localY:y,heightUnits:y===40?1008:880}))).flat();
 const native={origin,area,areaLocations:[e],objectDefs:[{...e,models:[e.model],animation:15027,offsetHeight:769,modelSizeX:128,modelSizeY:128,modelSizeHeight:128}]};
 const placed=collapsePlacement(native,e);assert.equal(placed.anchorDelta,-128);
 const p={positions:Array(9).fill(0),indices:[0,1,2],sourceVertices:[0,1,2],colors:Array(3).fill(0x345678)};
 const candidate=collapseWorldCandidate(p,[0,4,0,1,4,0,0,4,1],placed);
 assert.ok(candidate.positions.filter((_,i)=>i%3===1).every(y=>Math.abs(y-(3-769/128))<1e-9));
});
