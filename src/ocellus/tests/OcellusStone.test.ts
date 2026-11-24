import { LIGHT_STONE, DARK_STONE, arenaStoneAt, arenaStoneCss, floorVisualAt, drawOcellusFloorTile, drawOcellusDiagonalFlood, floorLayersAt, drawOcellusFloorLayers, drawOcellusFloorMarkers, drawOcellusVoidRim, drawOcellusGround } from "../OcellusStone";

describe("Ocellus floor fallback and 2D overlays", () => {
  test("the fallback palette is deterministic", () => {
    expect(arenaStoneAt({ x: 5, y: 1 })).toBe(LIGHT_STONE);
    expect(arenaStoneCss({ x: 5, y: 1 })).toBe("#4d5849");
    expect(arenaStoneAt({ x: 5, y: 2 })).toBe(DARK_STONE);
    expect(arenaStoneCss({ x: 5, y: 2 })).toBe("#3e483d");
  });

  test("the observed floor is green-grey, not the previous brown-grey", () => {
    for (const colour of [LIGHT_STONE, DARK_STONE]) {
      const red = (colour >> 16) & 255;
      const green = (colour >> 8) & 255;
      const blue = colour & 255;
      expect(green).toBeGreaterThan(red);
      expect(green).toBeGreaterThan(blue);
    }
  });
});

test("the outer flood hides permanent holes but not a new explosion mark",()=>{
 const hole={x:1,y:5};
 expect(floorVisualAt(hole,{stage:"after-inner"},[],[])).toBe("hole");
 expect(floorVisualAt(hole,{stage:"outer-void"},[],[])).toBe("void");
 expect(floorVisualAt(hole,{stage:"outer-void"},[{tile:hole}],[])).toBe("mark");
});
test("native stone and active orb remain distinct in 2D",()=>{
 const tile={x:5,y:5};
 expect(floorVisualAt(tile,{stage:"after-inner"},[],[])).toBe("native");
 expect(floorVisualAt(tile,{stage:"inner-void"},[],[{tile,picked:false}])).toBe("orb");
 expect(floorVisualAt(tile,{stage:"inner-void"},[],[{tile,picked:true}])).toBe("void");
});

test("2D stone, flood and overlay draw at the actual tile position",()=>{
 const ctx={save:jest.fn(),restore:jest.fn(),drawImage:jest.fn(),fillRect:jest.fn(),fillStyle:"",imageSmoothingEnabled:true};
 const canvas=ctx as unknown as OffscreenCanvasRenderingContext2D;
 const image={complete:true,naturalWidth:896,naturalHeight:832} as HTMLImageElement;
 const flood={complete:true,naturalWidth:128,naturalHeight:128} as HTMLImageElement;
 const at={x:5,y:3};
 drawOcellusFloorTile(canvas,at,20,"native",image);
 expect(ctx.drawImage).toHaveBeenLastCalledWith(image,320,192,64,64,100,60,20,20);
 drawOcellusFloorTile(canvas,at,20,"void",image,flood);
 expect(ctx.drawImage).toHaveBeenLastCalledWith(flood,100,60,20,20);
 drawOcellusFloorTile(canvas,at,20,"mark",image,flood);
 expect(ctx.fillRect).toHaveBeenLastCalledWith(100,60,20,20);
 expect(ctx.fillStyle).toBe("#64347b");
 expect(ctx.save).toHaveBeenCalledTimes(3);
 expect(ctx.restore).toHaveBeenCalledTimes(3);
});

test("2D outer flood includes precisely the three native diagonal half-tiles",()=>{
 const ctx={save:jest.fn(),restore:jest.fn(),drawImage:jest.fn(),fillRect:jest.fn(),fillStyle:"",
 imageSmoothingEnabled:true,beginPath:jest.fn(),moveTo:jest.fn(),lineTo:jest.fn(),closePath:jest.fn(),clip:jest.fn()};
 const canvas=ctx as unknown as OffscreenCanvasRenderingContext2D;
 const flood={complete:true,naturalWidth:128,naturalHeight:128} as HTMLImageElement;
 drawOcellusDiagonalFlood(canvas,10,"inner-void",flood);
 expect(ctx.drawImage).not.toHaveBeenCalled();
 drawOcellusDiagonalFlood(canvas,10,"outer-void",flood);
 expect(ctx.clip).toHaveBeenCalledTimes(3);
 expect(ctx.moveTo.mock.calls).toEqual([[110,40],[100,50],[90,60]]);
 expect(ctx.lineTo.mock.calls.slice(0,2)).toEqual([[120,40],[110,50]]);
 expect(ctx.drawImage).toHaveBeenNthCalledWith(1,flood,110,40,10,10);
 expect(ctx.save).toHaveBeenCalledTimes(6);
 expect(ctx.restore).toHaveBeenCalledTimes(6);
});

