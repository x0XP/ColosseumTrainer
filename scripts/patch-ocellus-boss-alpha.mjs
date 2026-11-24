#!/usr/bin/env node
/** Separate the verified static, untextured Ocellus alpha faces from
 * the opaque actor surface. Preserve the original ordered index runs. */
import {readFileSync,writeFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
export function patchOcellusBossAlpha(source){
 let next=source;
 const replace=(a,b)=>{if(next.split(a).length!==2)throw Error("Pinned SDK boss alpha anchor changed: "+a);next=next.replace(a,b);};
 replace("      const hasVertexAlpha = needsVertexAlpha(payload);",`      const hasVertexAlpha = needsVertexAlpha(payload);
      const splitBossAlpha=this.reference.kind==="npc"&&this.reference.definitionId===16677&&
        hasVertexAlpha&&rawAlphas.some(a=>a===0)&&rawAlphas.some(a=>a>0)&&
        !payload.textureIds?.some(id=>id>=0)&&
        !Object.values(payload.animations??{}).some(a=>a.rawFrames?.some(f=>f.types.includes(5)))&&
        !!payload.indices?.length&&payload.indices.length%3===0&&
        payload.indices.every((index,i,indices)=>(rawAlphas[index]>0)===(rawAlphas[indices[i-i%3]]>0));`);
 replace("      if (hasVertexAlpha && !DRAW_CACHE_MODEL_WIREFRAME) enableVertexAlpha(materials[0]);",
   "      if (hasVertexAlpha && !splitBossAlpha && !DRAW_CACHE_MODEL_WIREFRAME) enableVertexAlpha(materials[0]);");
 replace("      const mesh = new THREE.Mesh(geometry, materials.length > 1 ? materials : materials[0]);",`      if(splitBossAlpha&&!DRAW_CACHE_MODEL_WIREFRAME){
        const translucent=materials[0].clone();
        enableVertexAlpha(translucent);
        // Only solid faces write depth. The original cache order remains
        // intact within each pass; do not add synthetic geometry.
        translucent.depthWrite=false;
        const alphaMaterial=materials.length;
        materials.push(translucent);
        geometry.clearGroups();
        const indices=payload.indices!;
        for(let start=0;start<indices.length;start+=3){
          const materialIndex=rawAlphas[indices[start]]>0?alphaMaterial:0;
          const run=geometry.groups[geometry.groups.length-1];
          if(run?.materialIndex===materialIndex)run.count+=3;
          else geometry.addGroup(start,3,materialIndex);
        }
      }
      const mesh = new THREE.Mesh(geometry, materials.length > 1 ? materials : materials[0]);`);
 return next;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const file=process.argv[2];if(!file)throw Error("Expected CacheRenderModel.ts");
 writeFileSync(file,patchOcellusBossAlpha(readFileSync(file,"utf8")));
}
