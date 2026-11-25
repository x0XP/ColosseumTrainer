import {minimapPoint,drawNativeMinimap,minimapNpcCenter,minimapPlayerPosition} from "../OcellusMinimap";
test("player-centred native map has north-up tile coordinates",()=>{
 expect(minimapPoint({x:5,y:1},{x:5,y:1})).toEqual({x:76,y:76});
 expect(minimapPoint({x:8,y:0},{x:5,y:1})).toEqual({x:88,y:72});
 expect(minimapPoint({x:4,y:3},{x:5,y:1})).toEqual({x:72,y:84});
});
test("map scales each original tile equally and draws the player at centre",()=>{
 const ctx={save:jest.fn(),restore:jest.fn(),drawImage:jest.fn(),fillRect:jest.fn(),translate:jest.fn(),rotate:jest.fn(),imageSmoothingEnabled:true,fillStyle:""};
 const image={} as HTMLImageElement;
 drawNativeMinimap(ctx as unknown as OffscreenCanvasRenderingContext2D,image,{x:5,y:1},[{x:5,y:5}],14,13);
 expect(ctx.drawImage).toHaveBeenCalledWith(image,54,70,56,52);
 expect(ctx.fillRect).toHaveBeenNthCalledWith(1,75,91,3,3);
 expect(ctx.fillRect).toHaveBeenNthCalledWith(2,75,75,3,3);
 expect(ctx.restore).toHaveBeenCalledTimes(2);
});

test("native boss marker uses the centre of the actual south-west anchored footprint",()=>{
 expect(minimapNpcCenter({x:4,y:6},3)).toEqual({x:5,y:5});
 expect(minimapNpcCenter({x:2,y:8},1)).toEqual({x:2,y:8});
});

test("terrain rotates but player and NPC dots stay pixel-aligned",()=>{
 const player={x:5,y:5},npc={x:9,y:5};
 expect(minimapPoint(npc,player,Math.PI/2)).toEqual({x:76,y:92});
 expect(minimapPoint(npc,player,Math.PI/4)).toEqual({x:87,y:87});
 expect(minimapPoint(player,player,Math.PI/4)).toEqual({x:76,y:76});
 const ctx={save:jest.fn(),restore:jest.fn(),drawImage:jest.fn(),fillRect:jest.fn(),translate:jest.fn(),rotate:jest.fn(),imageSmoothingEnabled:true,fillStyle:""};
 drawNativeMinimap(ctx as unknown as OffscreenCanvasRenderingContext2D,{} as HTMLImageElement,player,[npc],14,13,Math.PI/4);
 expect(ctx.rotate).toHaveBeenCalledWith(Math.PI/4);
 expect(ctx.fillRect).toHaveBeenNthCalledWith(1,86,86,3,3);
 expect(ctx.fillRect).toHaveBeenNthCalledWith(2,75,75,3,3);
 expect(ctx.restore.mock.invocationCallOrder[0]).toBeLessThan(ctx.fillRect.mock.invocationCallOrder[0]);
});

test("minimap scrolls by a fractional player tile while keeping NPC dots crisp",()=>{
 const p=minimapPlayerPosition({x:6,y:1},{x:5.25,y:1});
 expect(p).toEqual({x:5.25,y:1});
 expect(minimapPoint({x:5,y:5},p)).toEqual({x:75,y:92});
 const ctx={save:jest.fn(),restore:jest.fn(),drawImage:jest.fn(),fillRect:jest.fn(),translate:jest.fn(),rotate:jest.fn(),imageSmoothingEnabled:true,fillStyle:""};
 drawNativeMinimap(ctx as unknown as OffscreenCanvasRenderingContext2D,{} as HTMLImageElement,p,[{x:5,y:5}],14,13);
 expect(ctx.drawImage).toHaveBeenCalledWith(expect.anything(),53,70,56,52);
 expect(ctx.fillRect).toHaveBeenNthCalledWith(1,74,91,3,3);
 expect(minimapPlayerPosition({x:6,y:1},{x:NaN,y:1})).toEqual({x:6,y:1});
 expect(minimapPoint({x:5,y:5},p,NaN)).toEqual({x:75,y:92});
});

test("native player and NPC dots remain visible while the map artwork decodes",()=>{
 const ctx={save:jest.fn(),restore:jest.fn(),drawImage:jest.fn(),fillRect:jest.fn(),translate:jest.fn(),rotate:jest.fn(),imageSmoothingEnabled:true,fillStyle:""};
 drawNativeMinimap(ctx as unknown as OffscreenCanvasRenderingContext2D,undefined,{x:5,y:5},[{x:6,y:5},{x:NaN,y:5}],14,13);
 expect(ctx.drawImage).not.toHaveBeenCalled();
 expect(ctx.fillRect.mock.calls).toEqual([[79,75,3,3],[75,75,3,3]]);
});

test("terrain filtering is enabled only for native artwork, not marker drawing",()=>{
 const samples:boolean[]=[];
 const ctx={save:jest.fn(),restore:jest.fn(),drawImage:jest.fn(()=>samples.push(ctx.imageSmoothingEnabled)),fillRect:jest.fn(()=>samples.push(ctx.imageSmoothingEnabled)),translate:jest.fn(),rotate:jest.fn(),imageSmoothingEnabled:false,fillStyle:""};
 drawNativeMinimap(ctx as unknown as OffscreenCanvasRenderingContext2D,{} as HTMLImageElement,{x:5,y:1},[{x:5,y:5}],14,13,.4);
 expect(samples).toEqual([true,false,false]);
});
