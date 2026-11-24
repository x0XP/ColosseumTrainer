/** Native 440:11/15/16 frames are 25×25 pixels in cache 2746.
 * Preserve their actual raster dimensions instead of stretching to a tile. */
export function drawNativeOverheadIcon(ctx:OffscreenCanvasRenderingContext2D,image:HTMLImageElement):void{
 // All three shipped native head icons have verified 25x25 dimensions.
 // Never display a partially loaded or mismatched raster over the boss.
 if(!image.complete||image.naturalWidth!==25||image.naturalHeight!==25)return;
 ctx.save();ctx.imageSmoothingEnabled=false;
 ctx.drawImage(image,-12,7,25,25);
 ctx.restore();
}
/** Match the adjoining 5px SDK HP bar and quantise the charge to pixels. */
export function drawRiftChargeBar(ctx:OffscreenCanvasRenderingContext2D,width:number,top:number,elapsed:number,duration:number):void{
 if(![width,top,elapsed,duration].every(Number.isFinite)||width<=0||duration<=0)return;
 const pixels=Math.max(1,Math.round(width));
 const left=-Math.floor(pixels/2),y=Math.round(top)+5;
 const fraction=Math.max(0,Math.min(1,elapsed/duration));
 // A partly charged rift must not look fully charged before detonation.
 const fill=fraction===1?pixels:Math.min(pixels-1,Math.round(pixels*fraction));
 const previous=ctx.fillStyle;
 ctx.fillStyle="#1e1e0c";ctx.fillRect(left,y,pixels,5);
 if(fill>0){ctx.fillStyle="#e0c020";ctx.fillRect(left,y,fill,5);}
 ctx.fillStyle=previous;
}

/** Retain the SDK health scale, with pixel-aligned five-pixel bars. */
export function drawNativeNpcHealth(ctx:OffscreenCanvasRenderingContext2D,width:number,top:number,hp:number,maxHp:number,healthScale:number):void {
 if(![width,top,hp,maxHp,healthScale].every(Number.isFinite)||width<=0||maxHp<=0||healthScale<=0)return;
 const pixels=Math.max(1,Math.round(width)),left=-Math.floor(pixels/2),y=Math.round(top);
 const ratio=Math.min(1,Math.max(0,Math.ceil(hp/maxHp*healthScale)/healthScale));
 // Preserve one visible green pixel for a living NPC, but never paint
 // the red remainder away when a multi-pixel bar has lost health.
 const fill=hp<=0?0:hp>=maxHp?pixels:Math.max(1,Math.min(pixels-1,Math.round(ratio*pixels)));
 const previous=ctx.fillStyle;
 ctx.fillStyle="red";ctx.fillRect(left,y,pixels,5);
 if(fill){ctx.fillStyle="lime";ctx.fillRect(left,y,fill,5);}
 ctx.fillStyle=previous;
}
