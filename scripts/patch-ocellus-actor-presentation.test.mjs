import {test} from "node:test";
import assert from "node:assert/strict";
import {patchOcellusActorPresentation,patchOcellusSpotChannels} from "./patch-ocellus-actor-presentation.mjs";
const fixture=`        for (let vertex = 0; vertex < payload.textureIds.length; vertex += 3) {
          const materialIndex = textureMaterial.get(payload.textureIds[vertex]) ?? 0;
          const run = geometry.groups[geometry.groups.length - 1];
          if (run?.materialIndex === materialIndex) run.count += 3;
          else geometry.addGroup(vertex, 3, materialIndex);
        }
    this.updateSceneObjects(scene, location, rotation, pitch, visible, modelOffsets);
    if (!this.mesh || this.meshGeneration !== this.modelGeneration || this.lastPose < 0) return;
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
 new Function(body).call({spotAnims:[spot],activeSpotAnims:[{id:7,offset:{x:2,y:3},height:4,rotation:512}],root:{rotation:{y:0},scale:{x:1,y:1,z:1}}});
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

test("first render presents the native pose without consuming a client cycle or replacing an active one-shot",()=>{
 const out=patchOcellusActorPresentation(fixture);
 const body=out.slice(out.indexOf("    if(!this.mesh||"),out.indexOf("  private updateOcellusSpotPlacement"));
 const render=new Function(body);
 const calls=[];
 const model={mesh:{},meshGeneration:2,modelGeneration:2,lastPose:-1,animationPlaying:false,poseMap:{3:819},renderable:{animationIndex:3},activeAnimation:-1,animationTime:0,presentActorAnimation(...a){calls.push(a)},updateSpotAnimations(...a){calls.push(a)}};
 render.call(model);assert.equal(model.activeAnimation,819);assert.deepEqual(calls,[[3,0],[0,null,0]]);assert.equal(model.lastPose,-1);assert.equal(model.animationTime,0);
 model.animationPlaying=true;model.activeAnimation=14896;render.call(model);assert.equal(model.activeAnimation,14896);
 model.meshGeneration=1;render.call(model);assert.equal(calls.length,4);
});

test("attached world offsets are not shrunk by native boss or Rift model scale",()=>{
 const out=patchOcellusActorPresentation(fixture);
 const body=out.slice(out.indexOf("    for(const spot of this.spotAnims)"),out.indexOf("  private updateSpotAnimations")).trim().slice(0,-1);
 const place=new Function(body);
 for(const s of [83/128,96/128,1]){
  for(const yaw of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
   let position;
   const spot={mesh:{userData:{spotAnimId:7},position:{set(...args){position=args;}},rotation:{}},rotation:0,height:.25};
   place.call({spotAnims:[spot],activeSpotAnims:[{id:7,offset:{x:.5,y:-.25},height:.75}],root:{rotation:{y:yaw},scale:{x:s,y:s,z:s}}});
   const [x,y,z]=position.map(v=>v*s);
   const worldX=Math.cos(yaw)*x+Math.sin(yaw)*z;
   const worldZ=-Math.sin(yaw)*x+Math.cos(yaw)*z;
   assert.ok(Math.abs(worldX-.5)<1e-10);
   assert.ok(Math.abs(worldZ+.25)<1e-10);
   assert.ok(Math.abs(y-.75)<1e-10);
   place.call({spotAnims:[spot],activeSpotAnims:[{id:7}],root:{rotation:{y:yaw},scale:{x:s,y:s,z:s}}});
   assert.ok(Math.abs(position[1]*s-.25)<1e-10);
  }
 }
});

const channelFixture=`type SpotAnimRuntime={
  assetId: string;
  interpolatedMayaFrame: any;
};
class Model{
  private spotFrameSoundPlayers = new Map<number, AnimationFrameSoundPlayer>();
  spotAnims=[];activeSpotAnims=[];spotAnimPlacements=new Map();spotAnimPayloads=new Map();retired=[];
  reference={kind:"npc"};
  setActiveSpotAnims(spotAnims){
    const placements=new Map();
    spotAnims.forEach(spotAnim=>{
      const channel=spotAnimChannel(spotAnim);
      const previous=this.spotAnimPlacements.get(channel);
      placements.set(channel, spotAnim);
    });
    this.activeSpotAnims = spotAnims.slice();
    this.spotAnimPlacements=placements;
    this.buildSpotAnims();
  }
  retire(meshes){this.retired.push(...meshes);}
  private buildSpotAnims() {
    const attached = this.activeSpotAnims.map((spotAnim) => spotAnim.id);
    this.spotAnimPayloads.forEach((spotPayload, assetId) => {
      if (this.spotAnims.some((spot) => spot.assetId === assetId)) return;
      if (this.reference.kind !== "spotAnim" && attached.indexOf(spotPayload.spotAnim?.id) < 0) return;
      const metadata=spotPayload.spotAnim;
      const effect={userData:{spotAnimId:metadata.id}};
      const placement = this.activeSpotAnims.filter((spotAnim) => spotAnim.id === metadata.id)[0];
      const spot={
        assetId,
        interpolatedMayaFrame: [],
        mesh:effect,
      };
      this.spotAnims.push(spot);
    });
  }
  placement(spot){
      const placement=this.activeSpotAnims.find(p=>p.id===spot.mesh.userData.spotAnimId);
      return placement;
  }
  sound(spot,spotAnimationId){
      const placement = this.activeSpotAnims.filter((spotAnim) => spotAnim.id === spot.mesh.userData.spotAnimId)[0];
      let spotSoundPlayer=this.spotFrameSoundPlayers.get(spotAnimationId);
      if(!spotSoundPlayer){spotSoundPlayer={resets:0,reset(){this.resets++}};this.spotFrameSoundPlayers.set(spotAnimationId, spotSoundPlayer);}
      return [placement,spotSoundPlayer];
  }
  destroy(){
    this.spotAnims=[];
    this.spotAnimPayloads.clear();
  }
}`;
function channelHarness(){
 const out=patchOcellusSpotChannels(channelFixture);
 const js=out.slice(out.indexOf("class Model")).replaceAll("private ","").replace("new Map<string, AnimationFrameSoundPlayer>()","new Map()");
 const Model=new Function("spotAnimChannel",js+";return Model")(spot=>spot.channel??String(spot.id));
 const m=new Model();m.spotAnimPayloads.set("effect7",{spotAnim:{id:7}});m.spotAnimPayloads.set("effect8",{spotAnim:{id:8}});return m;
}
test("two copies of a native attached graphic retain independent channel placement and sound",()=>{
 const m=channelHarness(),a={id:7,channel:"a",height:.5},b={id:7,channel:"b",height:1};
 m.setActiveSpotAnims([a,b]);assert.equal(m.spotAnims.length,2);
 const [first,second]=m.spotAnims;
 assert.equal(m.placement(first),a);assert.equal(m.placement(second),b);
 const [,soundA]=m.sound(first,100),[,soundB]=m.sound(second,100);
 assert.notEqual(soundA,soundB);
 m.setActiveSpotAnims([{...a},b]);assert.equal(m.spotAnims[0],first);assert.equal(soundA.resets,1);assert.equal(soundB.resets,0);
 m.setActiveSpotAnims([b]);assert.deepEqual(m.spotAnims,[second]);assert.deepEqual(m.retired,[first.mesh]);assert.equal(m.spotFrameSoundPlayers.has("a"),false);
 m.setActiveSpotAnims([{id:8,channel:"b"}]);assert.equal(m.spotAnims.length,1);assert.equal(m.spotAnims[0].assetId,"effect8");assert.equal(m.retired.length,2);
 m.destroy();assert.equal(m.spotFrameSoundPlayers.size,0);
 assert.throws(()=>patchOcellusSpotChannels(patchOcellusSpotChannels(channelFixture)),/anchor changed/);
});
