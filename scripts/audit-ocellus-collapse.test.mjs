import test from "node:test";
import assert from "node:assert/strict";
import {COLLAPSE_OBJECTS,collapsePlacement,posedScenery,sampleCollapseFrames} from "./audit-ocellus-collapse.mjs";
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
