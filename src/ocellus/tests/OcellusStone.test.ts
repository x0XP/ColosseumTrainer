import { LIGHT_STONE, DARK_STONE, arenaStoneAt, arenaStoneCss, floorVisualAt, drawOcellusFloorTile } from "../OcellusStone";

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
 const hole={x:11,y:1};
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
