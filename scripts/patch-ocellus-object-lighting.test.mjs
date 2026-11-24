import {test} from "node:test";
import assert from "node:assert/strict";
import {FIXTURE_LIGHTING,nativeObjectLighting,patchOcellusObjectLighting} from "./patch-ocellus-object-lighting.mjs";
test("verified original censer base and animated fixture use their own cache lighting",()=>{
 assert.deepEqual(FIXTURE_LIGHTING.map(f=>[f.model,f.object,f.shape,f.orientation]),[[62357,62894,22,3],[62739,62895,10,1]]);
 assert.deepEqual(nativeObjectLighting(20,500,3),{ambient:84,contrast:1268,x:-50,y:-10,z:50});
 assert.deepEqual(nativeObjectLighting(70,1750,1),{ambient:134,contrast:2518,x:50,y:-10,z:-50});
});
test("inverse cache rotation preserves dot product with the original world light",()=>{
 const n=[3,7,-11];
 const rotated=[[n[0],n[2]],[n[2],-n[0]],[-n[0],-n[2]],[-n[2],n[0]]];
 for(let orientation=0;orientation<4;orientation++){
   const l=nativeObjectLighting(0,0,orientation);
   assert.equal(n[0]*l.x+n[1]*l.y+n[2]*l.z,rotated[orientation][0]*-50+n[1]*-10+rotated[orientation][1]*-50);
 }
});
test("asset adapter patch is limited to the two mapped models and keeps the default model export",()=>{
 const original="        const modelPayload = await attachTextures(cache, payload(modelGroup));";
 const result=patchOcellusObjectLighting(original);
 assert.match(result,/62357/);assert.match(result,/62739/);
 assert.match(result,/payload\(modelGroup,undefined,definition,objectLighting\)/);
 assert.match(result,/else\{\s*modelPayload=await attachTextures\(cache,payload\(modelGroup\)\)/);
 assert.throws(()=>patchOcellusObjectLighting(result),/anchor changed/);
});