test("2D effects preserve the flood or stone under a mark, orb or hole",()=>{
 const at={x:1,y:5},mark={tile:at},orb={tile:at,picked:false};
 expect(floorLayersAt(at,{stage:"outer-void"},[mark],[orb])).toEqual({ground:"void",hole:false,mark:true,orb:true});
 expect(floorLayersAt(at,{stage:"after-inner"},[mark],[orb])).toEqual({ground:"native",hole:true,mark:true,orb:true});
 const ctx={save:jest.fn(),restore:jest.fn(),drawImage:jest.fn(),fillRect:jest.fn(),beginPath:jest.fn(),arc:jest.fn(),moveTo:jest.fn(),lineTo:jest.fn(),closePath:jest.fn(),fill:jest.fn(),stroke:jest.fn(),fillStyle:"",imageSmoothingEnabled:true};
 const flood={complete:true,naturalWidth:128,naturalHeight:128} as HTMLImageElement;
 drawOcellusFloorLayers(ctx as unknown as OffscreenCanvasRenderingContext2D,at,20,{ground:"void",hole:false,mark:true,orb:true},undefined,flood);
 expect(ctx.drawImage).toHaveBeenCalledWith(flood,20,100,20,20);
 expect(ctx.arc).toHaveBeenNthCalledWith(1,30,110,8.6,0,Math.PI*2);
 expect(ctx.lineTo).toHaveBeenCalledTimes(5);
 expect(ctx.fillRect).not.toHaveBeenCalled();
 expect(ctx.save).toHaveBeenCalledTimes(2);
 expect(ctx.restore).toHaveBeenCalledTimes(2);
});

test("2D rim is a continuous native-topology strip and is absent after clear",()=>{
 const stops:unknown[]=[];
 const gradient={addColorStop:jest.fn((...args)=>stops.push(args))};
 const ctx={save:jest.fn(),restore:jest.fn(),createLinearGradient:jest.fn(()=>gradient),beginPath:jest.fn(),moveTo:jest.fn(),lineTo:jest.fn(),closePath:jest.fn(),fill:jest.fn(),fillStyle:""};
 const canvas=ctx as unknown as OffscreenCanvasRenderingContext2D;
 drawOcellusVoidRim(canvas,20,"after-inner");
 expect(ctx.fill).not.toHaveBeenCalled();
 drawOcellusVoidRim(canvas,20,"inner-void");
 expect(ctx.fill).toHaveBeenCalledTimes(40);
 expect(ctx.lineTo).toHaveBeenCalledTimes(120);
 expect(stops.slice(0,4)).toEqual([[0,"#b660dcff"],[.25,"#b660dcc2"],[.6,"#b660dc47"],[1,"#b660dc00"]]);
 expect(ctx.save).toHaveBeenCalledTimes(1);
 expect(ctx.restore).toHaveBeenCalledTimes(1);
 ctx.fill.mockClear();
 drawOcellusVoidRim(canvas,20,"outer-void");
 expect(ctx.fill.mock.calls.length).toBeGreaterThan(40);
});
test("foreground markers never repaint the ground",()=>{
 const ctx={save:jest.fn(),restore:jest.fn(),drawImage:jest.fn(),fillRect:jest.fn(),beginPath:jest.fn(),arc:jest.fn(),moveTo:jest.fn(),lineTo:jest.fn(),closePath:jest.fn(),fill:jest.fn(),stroke:jest.fn(),fillStyle:""};
 drawOcellusFloorMarkers(ctx as unknown as OffscreenCanvasRenderingContext2D,{x:5,y:5},20,{ground:"void",hole:false,mark:true,orb:true});
 expect(ctx.arc).toHaveBeenCalledTimes(1);
 expect(ctx.drawImage).not.toHaveBeenCalled();
 expect(ctx.fillRect).not.toHaveBeenCalled();
});

