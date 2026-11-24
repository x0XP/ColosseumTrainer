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
 return source.replace(start,"    const present = (pool: Pool) => {").replace(end,`    };
    // Preserve the initial async allocation path and stale-instance guard.
    // Warm, already-owned pools must update before renderer.render().
    if (this.pool) present(this.pool);
    else void this.ensurePool().then(present)
      .catch((error) => console.error("[osrs-sdk] Cache render instance preload failed", error));`);
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
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const file=process.argv[2];if(!file)throw Error("Expected SDK CacheRenderInstancedModel.ts");
 writeFileSync(file,patchOcellusSpotAge(patchOcellusInstancedFrames(readFileSync(file,"utf8"))));
}
