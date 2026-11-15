import { stageAt } from "../Phase4Rules";
import { effectCue, specialTellSpotId, lingeringExplosionCue, orbLeavingCue, EFFECT_LOOKS } from "../OcellusVisualCues";
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
  test("preloads all native effect looks, including both despawn paths", () => {
    expect(EFFECT_LOOKS["inner-orb"]).toEqual([4311, 4310, 4312]);
    expect(EFFECT_LOOKS["outer-orb"]).toEqual([4309, 4310, 4312]);
    expect(EFFECT_LOOKS.explosion).toEqual([4339]);
    const unique = new Set(Object.values(EFFECT_LOOKS).flat());
    expect(unique.size).toBe(5);
  });
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
  test("the native explosion effect persists through its impact tick", () => {
    const mark = { void: "inner", pulse: 0, tile: at(5, 1) } as const;
    const first = effectCue(view(17, [], [mark]), "explosion");
    expect(first).not.toBeNull();
    expect(lingeringExplosionCue(view(18, []), { cue: first!, tick: 17 })).toEqual(first);
    expect(lingeringExplosionCue(view(19, []), { cue: first!, tick: 17 })).toBeNull();
  });
  test("orb disappearance uses the native 4312 animation", () => {
    const ready = effectCue(view(24, [orb]), "inner-orb");
    expect(ready).not.toBeNull();
    const leaving = orbLeavingCue(ready!);
    expect(leaving.spotAnim).toBe(4312);
    expect(leaving.loops).toBe(false);
    expect(leaving.tile).toEqual(orb.tile);
  });
  test("each transition attack uses the corresponding native cache cue", () => {
    expect(specialTellSpotId("melee")).toBe(4328);
    expect(specialTellSpotId("range")).toBe(4330);
    expect(specialTellSpotId("magic")).toBe(4329);
  });
});