test("full-resolution safe surface is not overwritten by lower flat-floor art",()=>{
 const ctx={save:jest.fn(),restore:jest.fn(),drawImage:jest.fn(),fillRect:jest.fn(),fillStyle:"",imageSmoothingEnabled:true,
 createLinearGradient:()=>({addColorStop:jest.fn()}),beginPath:jest.fn(),moveTo:jest.fn(),lineTo:jest.fn(),closePath:jest.fn(),fill:jest.fn(),clip:jest.fn()};
 const canvas=ctx as unknown as OffscreenCanvasRenderingContext2D;
 const upper={complete:true,naturalWidth:896,naturalHeight:832} as HTMLImageElement;
 const flood={complete:true,naturalWidth:128,naturalHeight:128} as HTMLImageElement;
 drawOcellusGround(canvas,20,"after-outer",upper,undefined,undefined,flood);
 expect(ctx.drawImage.mock.calls).toEqual([[upper,0,0,280,260]]);
 ctx.drawImage.mockClear();
 drawOcellusGround(canvas,20,"inner-void",upper,undefined,undefined,flood);
 expect(ctx.drawImage).toHaveBeenCalledTimes(26);
 expect(ctx.drawImage.mock.calls.filter(c=>c[0]===flood)).toHaveLength(25);
 ctx.drawImage.mockClear();
 drawOcellusGround(canvas,20,"outer-void",upper,undefined,undefined,flood);
 expect(ctx.drawImage.mock.calls.filter(c=>c[0]===flood)).toHaveLength(62);
});

test("native minimap fallback survives until higher-resolution stone is ready",()=>{
 const ctx={save:jest.fn(),restore:jest.fn(),drawImage:jest.fn(),fillRect:jest.fn(),fillStyle:"",imageSmoothingEnabled:true,
 createLinearGradient:()=>({addColorStop:jest.fn()}),beginPath:jest.fn(),moveTo:jest.fn(),lineTo:jest.fn(),closePath:jest.fn(),fill:jest.fn(),clip:jest.fn()};
 const canvas=ctx as unknown as OffscreenCanvasRenderingContext2D;
 const map={complete:true,naturalWidth:224,naturalHeight:208} as HTMLImageElement;
 const floor={complete:true,naturalWidth:896,naturalHeight:832} as HTMLImageElement;
 const flood={complete:true,naturalWidth:128,naturalHeight:128} as HTMLImageElement;
 drawOcellusGround(canvas,20,"lead-in",undefined,map);
 expect(ctx.drawImage.mock.calls).toEqual([[map,0,0,280,260]]);
 expect(ctx.fillRect).toHaveBeenCalledTimes(1);
 ctx.drawImage.mockClear();
 drawOcellusGround(canvas,20,"inner-void",undefined,map,undefined,flood);
 expect(ctx.drawImage.mock.calls.filter(c=>c[0]===flood)).toHaveLength(25);
 ctx.drawImage.mockClear();
 drawOcellusGround(canvas,20,"lead-in",undefined,map,floor);
 expect(ctx.drawImage.mock.calls.filter(c=>c[0]===floor)).toHaveLength(84);
});

test("native raised stone is composited above flood and rim only while flooded",()=>{
 const ctx={save:jest.fn(),restore:jest.fn(),drawImage:jest.fn(),fillRect:jest.fn(),fillStyle:"",imageSmoothingEnabled:true,
 createLinearGradient:()=>({addColorStop:jest.fn()}),beginPath:jest.fn(),moveTo:jest.fn(),lineTo:jest.fn(),closePath:jest.fn(),fill:jest.fn(),clip:jest.fn()};
 const canvas=ctx as unknown as OffscreenCanvasRenderingContext2D;
 const upper={complete:true,naturalWidth:896,naturalHeight:832} as HTMLImageElement;
 const relief={...upper} as HTMLImageElement;
 const flood={complete:true,naturalWidth:128,naturalHeight:128} as HTMLImageElement;
 drawOcellusGround(canvas,20,"outer-void",upper,undefined,undefined,flood,relief);
 expect(ctx.drawImage.mock.calls.filter(c=>c[0]===flood)).toHaveLength(62);
 expect(ctx.drawImage).toHaveBeenLastCalledWith(relief,0,0,280,260);
 ctx.drawImage.mockClear();
 drawOcellusGround(canvas,20,"after-outer",upper,undefined,undefined,flood,relief);
 expect(ctx.drawImage.mock.calls).toEqual([[upper,0,0,280,260]]);
});
