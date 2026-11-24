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
 const placementBody=next.slice(start,end+placementEnd.length);
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
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const file=process.argv[2];if(!file)throw Error("Expected SDK CacheRenderModel.ts");
 writeFileSync(file,patchOcellusActorPresentation(readFileSync(file,"utf8")));
}
