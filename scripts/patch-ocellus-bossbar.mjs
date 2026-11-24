#!/usr/bin/env node
/** Ocellus-only canvas HUD framing. Preserve the pinned SDK's authentic
 * boss bar artwork and health calculation, relocating it away from the
 * central raised boss. Narrow canvases retain a legible bounded width. */
import {readFileSync,writeFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
export function ocellusBossBarWidth(viewportWidth,maxWidth){
 const reserve=210*Math.min(1,Math.max(.68,viewportWidth/600));
 return Math.max(0,Math.min(maxWidth,viewportWidth-16,viewportWidth-reserve-20));
}
export function patchOcellusBossBar(source){
 const anchor=`    const width = Math.min(BOSS_BAR_WIDTH, viewportWidth - 16);
    const centeredX = (viewportWidth - width) / 2 + BOSS_BAR_HORIZONTAL_OFFSET;
    const x = Math.round(Math.max(8, Math.min(centeredX, viewportWidth - width - 8)));`;
 if(source.split(anchor).length!==2)throw Error("Pinned boss bar layout anchor changed");
 const helper=ocellusBossBarWidth.toString().replace("ocellusBossBarWidth(viewportWidth,maxWidth)","ocellusBossBarWidth(viewportWidth:number,maxWidth:number)");
 const anchorConstant="const BOSS_BAR_HORIZONTAL_OFFSET = -60;";
 if(source.split(anchorConstant).length!==2)throw Error("Pinned boss bar offset anchor changed");
 let result=source.replace(anchorConstant,helper).replace(anchor,`    const width = ocellusBossBarWidth(viewportWidth,BOSS_BAR_WIDTH);
    if(width<80)return;
    const x = 8;`);
 result=result.replace("    const y = BOSS_BAR_TOP;","    const y = viewportWidth < 600 ? 52 : BOSS_BAR_TOP;");
 result=result.replace('    this.context.font = "18px Stats_11";','    this.context.font = (viewportWidth < 600 ? 13 : 18) + "px Stats_11";');
 return result;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const path=process.argv[2];if(!path)throw Error("Expected pinned SDK Viewport.ts");
 writeFileSync(path,patchOcellusBossBar(readFileSync(path,"utf8")));
}
