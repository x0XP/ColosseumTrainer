#!/usr/bin/env node
/** Once a cache pool is loaded, draw its frame synchronously before WebGL
 * submits the scene. The pinned SDK's always-async path presents the prior
 * frame even when no asset loading is necessary. Ocellus-only SDK patch. */
import {readFileSync,writeFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
export function patchOcellusInstancedFrames(source){
 const start="    this.ensurePool()\n      .then((pool) => {";
 const end='      })\n      .catch((error) => console.error("[osrs-sdk] Cache render instance preload failed", error));';
 if(source.split(start).length!==2||source.split(end).length!==2)throw Error("Pinned SDK instanced frame anchor changed");
 return source.replace(start,"    const request=++this.ocellusDrawRequest;\n    const present = (pool: Pool) => {\n        if(request!==this.ocellusDrawRequest)return;").replace(end,`    };
    // Preserve the initial async allocation path and stale-instance guard.
    // Warm, already-owned pools must update before renderer.render().
    if (this.pool) present(this.pool);
    else void this.ensurePool().then(present)
      .catch((error) => console.error("[osrs-sdk] Cache render instance preload failed", error));`).replace("  private destroyed = false;","  private destroyed = false;\n  private ocellusDrawRequest=0;");
}
export function patchOcellusSpotAge(source){
 const options="  onSpotAnimComplete?: () => void;";
 const clock=`        if (oneShot && visible) {
          if (this.started) this.elapsed += Math.max(0, clockDelta);
          else this.started = true;
        } else {`;
 if(source.split(options).length!==2||source.split(clock).length!==2)throw Error("Pinned SDK spot age anchor changed");
 return source.replace(options,options+"\n  ocellusElapsed?: () => number;").replace(clock,`        if (oneShot && visible) {
          const age=this.options.ocellusElapsed?.();
          if(typeof age==="number"&&Number.isFinite(age)) {
            this.elapsed=Math.max(0,age);
            this.started=true;
          } else if (this.started) this.elapsed += Math.max(0, clockDelta);
          else this.started = true;
        } else if (!oneShot) {`);
}
/** Select the material queue using every posed frame, not just bind-pose
 * alpha. Native animated fixture 62739 has 474 initially opaque vertices
 * but all 64 poses change transparency. Keep genuinely opaque pools opaque. */
export function patchOcellusPosedAlpha(source){
 const frameBlock=`        const frameData = posedFrames(
          payload.positions,
          baseAlphas,
          groups,
          sources,
          alphaGroups,
          payload.animayaGroups ?? [],
          payload.animayaScales ?? [],
          animation,
        );
`;
 const options="        const materialOptions = {";
 const transparency="          transparent: Boolean(payload.alphas?.some((alpha) => alpha !== 0)),";
 for(const anchor of [frameBlock,options,transparency])if(source.split(anchor).length!==2)throw Error("Pinned SDK posed alpha anchor changed");
 return source.replace(frameBlock,"").replace(options,frameBlock+options).replace(transparency,
   "          transparent: frameData.some((frame) => frame.alphas.some((alpha) => alpha !== 0)),");
}
/** Explicit native looping for the mature fragment only. Keep the
 * spot graphic's world basis and per-instance clock, not the scenery clock. */
export function patchOcellusSpotLoop(source){
 let next=source;
 const replace=(a,b)=>{if(next.split(a).length!==2)throw Error("Pinned SDK spot loop anchor changed: "+a);next=next.replace(a,b);};
 replace("  ocellusElapsed?: () => number;","  ocellusElapsed?: () => number;\n  ocellusLoop?: boolean;");
 replace('        const oneShot = this.reference.kind === "spotAnim";',
   '        const oneShot = this.reference.kind === "spotAnim";\n        const nativeLoop=oneShot&&this.options.ocellusLoop===true;');
 replace("sampleAnimation(pool.animation, animationTime, !oneShot)","sampleAnimation(pool.animation, animationTime, !oneShot||nativeLoop)");
 replace("          oneShot &&\n          animationTime >= 0 &&","          oneShot && !nativeLoop &&\n          animationTime >= 0 &&");
 replace("              Math.min(animationTime, pool.animationTotal),\n              false,","              nativeLoop?animationTime:Math.min(animationTime, pool.animationTotal),\n              nativeLoop,");
 return next;
}
/** The pool uses baked BasicMaterial lighting. Preserve the actual indexed
 * texture assignment, share static UVs, and submit only occupied slot ranges. */
export function patchOcellusInstanceGeometry(source){
 let next=source;
 const replace=(a,b)=>{if(next.split(a).length!==2)throw Error("Pinned SDK instance geometry anchor changed: "+a);next=next.replace(a,b);};
 replace("const split = splitTexturedFaces(payload.textureIds, indices, available);",
   "const split = splitTexturedFaces(payload.textureIds&&indices.map(index=>payload.textureIds![index]??-1), indices, available);");
 replace("        pool!.frames = frameData.map((frame) => {",
 `        const uv = uvs ? new THREE.Float32BufferAttribute(uvs,2) : null;
        // RGB and texture coordinates are invariant across native poses.
        // Convert cache display RGB once; alpha is still sampled per frame.
        const rgbaBase=payload.colors&&payload.colors.length*3===payload.positions.length
          ? new Float32Array(cacheColorsToRgba(payload.colors,baseAlphas,spotPayload?.faceColors,recolor)):null;
        pool!.frames = frameData.map((frame) => {`);
 replace(`          const colors =
            payload.colors && payload.colors.length * 3 === payload.positions.length
              ? cacheColorsToRgba(payload.colors, frame.alphas, spotPayload?.faceColors, recolor)
              : null;`,`          const colors=rgbaBase?.slice()??null;
          if(colors)for(let i=0;i<frame.alphas.length;i++)
            colors[i*4+3]=cacheAlphaToOpacity(frame.alphas[i]);`);
 replace("import { cacheColorsToRgba, normalizeCacheAlpha }","import { cacheColorsToRgba, normalizeCacheAlpha, cacheAlphaToOpacity }");
 replace("          const uv = uvs ? new THREE.Float32BufferAttribute(uvs, 2) : null;\n","");
 replace("            geometry.computeVertexNormals();\n","            // MeshBasicMaterial consumes baked colours, not normals.\n");
 replace("function drawsOf(frame: AnimationFrameMesh)","function activeSlotCount(active: Set<number>) {\n  let count=0;\n  active.forEach(slot=>{count=Math.max(count,slot+1);});\n  return count;\n}\nfunction drawsOf(frame: AnimationFrameMesh)");
 replace("        previous.active.delete(this.slot);","        previous.active.delete(this.slot);\n        const count=activeSlotCount(previous.active);\n        for(const mesh of drawsOf(previous))mesh.count=count;");
 replace("      mesh.count = pool.next;","      mesh.count = activeSlotCount(bucket.active);");
 return next;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const file=process.argv[2];if(!file)throw Error("Expected SDK CacheRenderInstancedModel.ts");
 writeFileSync(file,patchOcellusInstanceGeometry(patchOcellusSpotLoop(patchOcellusPosedAlpha(patchOcellusSpotAge(patchOcellusInstancedFrames(readFileSync(file,"utf8")))))));
}
