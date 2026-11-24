#!/usr/bin/env node
import {readFileSync,writeFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
// Ocellus-only SDK checkout; the default map path and Sol are unchanged.
export function patchOcellusMinimap(source) {
 const original='    this.mapCanvas = new OffscreenCanvas(152, 152);\n    const mapContext = this.mapCanvas.getContext("2d") as OffscreenCanvasRenderingContext2D;\n\n    mapContext.save();';
 const replacement=`    this.mapCanvas = this.mapCanvas ?? new OffscreenCanvas(152, 152);
    const mapContext = this.mapCanvas.getContext("2d") as OffscreenCanvasRenderingContext2D;
    mapContext.clearRect(0, 0, 152, 152);
    const region = Trainer.player.region as typeof Trainer.player.region & {
      drawOcellusMinimap?: (ctx:OffscreenCanvasRenderingContext2D,rotation:number,interpolate:boolean) => void;
    };
    if (region.drawOcellusMinimap) {
      region.drawOcellusMinimap(mapContext,Viewport.viewport.getMapRotation(),true);
      // Keep the interface mask fixed while the map and dots rotate.
      mapContext.save();
      mapContext.globalCompositeOperation = "destination-out";
      if(this.mapAlphaImage.complete&&this.mapAlphaImage.naturalWidth>0)mapContext.drawImage(this.mapAlphaImage,0,0);
      mapContext.restore();
      return;
    }

    mapContext.save();`;
 if(source.split(original).length!==2)throw Error("Pinned minimap anchor changed");
 return source.replace(original,replacement);
}
/** Compact the large map/orb cluster on narrow displays; drawing and
 * input coordinates use the same minimapScale. */
export function ocellusMinimapWidthScale(width){
 return Math.min(1,Math.max(.68,width/600));
}
export function patchOcellusCompactMinimap(source){
 const anchor="      : (gameHeight / 500 > 1 ? 1 : gameHeight / 500) * Settings.maxUiScale;";
 if(source.split(anchor).length!==2)throw Error("Pinned SDK minimap scale anchor changed");
 const helper=ocellusMinimapWidthScale.toString().replace("ocellusMinimapWidthScale(width)","ocellusMinimapWidthScale(width:number)");
 return helper+"\n"+source.replace(anchor,"      : (gameHeight / 500 > 1 ? 1 : gameHeight / 500) * Settings.maxUiScale * ocellusMinimapWidthScale(width);");
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const path=process.argv[2];writeFileSync(path,patchOcellusCompactMinimap(patchOcellusMinimap(readFileSync(path,"utf8"))));}
