import { stageAt } from "../Phase4Rules";
import { effectCue, specialTellSpotId } from "../OcellusVisualCues";
import type { OcellusView } from "../OcellusRegion";
import type { Orb, Mark } from "../Phase4Simulation";

const at = (x: number, y: number) => ({ x, y });
const orb: Orb = {
  void: "inner", tile: at(2, 2), createdAt: 12,
  maturesAt: 24, expiresAt: 36, amount: 40,
  picked: false, claimAt: null,
};
const view = (tick: number, orbs: readonly Orb[], marks: readonly Mark[] = []):
  Pick<OcellusView, "frame" | "orbs" | "marks"> => ({
    frame: stageAt(tick), orbs, marks,
  });

describe("original Ocellus cache visual cues", () => {
  test("inner and outer soul fragments use their own spawn animation then loop idle", () => {
    expect(effectCue(view(12, [orb]), "inner-orb")).toMatchObject({
      spotAnim: 4311, loops: false, tile: at(2, 2),
    });
    expect(effectCue(view(23, [orb]), "inner-orb")?.spotAnim).toBe(4311);
    expect(effectCue(view(24, [orb]), "inner-orb")).toMatchObject({
      spotAnim: 4310, loops: true,
    });
    expect(effectCue(view(24, [{ ...orb, picked: true }]), "inner-orb")).toBeNull();
    expect(effectCue(view(24, [orb]), "outer-orb")).toBeNull();
    const outer: Orb = { ...orb, void: "outer", createdAt: 43, maturesAt: 49, expiresAt: 61 };
    expect(effectCue(view(43, [outer]), "outer-orb")?.spotAnim).toBe(4309);
    expect(effectCue(view(49, [outer]), "outer-orb")?.spotAnim).toBe(4310);
  });
  test("marked explosions use the native cache explosion animation", () => {
    expect(effectCue(view(16, [orb], []), "explosion")).toBeNull();
    expect(effectCue(view(17, [], [{ void: "inner", pulse: 0, tile: at(5, 1) }]), "explosion")).toMatchObject({
      spotAnim: 4339, loops: false, tile: at(5, 1),
    });
  });
  test("each transition attack uses the corresponding native cache cue", () => {
    expect(specialTellSpotId("melee")).toBe(4328);
    expect(specialTellSpotId("range")).toBe(4330);
    expect(specialTellSpotId("magic")).toBe(4329);
  });
});
