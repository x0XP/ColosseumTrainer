import {test} from "node:test";
import assert from "node:assert/strict";
import {patchOcellusBossAlpha,patchOcellusRiftAlpha,riftAlphaRuns} from "./patch-ocellus-boss-alpha.mjs";
const fixture=`      const hasVertexAlpha = needsVertexAlpha(payload);
      if (hasVertexAlpha && !DRAW_CACHE_MODEL_WIREFRAME) enableVertexAlpha(materials[0]);
      const mesh = new THREE.Mesh(geometry, materials.length > 1 ? materials : materials[0]);`;
const code=patchOcellusBossAlpha(fixture).replace("payload.indices!","payload.indices").replace("new Set<number>()","new Set()");
function run(payload,definitionId=16677,kind="npc"){
 const rawAlphas=payload.alphas;
 const make=()=>({transparent:false,depthWrite:true,clone:make});
 const materials=[make()];
 const geometry={groups:[],clearGroups(){this.groups=[]},addGroup(start,count,materialIndex){this.groups.push({start,count,materialIndex})}};
 const THREE={Mesh:class{constructor(geometry,material){Object.assign(this,{geometry,material})}}};
 const exec=new Function("payload","rawAlphas","needsVertexAlpha","DRAW_CACHE_MODEL_WIREFRAME","materials","enableVertexAlpha","geometry","THREE",code+";return mesh");
 const mesh=exec.call({reference:{kind,definitionId}},payload,rawAlphas,()=>true,false,materials,m=>m.transparent=true,geometry,THREE);
 return mesh;
}
const base={indices:[0,1,2,3,4,5,6,7,8],alphas:[0,0,0,150,150,150,0,0,0],textureIds:Array(9).fill(-1),animations:{}};
test("solid boss triangles retain depth and opaque queue; translucent faces blend in original index order",()=>{
 const mesh=run(base);
 assert.deepEqual(mesh.geometry.groups,[{start:0,count:3,materialIndex:0},{start:3,count:3,materialIndex:1},{start:6,count:3,materialIndex:0}]);
 assert.equal(mesh.material[0].transparent,false);assert.equal(mesh.material[0].depthWrite,true);
 assert.equal(mesh.material[1].transparent,true);assert.equal(mesh.material[1].depthWrite,false);
});
test("other actors, animated alpha, textured or mixed triangles retain previous material path",()=>{
 for(const mesh of [run(base,16678),run({...base,animations:{1:{rawFrames:[{types:[5]}]}}}),run({...base,textureIds:[215,...base.textureIds.slice(1)]}),run({...base,alphas:[150,...base.alphas.slice(1)]})]){
  assert.equal(Array.isArray(mesh.material),false);assert.equal(mesh.material.transparent,true);assert.equal(mesh.material.depthWrite,true);
 }
 assert.throws(()=>patchOcellusBossAlpha(code),/anchor changed/);
});

test("player opaque armor is separated but native alpha-capable weapon faces retain their old depth behavior",()=>{
 const payload={...base,alphas:Array(9).fill(0),alphaGroups:[[3,4,5]],animations:{1:{rawFrames:[{types:[5],maps:[[0]],indexFrameIds:[0],x:[16]}]}}};
 const mesh=run(payload,0,"player");
 assert.deepEqual(mesh.geometry.groups,[{start:0,count:3,materialIndex:0},{start:3,count:3,materialIndex:1},{start:6,count:3,materialIndex:0}]);
 assert.equal(mesh.material[0].transparent,false);assert.equal(mesh.material[0].depthWrite,true);
 assert.equal(mesh.material[1].transparent,true);assert.equal(mesh.material[1].depthWrite,true);
 const textured=run({...payload,textureIds:[59,...base.textureIds.slice(1)]},0,"player");
 assert.equal(Array.isArray(textured.material),false);assert.equal(textured.material.transparent,true);
});
test("any alpha-capable vertex makes its entire original triangle conservative",()=>{
 const mesh=run({...base,alphas:Array(9).fill(0),alphaGroups:[[4]],animations:{1:{rawFrames:[{types:[5],maps:[[0]],indexFrameIds:[0],x:[-4]}]}}},0,"player");
 assert.equal(mesh.geometry.groups[1].materialIndex,1);
 assert.equal(mesh.geometry.groups[1].count,3);
});

test("Rift faces change render queue only as the native detonation alpha actually changes",()=>{
 const indices=new Uint16Array([0,1,2,3,4,5,6,7,8]),opacity=new Float32Array(9).fill(1);
 assert.deepEqual(riftAlphaRuns(indices,opacity,1),[{start:0,count:9,materialIndex:0}]);
 opacity[4]=.5;
 assert.deepEqual(riftAlphaRuns(indices,opacity,1),[{start:0,count:3,materialIndex:0},{start:3,count:3,materialIndex:1},{start:6,count:3,materialIndex:0}]);
 opacity[4]=1;
 assert.deepEqual(riftAlphaRuns(indices,opacity,1),[{start:0,count:9,materialIndex:0}]);
 assert.deepEqual(riftAlphaRuns([0,1,99],opacity,1),[{start:0,count:3,materialIndex:1}]);
});
test("Rift alpha pass only targets native NPC 16678, and does not rewrite equal groups",()=>{
 const patched=patchOcellusRiftAlpha(patchOcellusBossAlpha(fixture)+"\n        // MeshBasicMaterial uses the cache's baked colours; posed normals are unused.");
 assert.match(patched,/definitionId===16678/);
 assert.match(patched,/if\(splitBossAlpha\|\|splitRiftAlpha\)translucent.depthWrite=false/);
 assert.match(patched,/old.length!==runs.length/);
 assert.throws(()=>patchOcellusRiftAlpha(patched),/anchor changed/);
});
