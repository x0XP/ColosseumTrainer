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

/** Reclassify the small Rift mesh using its CURRENT native posed opacity,
 * not the bind pose or all-sequences maximum. Preserve original index runs. */
export function riftAlphaRuns(indices,opacity,alphaMaterial){
 const runs=[];
 for(let start=0;start<indices.length;start+=3){
  const opaque=start+2<indices.length&&[indices[start],indices[start+1],indices[start+2]].every(i=>Number.isInteger(i)&&i>=0&&i<opacity.length&&opacity[i]===1);
  const materialIndex=opaque?0:alphaMaterial;
  const last=runs[runs.length-1];
  if(last&&last.materialIndex===materialIndex)last.count+=3;
  else runs.push({start,count:Math.min(3,indices.length-start),materialIndex});
 }
 return runs;
}
export function patchOcellusRiftAlpha(source){
 let next=source;
 const replace=(a,b)=>{if(next.split(a).length!==2)throw Error("Pinned SDK Rift alpha anchor changed: "+a);next=next.replace(a,b);};
 replace("      const splitActorAlpha=splitBossAlpha||splitPlayerAlpha;",
 `      const splitRiftAlpha=this.reference.kind==="npc"&&this.reference.definitionId===16678&&hasVertexAlpha&&
        !payload.textureIds?.some(id=>id>=0)&&!!payload.indices?.length&&payload.indices.length%3===0;
      const splitActorAlpha=splitBossAlpha||splitPlayerAlpha||splitRiftAlpha;`);
 replace("        if(splitBossAlpha)translucent.depthWrite=false;","        if(splitBossAlpha||splitRiftAlpha)translucent.depthWrite=false;");
 replace("      const mesh = new THREE.Mesh(geometry, materials.length > 1 ? materials : materials[0]);",
 `      const mesh = new THREE.Mesh(geometry, materials.length > 1 ? materials : materials[0]);
      if(splitRiftAlpha&&!DRAW_CACHE_MODEL_WIREFRAME)mesh.userData.ocellusRiftAlphaMaterial=materials.length-1;`);
 replace("        // MeshBasicMaterial uses the cache's baked colours; posed normals are unused.",
 `        const alphaMaterial=this.mesh?.userData.ocellusRiftAlphaMaterial;
        if(typeof alphaMaterial==="number"&&cacheAlpha&&this.mesh){
          const index=this.mesh.geometry.getIndex();
          if(index){
            const runs=(${riftAlphaRuns.toString().replace("function riftAlphaRuns(indices,opacity,alphaMaterial)","function riftAlphaRuns(indices:ArrayLike<number>,opacity:ArrayLike<number>,alphaMaterial:number)").replace("const runs=[];","const runs:Array<{start:number;count:number;materialIndex:number}>=[];")})(index.array,cacheAlpha.array,alphaMaterial);
            const geometry=this.mesh.geometry,old=geometry.groups;
            if(old.length!==runs.length||runs.some((run,i)=>old[i].start!==run.start||old[i].count!==run.count||old[i].materialIndex!==run.materialIndex)){
              geometry.clearGroups();
              for(const run of runs)geometry.addGroup(run.start,run.count,run.materialIndex);
            }
          }
        }
        // MeshBasicMaterial uses the cache's baked colours; posed normals are unused.`);
 return next;
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
 const file=process.argv[2];if(!file)throw Error("Expected CacheRenderModel.ts");
 writeFileSync(file,patchOcellusRiftAlpha(patchOcellusBossAlpha(readFileSync(file,"utf8"))));
}
