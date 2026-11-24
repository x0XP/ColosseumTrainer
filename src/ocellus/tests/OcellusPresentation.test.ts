import { presentationAt, OCELLUS_DEATH_TICKS, OCELLUS_DEATH_EFFECTS, RIFT_BURST_EFFECT, riftBurstVisual, areaCueVolume } from "../OcellusPresentation";
import { OCELLUS_ASSETS } from "../Assets";
import { stageAt, specialStyle } from "../Phase4Rules";

describe("Ocellus Phase 4 native animation and server sound cues", () => {
  const p = (tick: number) => presentationAt(stageAt(tick), 42);
  const audio = (tick: number) => p(tick).sounds.map((sound) => sound.id);

  test("lead-in shout and original 2-tick boss rise/4-tick landing", () => {
    expect(audio(5)).toContain(12490);
    expect(p(7).bossAnimation).toBeNull();
    expect(p(8).bossAnimation).toBe(14863);
    expect(p(29).bossAnimation).toBe(14865);
    expect(p(30).bossAnimation).toBeNull();
    expect(audio(39)).toContain(12497);
    expect(p(68).bossAnimation).toBe(14863);
    expect(p(89).bossAnimation).toBe(14865);
  });

  test("the inner lifeforce hit alone gives Ocellus its hovering cache animation", () => {
    expect(p(11).bossAnimation).toBe(14855);
    expect(p(11).playerSpotAnims).toContain(4313);
    expect(p(12).bossSpotAnims).toContain(4316);
    expect(p(42).playerSpotAnims).toContain(4313);
    expect(p(43).bossSpotAnims).not.toContain(4316);
  });

  test("original explosion warnings and repeated marking sounds", () => {
    expect(p(14).playerSpotAnims).toContain(4340);
    expect(audio(14)).toContain(12638);
    expect(audio(17)).toContain(12537);
    expect(audio(19)).toContain(12537);
    expect(p(45).playerSpotAnims).toContain(4340);
    expect(audio(45)).toContain(12638);
    expect(audio(48)).toContain(12537);
  });

  test("transition visual poses and verified fractional sound offsets", () => {
    for (const start of [24, 52] as const) {
      const absolute = 8 + start;
      expect(p(absolute).bossAnimation).toBe(14844);
      const style = specialStyle(42, 1, start === 24 ? 0 : 1);
      const a = (delta: number) => p(absolute + delta).sounds;
      if (style === "melee") {
        expect(a(0)).toContainEqual({ id: 12572, delayMs: 60 });
        expect(a(5)).toContainEqual({ id: 12567, delayMs: 60 });
      } else if (style === "range") {
        expect(a(4)).toContainEqual({ id: 12555, delayMs: 240 });
        expect(a(5)).toContainEqual({ id: 12556, delayMs: 60 });
      } else {
        expect(a(2)).toContainEqual({ id: 12554, delayMs: 120 });
      }
    }
  });

  test("the original 3D NPC cache animation identities are preserved", () => {
    const boss = OCELLUS_ASSETS.npcs.ocellus;
    expect(boss.id).toBe(16677);
    expect(boss.animations.idle).toBe(14840);
    expect(boss.animations.walk).toBe(14849);
    expect(boss.animations.deflect).toBe(14863);
    expect(boss.animations.deflectLoop).toBe(14864);
    expect(boss.animations.deflectLand).toBe(14865);
    expect(boss.animations.lifeforceCast).toBe(14855);
    expect(boss.animations.transitionCast).toBe(14844);
    expect(boss.animations.death).toBe(14872);

    const rift = OCELLUS_ASSETS.npcs.voidRift;
    expect(rift.id).toBe(16678);
    expect(rift.animations.idle).toBe(14895);
    expect(rift.animations.spawn).toBe(14896);
    expect(rift.animations.death).toBe(14897);
    expect(rift.animations.detonate).toBe(14898);
  });

  test("multiple simultaneous Void Rift detonations create just one native flare", () => {
    expect(riftBurstVisual([{ kind: "rift-detonate" }])).toBe(RIFT_BURST_EFFECT);
    expect(riftBurstVisual([
      { kind: "rift-detonate" }, { kind: "rift-detonate" },
      { kind: "damage" }, { kind: "rift-detonate" },
    ])).toBe(RIFT_BURST_EFFECT);
    expect(riftBurstVisual([{ kind: "rift-spawn" }, { kind: "damage" }])).toBeNull();
  });

  test("the death sequence and its three cache effects occupy fifteen ticks", () => {
    expect(OCELLUS_DEATH_TICKS).toBe(15);
    expect(OCELLUS_DEATH_EFFECTS).toEqual([4274, 4275, 4276]);
    expect(RIFT_BURST_EFFECT).toBe(4306);
  });
});

test("the post-release void-bomb warning is boosted independently",()=>{
 expect(areaCueVolume(12638)).toBe(.2);
 for(const id of [12490,12497,12537,12572,12567,12555,12556,12554])expect(areaCueVolume(id)).toBe(.1);
});
