#!/usr/bin/env node
/** Separate guaranteed-opaque actor faces from static or potentially
 * animated alpha faces. Preserve the original ordered index runs. */
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
        payload.indices.every((index,i,indices)=>(rawAlphas[index]>0)===(rawAlphas[indices[i-i%3]]>0));
      // The player's shared sequences can modify face alpha on equipment.
      // Reserve every potentially affected vertex, even while its current
      // pose is fully opaque. This is a conservative per-loadout partition.
      const possibleAlpha=rawAlphas.map(a=>a>0);
      const untexturedPlayer=this.reference.kind==="player"&&hasVertexAlpha&&
        !payload.textureIds?.some(id=>id>=0)&&!!payload.indices?.length&&payload.indices.length%3===0;
      if(untexturedPlayer){
        const groups=new Set<number>();
        for(const animation of Object.values(payload.animations??{}))
          for(const frame of animation.rawFrames??[])
            frame.indexFrameIds.forEach((transform,i)=>{
              if(frame.types[transform]===5&&frame.x[i])
                for(const group of frame.maps[transform]??[])groups.add(group);
            });
        for(const group of groups)
          for(const vertex of payload.alphaGroups?.[group]??[])
            if(vertex>=0&&vertex<possibleAlpha.length)possibleAlpha[vertex]=true;
      }
      const splitPlayerAlpha=untexturedPlayer&&possibleAlpha.some(Boolean)&&possibleAlpha.some(a=>!a);
      const splitActorAlpha=splitBossAlpha||splitPlayerAlpha;`);
 replace("      if (hasVertexAlpha && !DRAW_CACHE_MODEL_WIREFRAME) enableVertexAlpha(materials[0]);",
   "      if (hasVertexAlpha && !splitActorAlpha && !DRAW_CACHE_MODEL_WIREFRAME) enableVertexAlpha(materials[0]);");
 replace("      const mesh = new THREE.Mesh(geometry, materials.length > 1 ? materials : materials[0]);",`      if(splitActorAlpha&&!DRAW_CACHE_MODEL_WIREFRAME){
        const translucent=materials[0].clone();
        enableVertexAlpha(translucent);
        // Static boss translucency need not write depth. Dynamic equipment
        // retains its existing depth behavior, including currently opaque
        // weapon faces that may fade in another native animation.
        if(splitBossAlpha)translucent.depthWrite=false;
        const alphaMaterial=materials.length;
        materials.push(translucent);
        geometry.clearGroups();
        const indices=payload.indices!;
        for(let start=0;start<indices.length;start+=3){
          const materialIndex=possibleAlpha[indices[start]]||possibleAlpha[indices[start+1]]||possibleAlpha[indices[start+2]]?alphaMaterial:0;
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
