import {test} from "node:test";
import assert from "node:assert/strict";
import {patchOcellusAttachedTextures} from "./patch-ocellus-attached-textures.mjs";
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
 new Function("geometry","indices","spotPayload","textureMaterial",body)(geometry,indices,{textureIds:ids},new Map([[215,1]]));
 assert.deepEqual(geometry.groups,[{start:0,count:3,materialIndex:1},{start:3,count:6,materialIndex:0}]);
});
