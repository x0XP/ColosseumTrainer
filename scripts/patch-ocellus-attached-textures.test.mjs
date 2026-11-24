import {test} from "node:test";
import assert from "node:assert/strict";
import {patchOcellusAttachedTextures,partitionAttachedAlpha} from "./patch-ocellus-attached-textures.mjs";
const fixture=`      geometry.setIndex(spotPayload.indices ?? []);
      const effect = new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({
          color: spotPayload.color ?? 0xffffff,
          vertexColors: Boolean(spotPayload.colors?.length),
          transparent: true,
          wireframe: DRAW_CACHE_MODEL_WIREFRAME,
        }),
      );
            const rgb = cacheColorToRgb(resolveCacheColor(baseColors[i], faceColors[i], recolor));`;
test("attached effect uses UVs, index order, alpha cutout and cache texture grouping",()=>{
 const patched=patchOcellusAttachedTextures(fixture);
 assert.match(patched,/spotPayload\.textureIds\?\.\[indices\[start\]\]/);
 assert.match(patched,/geometry\.addGroup\(start,3,materialIndex\)/);
 assert.match(patched,/setAttribute\("uv"/);
 assert.match(patched,/alphaTest:\.01/);
 assert.match(patched,/effect\.frustumCulled=false/);
 assert.match(patched,/textured\?baseColors\[i\]:resolveCacheColor/);
 assert.throws(()=>patchOcellusAttachedTextures(patched),/anchor changed/);
});
test("texture runs preserve the original draw order, including reordered indices",()=>{
 const patched=patchOcellusAttachedTextures(fixture);
 const loop=patched.slice(patched.indexOf("        for(let start"),patched.indexOf("      const effect=new"));
 const body=loop.slice(0,loop.lastIndexOf("      }"));
 const geometry={groups:[],addGroup(start,count,materialIndex){this.groups.push({start,count,materialIndex})}};
 const ids=[-1,-1,-1,215,215,215,-1,-1,-1];
 const indices=[3,4,5,0,1,2,6,7,8];
 new Function("geometry","indices","spotPayload","textureMaterial","possibleAlpha","opaqueMaterials","materials",body)(geometry,indices,{textureIds:ids},new Map([[215,1]]),null,new Map(),[]);
 assert.deepEqual(geometry.groups,[{start:0,count:3,materialIndex:1},{start:3,count:6,materialIndex:0}]);
});

test("attached effects conservatively reserve active alpha groups and reject unverified textures",()=>{
 const payload={spotAnim:{id:4328},positions:Array(27).fill(0),alphaGroups:[[3,4,5],[0,1,2]],animations:{1:{rawFrames:[{types:[5,5],maps:[[0],[1]],indexFrameIds:[0,1],x:[12,0]}]}}};
 const alpha=[0,0,0,0,0,0,150,150,150];
 assert.deepEqual(partitionAttachedAlpha(payload,alpha),[false,false,false,true,true,true,true,true,true]);
 assert.equal(partitionAttachedAlpha({...payload,spotAnim:{id:4313}},alpha),null);
 assert.equal(partitionAttachedAlpha({...payload,textureIds:[999]},alpha),null);
 assert.equal(partitionAttachedAlpha({...payload,textureIds:[215],textures:{215:{pixels:[0x00ffffff]}}},alpha),null);
 assert.deepEqual(partitionAttachedAlpha({...payload,textureIds:[215],textures:{215:{pixels:[0xffffffff]}}},alpha),[false,false,false,true,true,true,true,true,true]);
});
test("opaque variants share material per texture and preserve original ordered triangle ranges",()=>{
 const patched=patchOcellusAttachedTextures(fixture);
 const loop=patched.slice(patched.indexOf("        for(let start"),patched.indexOf("      const effect=new"));
 const body=loop.slice(0,loop.lastIndexOf("      }"));
 const geometry={groups:[],addGroup(start,count,materialIndex){this.groups.push({start,count,materialIndex})}};
 const make=()=>({transparent:true,depthWrite:true,clone:make});
 const materials=[make(),make()];
 const indices=[3,4,5,0,1,2,6,7,8,9,10,11];
 const textureIds=[-1,-1,-1,215,215,215,-1,-1,-1,215,215,215];
 const possibleAlpha=[false,false,false,false,false,false,true,true,true,false,false,false];
 new Function("geometry","indices","spotPayload","textureMaterial","possibleAlpha","opaqueMaterials","materials",body)(
 geometry,indices,{textureIds},new Map([[215,1]]),possibleAlpha,new Map(),materials);
 assert.deepEqual(geometry.groups,[{start:0,count:3,materialIndex:2},{start:3,count:3,materialIndex:3},{start:6,count:3,materialIndex:0},{start:9,count:3,materialIndex:2}]);
 assert.equal(materials[2].transparent,false);assert.equal(materials[3].transparent,false);assert.equal(materials[0].transparent,true);
});

test("incomplete alpha data or empty texture pixels never prove opacity",()=>{
 const payload={spotAnim:{id:4328},positions:Array(9).fill(0)};
 assert.deepEqual(partitionAttachedAlpha(payload,[0,0,0]),[false,false,false]);
 assert.equal(partitionAttachedAlpha(payload,[]),null);
 assert.equal(partitionAttachedAlpha(payload,[0,0]),null);
 assert.equal(partitionAttachedAlpha(payload,[0,NaN,0]),null);
 assert.equal(partitionAttachedAlpha(payload,[0,,0]),null);
 assert.equal(partitionAttachedAlpha({...payload,textureIds:[215],textures:{215:{pixels:[]}}},[0,0,0]),null);
 assert.equal(partitionAttachedAlpha({...payload,textureIds:[215],textures:{215:{pixels:[4294967295.5]}}},[0,0,0]),null);
});
test("unavailable texture and unknown vertex alpha keep conservative material",()=>{
 const patched=patchOcellusAttachedTextures(fixture);
 const loop=patched.slice(patched.indexOf("        for(let start"),patched.indexOf("      const effect=new"));
 const body=loop.slice(0,loop.lastIndexOf("      }"));
 const geometry={groups:[],addGroup(start,count,materialIndex){this.groups.push({start,count,materialIndex})}};
 const make=()=>({transparent:true,depthWrite:true,clone:make});
 const materials=[make()];
 new Function("geometry","indices","spotPayload","textureMaterial","possibleAlpha","opaqueMaterials","materials",body)(
 geometry,[0,1,2,3,4,5],{textureIds:[215,215,215,-1,-1,-1]},new Map(),[false,false,false,false,false],new Map(),materials);
 assert.deepEqual(geometry.groups,[{start:0,count:6,materialIndex:0}]);
 assert.equal(materials.length,1);
});
