#!/usr/bin/env node
/** Ocellus-only canvas HUD framing. Preserve the pinned SDK's authentic
 * boss bar artwork and health calculation, relocating it away from the
 * central raised boss. Narrow canvases retain a legible bounded width. */
import {readFileSync,writeFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
export function ocellusBossBarWidth(viewportWidth,maxWidth){
 return Math.max(0,Math.min(maxWidth,viewportWidth-16,Math.max(150,viewportWidth-210)));
}
export function patchOcellusBossBar(source){
 const anchor=`    const width = Math.min(BOSS_BAR_WIDTH, viewportWidth - 16);
    const centeredX = (viewportWidth - width) / 2 + BOSS_BAR_HORIZONTAL_OFFSET;
    const x = Math.round(Math.max(8, Math.min(centeredX, viewportWidth - width - 8)));`;
 if(source.split(anchor).length!==2)throw Error("Pinned boss bar layout anchor changed");
 const helper=ocellusBossBarWidth.toString().replace("ocellusBossBarWidth(viewportWidth,maxWidth)","ocellusBossBarWidth(viewportWidth:number,maxWidth:number)");
 const anchorConstant="const BOSS_BAR_HORIZONTAL_OFFSET = -60;";
 if(source.split(anchorConstant).length!==2)throw Error("Pinned boss bar offset anchor changed");
 return source.replace(anchorConstant,helper).replace(anchor,`    const width = ocellusBossBarWidth(viewportWidth,BOSS_BAR_WIDTH);
    if(width<80)return;
    const x = 8;`);
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const path=process.argv[2];if(!path)throw Error("Expected pinned SDK Viewport.ts");
 writeFileSync(path,patchOcellusBossBar(readFileSync(path,"utf8")));
}
