#!/usr/bin/env node
/** Ocellus-only actor presentation: separate placement from animation
 * sampling, preserve triangle material order, and cache immutable RGB. */
import {readFileSync,writeFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
export function patchOcellusActorPresentation(source){
 let next=source;
 const replace=(a,b)=>{if(next.split(a).length!==2)throw Error("Pinned SDK actor presentation anchor changed: "+a);next=next.replace(a,b);};
 replace(`        for (let vertex = 0; vertex < payload.textureIds.length; vertex += 3) {
          const materialIndex = textureMaterial.get(payload.textureIds[vertex]) ?? 0;
          const run = geometry.groups[geometry.groups.length - 1];
          if (run?.materialIndex === materialIndex) run.count += 3;
          else geometry.addGroup(vertex, 3, materialIndex);
        }`,`        const indices=payload.indices??[];
        for(let start=0;start<indices.length;start+=3){
          const materialIndex=textureMaterial.get(payload.textureIds[indices[start]])??0;
          const run=geometry.groups[geometry.groups.length-1];
          if(run?.materialIndex===materialIndex)run.count+=3;
          else geometry.addGroup(start,3,materialIndex);
        }`);
 const placementStart="      // Spotanim height/offset placement is supplied by the actor update,";
 const placementEnd="      spot.mesh.rotation.y = ((placement?.rotation ?? spot.rotation) * Math.PI) / 1024;";
 const start=next.indexOf(placementStart),end=next.indexOf(placementEnd);
 if(start<0||end<start||next.split(placementEnd).length!==2)throw Error("Pinned SDK graphic placement anchor changed");
 // Cache NPC scale is inherited by children. The effect mesh already
 // compensates its own scale; world-space placement must compensate too.
 const placementBody=`      const offset=placement?.offset;
      const yaw=this.root.rotation.y;
      const cos=Math.cos(yaw),sin=Math.sin(yaw);
      const sx=this.root.scale.x,sy=this.root.scale.y,sz=this.root.scale.z;
      const height=placement?.height??spot.height;
      spot.mesh.position.set(
        (cos*(offset?.x??0)-sin*(offset?.y??0))/sx,
        height/sy,
        (sin*(offset?.x??0)+cos*(offset?.y??0))/sz,
      );
      spot.mesh.rotation.y = ((placement?.rotation ?? spot.rotation) * Math.PI) / 1024;`;
 next=next.slice(0,start)+next.slice(end+placementEnd.length);
 replace("  private updateSpotAnimations(clockDelta:",`  private updateOcellusSpotPlacement() {
    for(const spot of this.spotAnims){
      const placement=this.activeSpotAnims.find(p=>p.id===spot.mesh.userData.spotAnimId);
      if(!placement)continue;
`+placementBody+`
    }
  }
  private updateSpotAnimations(clockDelta:`);
 replace("    this.updateSceneObjects(scene, location, rotation, pitch, visible, modelOffsets);",
   "    this.updateSceneObjects(scene, location, rotation, pitch, visible, modelOffsets);\n    this.updateOcellusSpotPlacement();");
 // The texture patch has already installed its native untextured-only recolour.
 const rgbStart="        const recolor = placement?.recolor ?? {};";
 const rgbEnd="        color.needsUpdate = true;";
 const a=next.indexOf(rgbStart),b=next.indexOf(rgbEnd,a);
 if(a<0||b<a||next.split(rgbStart).length!==2)throw Error("Pinned SDK graphic colour anchor changed");
 const old=next.slice(a,b+rgbEnd.length);
 const replacement=`        const recolor=placement?.recolor??{};
        const key=JSON.stringify(Object.entries(recolor).sort(([a],[b])=>a.localeCompare(b)));
        const rgbChanged=spot.mesh.userData.ocellusRgbKey!==key;
        const baseColors=spot.mesh.userData.cacheBaseColors as number[];
        const faceColors=spot.mesh.userData.cacheFaceColors as number[];
        const textureIds=spot.mesh.userData.cacheTextureIds as number[];
        for(let i=0;i<alphaValues.length;i++){
          if(rgbChanged&&baseColors[i]!=null){
            const rgb=cacheColorToRgb(textureIds[i]>=0?baseColors[i]:resolveCacheColor(baseColors[i],faceColors[i],recolor));
            color.array[i*4]=rgb[0];color.array[i*4+1]=rgb[1];color.array[i*4+2]=rgb[2];
          }
          color.array[i*4+3]=cacheAlphaToOpacity(alphaValues[i]);
        }
        spot.mesh.userData.ocellusRgbKey=key;
        color.needsUpdate=true;`;
 replace(old,replacement);
 // Before the first client cycle a newly loaded mesh is already visible.
 // Present its native first frame instead of showing the unposed geometry.
 replace("    if (!this.mesh || this.meshGeneration !== this.modelGeneration || this.lastPose < 0) return;",
 `    if(!this.mesh||this.meshGeneration!==this.modelGeneration)return;
    if(this.lastPose<0){
      const pose=this.renderable.animationIndex;
      if(!this.animationPlaying)this.activeAnimation=this.poseMap[String(pose)]??pose;
      this.presentActorAnimation(pose,0);
      this.updateSpotAnimations(0,null,0);
      return;
    }`);
 return next;
}

/** The SDK originally keyed attached meshes by asset and sounds by
 * animation ID. Preserve independent channels, including two instances
 * of the same graphic, and restart only the replaced channel. */
export function patchOcellusSpotChannels(source){
 let next=source;
 const replace=(a,b)=>{if(next.split(a).length!==2)throw Error("Pinned SDK spot channel anchor changed: "+a);next=next.replace(a,b);};
 replace("  assetId: string;\n  interpolatedMayaFrame:", "  assetId: string;\n  channel: string;\n  interpolatedMayaFrame:");
 replace("  private spotFrameSoundPlayers = new Map<number, AnimationFrameSoundPlayer>();",
   "  private spotFrameSoundPlayers = new Map<string, AnimationFrameSoundPlayer>();");
 replace("      placements.set(channel, spotAnim);",`      placements.set(channel, spotAnim);
      if(previous!==spotAnim)this.spotFrameSoundPlayers.get(channel)?.reset();`);
 replace("    this.activeSpotAnims = spotAnims.slice();",`    for(const channel of this.spotFrameSoundPlayers.keys()){
      if(!placements.has(channel))this.spotFrameSoundPlayers.delete(channel);
    }
    this.activeSpotAnims = spotAnims.slice();`);
 replace(`    const attached = this.activeSpotAnims.map((spotAnim) => spotAnim.id);
    this.spotAnimPayloads.forEach((spotPayload, assetId) => {
      if (this.spotAnims.some((spot) => spot.assetId === assetId)) return;
      if (this.reference.kind !== "spotAnim" && attached.indexOf(spotPayload.spotAnim?.id) < 0) return;`,
 `    // Retire removed or replaced meshes; persistent channels retain their
    // geometry and native pose workspace across an actor equipment change.
    const retired=this.spotAnims.filter(spot=>this.spotAnimPlacements.get(spot.channel)?.id!==spot.mesh.userData.spotAnimId);
    this.spotAnims=this.spotAnims.filter(spot=>!retired.includes(spot));
    if(retired.length)this.retire(retired.map(spot=>spot.mesh));
    this.spotAnimPayloads.forEach((spotPayload, assetId) => {
      const matching=this.activeSpotAnims.filter(placement=>placement.id===spotPayload.spotAnim?.id);
      for(const placement of matching){
      const channel=spotAnimChannel(placement);
      if(this.spotAnims.some(spot=>spot.assetId===assetId&&spot.channel===channel))continue;`);
 replace("      const placement = this.activeSpotAnims.filter((spotAnim) => spotAnim.id === metadata.id)[0];","      effect.userData.spotAnimChannel=channel;");
 replace("        assetId,\n        interpolatedMayaFrame:", "        assetId,\n        channel,\n        interpolatedMayaFrame:");
 replace("      this.spotAnims.push(spot);\n    });","      this.spotAnims.push(spot);\n      }\n    });");
 replace("const placement=this.activeSpotAnims.find(p=>p.id===spot.mesh.userData.spotAnimId);",
  "const placement=this.spotAnimPlacements.get(spot.channel);");
 replace("const placement = this.activeSpotAnims.filter((spotAnim) => spotAnim.id === spot.mesh.userData.spotAnimId)[0];",
  "const placement = this.spotAnimPlacements.get(spot.channel);");
 replace("this.spotFrameSoundPlayers.get(spotAnimationId)","this.spotFrameSoundPlayers.get(spot.channel)");
 replace("this.spotFrameSoundPlayers.set(spotAnimationId, spotSoundPlayer)","this.spotFrameSoundPlayers.set(spot.channel, spotSoundPlayer)");
 replace("    this.spotAnims=[];\n    this.spotAnimPayloads.clear();","    this.spotAnims=[];\n    this.spotFrameSoundPlayers.clear();\n    this.spotAnimPayloads.clear();");
 return next;
}


/** Attached effects use their own client-cycle clock. An asynchronous
 * equipment rebuild may freeze the old base pose, never its graphics. */
export function patchOcellusIndependentEffectClock(source){
 let next=source;
 const replace=(a,b)=>{if(next.split(a).length!==2)throw Error("Pinned SDK effect clock anchor changed: "+a);next=next.replace(a,b);};
 replace(`    if(!this.mesh||this.meshGeneration!==this.modelGeneration)return;
    if(this.lastPose<0){`,`    if(!this.mesh||this.meshGeneration!==this.modelGeneration){
      // A previously presented actor can still own live graphics while
      // its replacement equipment is loading.
      const fraction=Settings.smoothCacheAnimations?Math.max(0,Math.min(1,clientTickFraction)):0;
      this.updateSpotAnimations(0,null,fraction/CLIENT_CYCLES_PER_SECOND);
      return;
    }
    if(this.lastPose<0){`);
 replace(`    // Loading and equipment swaps must not consume animation time on an old mesh.
    if (!this.mesh || this.meshGeneration !== this.modelGeneration) return;
    const location = this.renderable.getTrueLocation();
    const size = this.renderable.size;
    const soundLocation = { x: location.x + (size - 1) / 2, y: location.y - (size - 1) / 2 };`,`    const location = this.renderable.getTrueLocation();
    const size = this.renderable.size;
    const soundLocation = { x: location.x + (size - 1) / 2, y: location.y - (size - 1) / 2 };
    // Do not advance the retired actor pose, but keep independent spot
    // graphics on the same client clock throughout an equipment change.
    if(!this.mesh||this.meshGeneration!==this.modelGeneration){
      this.updateSpotAnimations(1/CLIENT_CYCLES_PER_SECOND,soundLocation);
      return;
    }`);
 // Actor-attached one-shots are not supposed to show an extra fractional
 // frame after their native sequence has ended.
 replace("        (looping ? total > 0 : effectTime < total) &&",
   "        (looping ? total > 0 : effectTime + Math.max(0,renderOffset) < total) &&");
 return next;
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
 const file=process.argv[2];if(!file)throw Error("Expected SDK CacheRenderModel.ts");
 writeFileSync(file,patchOcellusIndependentEffectClock(patchOcellusSpotChannels(patchOcellusActorPresentation(readFileSync(file,"utf8")))));
}
