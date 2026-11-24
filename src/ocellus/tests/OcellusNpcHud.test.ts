import {drawNativeOverheadIcon,drawRiftChargeBar,drawNativeNpcHealth} from "../OcellusNpcHud";
test("cache overhead uses the original 25 pixel raster without smoothing",()=>{
 const ctx={save:jest.fn(),restore:jest.fn(),drawImage:jest.fn(),imageSmoothingEnabled:true};
 const image={complete:true,naturalWidth:25,naturalHeight:25} as HTMLImageElement;
 drawNativeOverheadIcon(ctx as unknown as OffscreenCanvasRenderingContext2D,image);
 expect(ctx.drawImage).toHaveBeenCalledWith(image,-12,7,25,25);
 expect(ctx.imageSmoothingEnabled).toBe(false);
 expect(ctx.restore).toHaveBeenCalledTimes(1);
 drawNativeOverheadIcon(ctx as unknown as OffscreenCanvasRenderingContext2D,{...image,complete:false} as HTMLImageElement);
 expect(ctx.drawImage).toHaveBeenCalledTimes(1);
});
test("rift charge bar has integer fill, clamps to its bounds, and touches HP bar",()=>{
 const ctx={fillRect:jest.fn(),fillStyle:""};
 const canvas=ctx as unknown as OffscreenCanvasRenderingContext2D;
 drawRiftChargeBar(canvas,30,0,0,30);
 expect(ctx.fillRect.mock.calls).toEqual([[-15,5,30,5]]);
 ctx.fillRect.mockClear();
 drawRiftChargeBar(canvas,30,0,13,30);
 expect(ctx.fillRect.mock.calls).toEqual([[-15,5,30,5],[-15,5,13,5]]);
 ctx.fillRect.mockClear();
 drawRiftChargeBar(canvas,30,0,999,30);
 expect(ctx.fillRect.mock.calls).toEqual([[-15,5,30,5],[-15,5,30,5]]);
});

test("charge raster is aligned even with fractional sizes and does not leak canvas colour",()=>{
 const ctx={fillRect:jest.fn(),fillStyle:"#abcdef"};
 const canvas=ctx as unknown as OffscreenCanvasRenderingContext2D;
 drawRiftChargeBar(canvas,29.6,.4,15,30);
 expect(ctx.fillRect.mock.calls).toEqual([[-15,5,30,5],[-15,5,15,5]]);
 expect(ctx.fillStyle).toBe("#abcdef");
 ctx.fillRect.mockClear();
 drawRiftChargeBar(canvas,30,NaN,15,30);
 drawRiftChargeBar(canvas,30,0,15,Infinity);
 expect(ctx.fillRect).not.toHaveBeenCalled();
});

test("native health and charge share integer baseline and low health stays visible",()=>{
 const ctx={fillRect:jest.fn(),fillStyle:"#abcdef"};
 const canvas=ctx as unknown as OffscreenCanvasRenderingContext2D;
 drawNativeNpcHealth(canvas,30,.4,1,44,30);
 drawRiftChargeBar(canvas,30,.4,15,30);
 expect(ctx.fillRect.mock.calls).toEqual([[-15,0,30,5],[-15,0,1,5],[-15,5,30,5],[-15,5,15,5]]);
 expect(ctx.fillStyle).toBe("#abcdef");
 ctx.fillRect.mockClear();
 drawNativeNpcHealth(canvas,90,0,1313,5250,5250);
 expect(ctx.fillRect.mock.calls).toEqual([[-45,0,90,5],[-45,0,23,5]]);
 ctx.fillRect.mockClear();
 drawNativeNpcHealth(canvas,30,0,0,44,30);
 expect(ctx.fillRect.mock.calls).toEqual([[-15,0,30,5]]);
 ctx.fillRect.mockClear();
 drawNativeNpcHealth(canvas,30,0,99,44,30);
 expect(ctx.fillRect.mock.calls).toEqual([[-15,0,30,5],[-15,0,30,5]]);
 ctx.fillRect.mockClear();
 drawNativeNpcHealth(canvas,30,0,1,0,30);
 expect(ctx.fillRect).not.toHaveBeenCalled();
});
