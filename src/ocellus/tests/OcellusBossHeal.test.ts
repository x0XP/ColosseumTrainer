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
