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
      drawOcellusMinimap?: (ctx:OffscreenCanvasRenderingContext2D) => void;
    };
    if (region.drawOcellusMinimap) {
      mapContext.save();
      mapContext.translate(76,76);
      mapContext.rotate(Viewport.viewport.getMapRotation());
      mapContext.translate(-76,-76);
      region.drawOcellusMinimap(mapContext);
      mapContext.restore();
      // Keep the interface mask fixed while the map and dots rotate.
      mapContext.globalCompositeOperation = "destination-out";
      mapContext.drawImage(this.mapAlphaImage,0,0);
      mapContext.globalCompositeOperation = "source-over";
      return;
    }

    mapContext.save();`;
 if(source.split(original).length!==2)throw Error("Pinned minimap anchor changed");
 return source.replace(original,replacement);
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const path=process.argv[2];writeFileSync(path,patchOcellusMinimap(readFileSync(path,"utf8")));}
