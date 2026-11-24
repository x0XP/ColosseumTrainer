import {test} from "node:test";
import assert from "node:assert/strict";
import {patchOcellusBossAlpha} from "./patch-ocellus-boss-alpha.mjs";
const fixture=`      const hasVertexAlpha = needsVertexAlpha(payload);
      if (hasVertexAlpha && !DRAW_CACHE_MODEL_WIREFRAME) enableVertexAlpha(materials[0]);
      const mesh = new THREE.Mesh(geometry, materials.length > 1 ? materials : materials[0]);`;
const code=patchOcellusBossAlpha(fixture).replace("payload.indices!","payload.indices");
function run(payload,definitionId=16677){
 const rawAlphas=payload.alphas;
 const make=()=>({transparent:false,depthWrite:true,clone:make});
 const materials=[make()];
 const geometry={groups:[],clearGroups(){this.groups=[]},addGroup(start,count,materialIndex){this.groups.push({start,count,materialIndex})}};
 const THREE={Mesh:class{constructor(geometry,material){Object.assign(this,{geometry,material})}}};
 const exec=new Function("payload","rawAlphas","needsVertexAlpha","DRAW_CACHE_MODEL_WIREFRAME","materials","enableVertexAlpha","geometry","THREE",code+";return mesh");
 const mesh=exec.call({reference:{kind:"npc",definitionId}},payload,rawAlphas,()=>true,false,materials,m=>m.transparent=true,geometry,THREE);
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
