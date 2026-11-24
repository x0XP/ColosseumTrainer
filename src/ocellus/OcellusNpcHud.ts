/** Native 440:11/15/16 frames are 25×25 pixels in cache 2746.
 * Preserve their actual raster dimensions instead of stretching to a tile. */
export function drawNativeOverheadIcon(ctx:OffscreenCanvasRenderingContext2D,image:HTMLImageElement):void{
 if(!image.complete||image.naturalWidth<=0||image.naturalHeight<=0)return;
 const width=image.naturalWidth,height=image.naturalHeight;
 ctx.save();ctx.imageSmoothingEnabled=false;
 ctx.drawImage(image,-Math.floor(width/2),7,width,height);
 ctx.restore();
}
/** Match the adjoining 5px SDK HP bar and quantise the charge to pixels. */
export function drawRiftChargeBar(ctx:OffscreenCanvasRenderingContext2D,width:number,top:number,elapsed:number,duration:number):void{
 if(![width,top,elapsed,duration].every(Number.isFinite)||width<=0||duration<=0)return;
 const pixels=Math.max(1,Math.round(width));
 const left=-Math.floor(pixels/2),y=Math.round(top)+5;
 const fraction=Math.max(0,Math.min(1,elapsed/duration));
 const fill=Math.round(pixels*fraction);
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
 const fill=hp>0?Math.max(1,Math.round(ratio*pixels)):0;
 const previous=ctx.fillStyle;
 ctx.fillStyle="red";ctx.fillRect(left,y,pixels,5);
 if(fill){ctx.fillStyle="lime";ctx.fillRect(left,y,fill,5);}
 ctx.fillStyle=previous;
}
