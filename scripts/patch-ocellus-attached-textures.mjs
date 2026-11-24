#!/usr/bin/env node
/** Native attached graphics use cache texture UVs and the authored index
 * order. Restrict this change to the temporary Ocellus SDK checkout. */
import {readFileSync,writeFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
/** Only known attached Ocellus assets whose textures are opaque are
 * eligible. A type-5 transform can change alpha even on a base-opaque face. */
export function partitionAttachedAlpha(payload,alphas){
 const id=payload.spotAnim?.id;
 if(![4274,4275,4276,4306,4328,4329,4330].includes(id))return null;
 if(payload.textureIds?.some(t=>t>=0&&t!==215))return null;
 if(payload.textureIds?.some(t=>t===215)){
  const pixels=payload.textures?.["215"]?.pixels;
  if(!pixels?.length||!pixels.every(p=>Number.isInteger(p)&&(p>>>24)===255))return null;
 }
 const vertices=payload.positions.length/3;
 if(!Number.isInteger(vertices)||vertices<=0||alphas.length!==vertices)return null;
 // A missing or invalid base-alpha value is not proof of opacity.
 for(let i=0;i<vertices;i++)if(!Number.isFinite(alphas[i]))return null;
 const groups=new Set();
 for(const animation of Object.values(payload.animations??{}))
  for(const frame of animation.rawFrames??[])
   frame.indexFrameIds.forEach((transform,i)=>{
    if(frame.types[transform]===5&&frame.x[i])
     for(const group of frame.maps[transform]??[])groups.add(group);
   });
 const possible=alphas.map(a=>a!==0);
 for(const group of groups)for(const vertex of payload.alphaGroups?.[group]??[])
  if(vertex>=0&&vertex<possible.length)possible[vertex]=true;
 return possible;
}
export function patchOcellusAttachedTextures(source){
 const original=`      geometry.setIndex(spotPayload.indices ?? []);
      const effect = new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({
          color: spotPayload.color ?? 0xffffff,
          vertexColors: Boolean(spotPayload.colors?.length),
          transparent: true,
          wireframe: DRAW_CACHE_MODEL_WIREFRAME,
        }),
      );`;
 const replacement=`      const indices=spotPayload.indices??[];
      geometry.setIndex(indices);
      if(spotPayload.uvs?.length===spotPayload.positions.length/3*2)
        geometry.setAttribute("uv",new THREE.Float32BufferAttribute(spotPayload.uvs,2));
      const options={
        color:spotPayload.color??0xffffff,
        vertexColors:Boolean(spotPayload.colors?.length),
        transparent:true,
        alphaTest:.01,
        wireframe:DRAW_CACHE_MODEL_WIREFRAME,
      };
      const materials:THREE.MeshBasicMaterial[]=[new THREE.MeshBasicMaterial(options)];
      const textureMaterial=new Map<number,number>();
      textureImages(spotPayload.textures).forEach((image,id)=>{
        textureMaterial.set(id,materials.length);
        materials.push(new THREE.MeshBasicMaterial({...options,map:image}));
      });
      // Use exactly the verified partition algorithm, embedded into the
      // temporary SDK with its payload type inferred at the call site.
      const possibleAlpha=(${partitionAttachedAlpha.toString().replace("function partitionAttachedAlpha(payload,alphas)","function partitionAttachedAlpha(payload: typeof spotPayload,alphas: number[])").replace("new Set()","new Set<number>()")})(spotPayload,spotAlphas);
      // A validated translucent pass must not occlude another effect
      // with its depth buffer. Proven solid faces receive separate
      // opaque materials with depth writes restored below.
      if(possibleAlpha)for(const material of materials)material.depthWrite=false;
      const opaqueMaterials=new Map<number,number>();
      if(textureMaterial.size||possibleAlpha){
        geometry.clearGroups();
        for(let start=0;start<indices.length;start+=3){
          const id=spotPayload.textureIds?.[indices[start]]??-1;
          let materialIndex=textureMaterial.get(id)??0;
          if(possibleAlpha&&(id<0||textureMaterial.has(id))&&possibleAlpha[indices[start]]===false&&possibleAlpha[indices[start+1]]===false&&possibleAlpha[indices[start+2]]===false){
            let opaque=opaqueMaterials.get(materialIndex);
            if(opaque===undefined){
              const solid=materials[materialIndex].clone();
              solid.transparent=false;
              solid.depthWrite=true;
              opaque=materials.length;
              materials.push(solid);
              opaqueMaterials.set(materialIndex,opaque);
            }
            materialIndex=opaque;
          }
          const run=geometry.groups[geometry.groups.length-1];
          if(run?.materialIndex===materialIndex)run.count+=3;
          else geometry.addGroup(start,3,materialIndex);
        }
      }
      const effect=new THREE.Mesh(geometry,materials.length>1?materials:materials[0]);
      // Original posed geometry can extend outside the bind-pose bounds.
      effect.frustumCulled=false;
      effect.userData.cacheTextureIds=spotPayload.textureIds??[];`;
 const rgb="            const rgb = cacheColorToRgb(resolveCacheColor(baseColors[i], faceColors[i], recolor));";
 const newRgb=`            // Recolour untextured transition core faces only. The same
            // cache face colour also occurs on the star-textured faces.
            const textured=(spot.mesh.userData.cacheTextureIds as number[])[i]>=0;
            const rgb=cacheColorToRgb(textured?baseColors[i]:resolveCacheColor(baseColors[i],faceColors[i],recolor));`;
 for(const a of [original,rgb])if(source.split(a).length!==2)throw Error("Pinned SDK attached texture anchor changed");
 return source.replace(original,replacement).replace(rgb,newRgb);
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const file=process.argv[2];if(!file)throw Error("Expected CacheRenderModel.ts");
 writeFileSync(file,patchOcellusAttachedTextures(readFileSync(file,"utf8")));
}
