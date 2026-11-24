#!/usr/bin/env node
/** Native attached graphics use cache texture UVs and the authored index
 * order. Restrict this change to the temporary Ocellus SDK checkout. */
import {readFileSync,writeFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
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
      if(textureMaterial.size){
        geometry.clearGroups();
        for(let start=0;start<indices.length;start+=3){
          const id=spotPayload.textureIds?.[indices[start]]??-1;
          const materialIndex=textureMaterial.get(id)??0;
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
