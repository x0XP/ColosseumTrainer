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
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const file=process.argv[2];if(!file)throw Error("Expected SDK CacheRenderInstancedModel.ts");
 writeFileSync(file,patchOcellusInstancedFrames(readFileSync(file,"utf8")));
}
