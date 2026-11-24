import {minimapPoint,drawNativeMinimap} from "../OcellusMinimap";
test("player-centred native map has north-up tile coordinates",()=>{
 expect(minimapPoint({x:5,y:1},{x:5,y:1})).toEqual({x:76,y:76});
 expect(minimapPoint({x:8,y:0},{x:5,y:1})).toEqual({x:88,y:72});
 expect(minimapPoint({x:4,y:3},{x:5,y:1})).toEqual({x:72,y:84});
});
test("map scales each original tile equally and draws the player at centre",()=>{
 const ctx={save:jest.fn(),restore:jest.fn(),drawImage:jest.fn(),fillRect:jest.fn(),imageSmoothingEnabled:true,fillStyle:""};
 const image={} as HTMLImageElement;
 drawNativeMinimap(ctx as unknown as OffscreenCanvasRenderingContext2D,image,{x:5,y:1},[{x:5,y:5}],14,13);
 expect(ctx.drawImage).toHaveBeenCalledWith(image,54,70,56,52);
 expect(ctx.fillRect).toHaveBeenNthCalledWith(1,75,91,3,3);
 expect(ctx.fillRect).toHaveBeenNthCalledWith(2,75,75,3,3);
 expect(ctx.restore).toHaveBeenCalledTimes(1);
});
