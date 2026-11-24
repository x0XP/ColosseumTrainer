import { stageAt } from "../Phase4Rules";
import { effectCue, specialTellSpotId, lingeringExplosionCue, orbLeavingCue, EFFECT_LOOKS, OCELLUS_TRANSITION_CORE_RECOLOR, advanceEffectClock, effectPlaybackAt, nativeEffectPlaybackAt, nativeEffectInstance, orbDepartureCue } from "../OcellusVisualCues";
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
    expect(OCELLUS_TRANSITION_CORE_RECOLOR).toEqual({ 4: 0x020203 });
  });
});

test("impact tick still has the native explosion even if no render observed its warning frame",()=>{
 const mark={void:"inner",pulse:0,tile:at(5,1)} as const;
 const state={...view(18,[]),impactMark:mark};
 expect(effectCue(state,"explosion")).toMatchObject({spotAnim:4339,tile:at(5,1)});
 expect(effectCue({...view(19,[]),impactMark:mark},"explosion")).toBeNull();
});
test("game-clock effects stay synchronized through paused frames, dropped frames and reset",()=>{
 let step=advanceEffectClock(null,10,.25,600);
 expect(step.delta).toBe(0);
 step=advanceEffectClock(step.clock,10,.25,600);
 expect(step.delta).toBe(0);
 step=advanceEffectClock(step.clock,12,.25,600);
 expect(step.delta).toBeCloseTo(1.2);
 step=advanceEffectClock(step.clock,12,.1,600);
 expect(step.delta).toBe(0);
 step=advanceEffectClock(step.clock,12,.5,600);
 expect(step.delta).toBeCloseTo(.15);
 expect(advanceEffectClock(step.clock,0,0,600).delta).toBe(0);
});

test("late-rendered explosions start at their authoritative impact age",()=>{
 const mark={void:"inner",pulse:0,tile:at(5,1)} as const;
 const cue=effectCue({...view(18,[]),impactMark:mark},"explosion")!;
 expect(cue.startedAt).toBe(17);
 expect(effectPlaybackAt(cue,18,.25,600)).toMatchObject({total:.75,elapsed:.75,finished:false});
 expect(effectPlaybackAt(cue,18,.9,600).finished).toBe(true);
});
test("mature orb loops use their native 32-cycle duration without accumulating render delay",()=>{
 const cue=effectCue(view(24,[orb]),"inner-orb")!;
 expect(effectPlaybackAt(cue,26,0,600).cycle).toBe(1);
 expect(effectPlaybackAt(cue,26,0,600).elapsed).toBeCloseTo(.56);
 expect(effectPlaybackAt(cue,26,0,600,1.3).cycle).toBe(2);
});
test("departure renders even if the orb was never previously drawn",()=>{
 const picked={...orb,picked:true,claimAt:24};
 const cue=orbDepartureCue({frame:stageAt(24),departingOrbs:[picked]},"inner-orb")!;
 expect(cue).toMatchObject({spotAnim:4312,startedAt:24,durationCycles:30,tile:orb.tile});
 expect(orbDepartureCue({frame:stageAt(25),departingOrbs:[]},"inner-orb")).toBeNull();
 const expired=orbDepartureCue({frame:stageAt(36),departingOrbs:[orb]},"inner-orb");
 expect(expired?.startedAt).toBe(36);
});

test("native sequence age follows encounter progress, not adjustable wall-clock tick speed",()=>{
 const mark={void:"inner",pulse:0,tile:at(5,1)} as const;
 const cue=effectCue({...view(18,[]),impactMark:mark},"explosion")!;
 expect(nativeEffectPlaybackAt(cue,18,.25)).toMatchObject({elapsed:.75,finished:false});
 expect(nativeEffectPlaybackAt(cue,18,.9).finished).toBe(true);
 expect(nativeEffectPlaybackAt(cue,18,.1,.75).elapsed).toBe(.75);
 const departure=orbDepartureCue({frame:stageAt(24),departingOrbs:[{...orb,picked:true,claimAt:24}]},"inner-orb")!;
 expect(nativeEffectPlaybackAt(departure,24,.5).elapsed).toBeCloseTo(.3);
 expect(nativeEffectPlaybackAt(departure,25,0).finished).toBe(true);
});

test("effect loops restart exactly at their native boundary and one-shots never overrun",()=>{
 const ready=effectCue(view(24,[orb]),"inner-orb")!;
 const boundary=effectPlaybackAt(ready,24,0,600,.64);
 expect(boundary.cycle).toBe(1);
 expect(boundary.elapsed).toBe(0);
 const forming=effectCue(view(12,[orb]),"inner-orb")!;
 const late=effectPlaybackAt(forming,100,0,600);
 expect(late.elapsed).toBe(364/50);
 expect(late.finished).toBe(true);
 expect(effectPlaybackAt({...forming,durationCycles:0},12,0,600).finished).toBe(true);
});

test("bad frame values cannot poison an otherwise valid native sequence",()=>{
 const cue=effectCue(view(24,[orb]),"inner-orb")!;
 expect(effectPlaybackAt(cue,24,NaN,600,NaN)).toMatchObject({total:0,elapsed:0,finished:false});
 expect(effectPlaybackAt(cue,NaN,0,600,.2).elapsed).toBe(.2);
 expect(effectPlaybackAt(cue,25,0,Infinity,.2).elapsed).toBe(.2);
});

test("mature fragment reuses the same instance over multiple native loop boundaries",()=>{
 const cue=effectCue(view(24,[orb]),"inner-orb")!;
 const initial=nativeEffectInstance(cue,nativeEffectPlaybackAt(cue,24,0))!;
 const later=nativeEffectInstance(cue,nativeEffectPlaybackAt(cue,26,0))!;
 expect(later.key).toBe(initial.key);
 expect(later.elapsed).toBeCloseTo(1.2);
 expect(later.loop).toBe(true);
 const departure=orbDepartureCue({frame:stageAt(26),departingOrbs:[{...orb,picked:true,claimAt:26}]},"inner-orb")!;
 expect(nativeEffectInstance(departure,nativeEffectPlaybackAt(departure,26,.5))).toMatchObject({elapsed:.3,loop:false});
 expect(nativeEffectInstance(departure,nativeEffectPlaybackAt(departure,27,0))).toBeNull();
});
