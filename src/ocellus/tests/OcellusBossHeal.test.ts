import { OcellusBoss } from "../OcellusRegion";

/** This tests the presentation hook without starting the WebGL trainer. */
describe("native Ocellus boss heal splats", () => {
  test("records positive healing for the current and following game tick", () => {
    const renderer = Object.create(OcellusBoss.prototype) as OcellusBoss;
    Object.assign(renderer, { healVisuals: [] });
    renderer.addHealVisual(24, 50);
    expect((renderer as unknown as { healVisuals: unknown[] }).healVisuals)
      .toEqual([{ amount: 24, until: 51 }]);
    renderer.addHealVisual(0, 50);
    renderer.addHealVisual(-12, 50);
    expect((renderer as unknown as { healVisuals: unknown[] }).healVisuals)
      .toHaveLength(1);
  });

  test("renders the SDK's green heal sprite with the correct amount", () => {
    let tick = 50;
    const sprite = { complete: true, naturalWidth: 24 };
    const renderer = Object.create(OcellusBoss.prototype) as OcellusBoss;
    Object.assign(renderer, {
      incomingProjectiles: [],
      healVisuals: [],
      healHitsplatImage: sprite,
      region: { getSnapshot: () => ({ frame: { tick } }) },
    });
    renderer.addHealVisual(24, 50);
    const ctx = {
      drawImage: jest.fn(), fillText: jest.fn(),
      font: "", textAlign: "", fillStyle: "",
    } as unknown as OffscreenCanvasRenderingContext2D;
    renderer.drawHitsplats(ctx, 32);
    expect(ctx.drawImage).toHaveBeenCalledWith(sprite, -11, -31, 24, 23);
    expect(ctx.fillText).toHaveBeenCalledWith("24", 0, -15);
    tick = 52;
    (ctx.drawImage as jest.Mock).mockClear();
    renderer.drawHitsplats(ctx, 32);
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });
});

test("boss healing retains its sprite slot when another hitsplat occupies the centre",()=>{
 const renderer=Object.create(OcellusBoss.prototype) as OcellusBoss;
 const sprite={complete:true,naturalWidth:24};
 Object.assign(renderer,{incomingProjectiles:[{remainingDelay:0,damage:4,offsetX:0,offsetY:30}],
 healVisuals:[],healHitsplatImage:sprite,damageHitsplatImage:{},region:{getSnapshot:()=>({frame:{tick:50}})}});
 renderer.addHealVisual(24,50);
 const ctx={drawImage:jest.fn(),fillText:jest.fn(),font:"",textAlign:"",fillStyle:""} as unknown as OffscreenCanvasRenderingContext2D;
 renderer.drawHitsplats(ctx,32);
 expect(ctx.drawImage).toHaveBeenLastCalledWith(sprite,-29,-21,24,23);
});

test("healing does not jump into an expired heal's slot and restores paint state",()=>{
 let tick=50;
 const renderer=Object.create(OcellusBoss.prototype) as OcellusBoss;
 const sprite={complete:true,naturalWidth:24};
 Object.assign(renderer,{incomingProjectiles:[],healVisuals:[],healHitsplatImage:sprite,region:{getSnapshot:()=>({frame:{tick}})}});
 const ctx={drawImage:jest.fn(),fillText:jest.fn(),font:"12px OSRS",textAlign:"right",fillStyle:"#123456"};
 const canvas=ctx as unknown as OffscreenCanvasRenderingContext2D;
 renderer.addHealVisual(24,50);renderer.drawHitsplats(canvas,32);
 tick=51;renderer.addHealVisual(12,51);renderer.drawHitsplats(canvas,32);
 expect(ctx.drawImage).toHaveBeenLastCalledWith(sprite,-29,-21,24,23);
 tick=52;ctx.drawImage.mockClear();renderer.drawHitsplats(canvas,32);
 expect(ctx.drawImage.mock.calls).toEqual([[sprite,-29,-21,24,23]]);
 expect([ctx.font,ctx.textAlign,ctx.fillStyle]).toEqual(["12px OSRS","right","#123456"]);
});
