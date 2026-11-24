import {test} from "node:test";
import assert from "node:assert/strict";
import {patchOcellusActorPresentation} from "./patch-ocellus-actor-presentation.mjs";
const fixture=`        for (let vertex = 0; vertex < payload.textureIds.length; vertex += 3) {
          const materialIndex = textureMaterial.get(payload.textureIds[vertex]) ?? 0;
          const run = geometry.groups[geometry.groups.length - 1];
          if (run?.materialIndex === materialIndex) run.count += 3;
          else geometry.addGroup(vertex, 3, materialIndex);
        }
    this.updateSceneObjects(scene, location, rotation, pitch, visible, modelOffsets);
  private updateSpotAnimations(clockDelta: number) {
        const recolor = placement?.recolor ?? {};
        color.needsUpdate = true;
      // Spotanim height/offset placement is supplied by the actor update,
      const offset=placement?.offset;
      if(offset)spot.mesh.position.set(offset.x,placement.height,offset.y);
      spot.mesh.rotation.y = ((placement?.rotation ?? spot.rotation) * Math.PI) / 1024;
  }`;
test("material groups address actual triangle indices rather than sequential vertices",()=>{
 const out=patchOcellusActorPresentation(fixture);
 const body=out.slice(0,out.indexOf("    this.updateSceneObjects"));
 const geometry={groups:[],addGroup(start,count,materialIndex){this.groups.push({start,count,materialIndex})}};
 new Function("payload","textureMaterial","geometry",body)({indices:[3,4,5,0,1,2],textureIds:[-1,-1,-1,215,215,215]},new Map([[215,1]]),geometry);
 assert.deepEqual(geometry.groups,[{start:0,count:3,materialIndex:1},{start:3,count:3,materialIndex:0}]);
});
test("placement updates on every draw even if the pose is cached",()=>{
 const out=patchOcellusActorPresentation(fixture);
 assert.match(out,/this.updateSceneObjects\([^\n]*\);\s*this.updateOcellusSpotPlacement\(\);/);
 const body=out.slice(out.indexOf("    for(const spot of this.spotAnims)"),out.indexOf("  private updateSpotAnimations")).trim().slice(0,-1);
 const p=[];const spot={mesh:{userData:{spotAnimId:7},position:{set(...args){p.push(args)}},rotation:{}},rotation:0};
 new Function(body).call({spotAnims:[spot],activeSpotAnims:[{id:7,offset:{x:2,y:3},height:4,rotation:512}]});
 assert.deepEqual(p,[[2,4,3]]);assert.equal(spot.mesh.rotation.y,Math.PI/2);
});
test("RGB is converted only when recolour changes; alpha always updates",()=>{
 const out=patchOcellusActorPresentation(fixture);
 const body=out.slice(out.indexOf("        const recolor="),out.indexOf("        color.needsUpdate=true;")+"        color.needsUpdate=true;".length).replaceAll(" as number[]","");
 const run=new Function("placement","spot","color","alphaValues","cacheColorToRgb","resolveCacheColor","cacheAlphaToOpacity",body);
 let conversions=0;const convert=v=>{conversions++;return [v,v,v]};const resolve=(base,face,recolor)=>recolor[face]??base;
 const spot={mesh:{userData:{cacheBaseColors:[1,2],cacheFaceColors:[4,4],cacheTextureIds:[-1,215]}}};const color={array:new Float32Array(8)};
 run({recolor:{4:3}},spot,color,[0,255],convert,resolve,a=>1-a/255);
 assert.deepEqual(Array.from(color.array),[3,3,3,1,2,2,2,0]);
 run({recolor:{4:3}},spot,color,[255,0],convert,resolve,a=>1-a/255);
 assert.equal(conversions,2);assert.deepEqual(Array.from(color.array),[3,3,3,0,2,2,2,1]);
 run({recolor:{4:5}},spot,color,[0,0],convert,resolve,a=>1-a/255);
 assert.equal(conversions,4);assert.equal(color.array[0],5);assert.equal(color.array[4],2);
 assert.throws(()=>patchOcellusActorPresentation(out),/anchor changed/);
});
