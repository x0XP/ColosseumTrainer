import { OcellusBoss, OcellusRift } from "../OcellusRegion";
import { OCELLUS_ASSETS } from "../Assets";

/**
 * A regression for the original prototype's empty attackStep() overrides.
 * The SDK calls Mob.detectDeath() from Mob.attackStep(): without that call,
 * boss HP may reach 0 but no victory pose or Void Rift despawn occurs.
 */
describe("native Ocellus and Void Rift death animation lifecycle", () => {
  function verifyNativeTurn(
    prototype: { attackStep(): void },
    label: string,
  ) {
    const events: string[] = [];
    const mock = {
      nulledTicks: 1,
      overheadTextTimer: 1,
      age: 0,
      dying: -1,
      lastRotation: 0,
      getPerceivedRotation: () => 0,
      attackIfPossible: () => events.push("attack"),
      detectDeath: () => events.push("death"),
    };
    prototype.attackStep.call(mock as never);
    expect(events).toEqual(["attack", "death"]);
    expect(mock.nulledTicks).toBe(0);
    expect(mock.overheadTextTimer).toBe(0);
  }

  test("Ocellus forwards its turn to the SDK death detector", () => {
    verifyNativeTurn(OcellusBoss.prototype, "Ocellus");
  });

  test("Void Rift forwards its turn to the SDK death detector", () => {
    verifyNativeTurn(OcellusRift.prototype, "Void Rift");
  });

  test("Ocellus death plays immediately, not again after one SDK tick", () => {
    const getDeath = Object.getOwnPropertyDescriptor(
      OcellusBoss.prototype, "deathAnimationId",
    )?.get;
    expect(getDeath).toBeDefined();
    expect(getDeath?.call({})).toBeNull();
    expect(OCELLUS_ASSETS.npcs.ocellus.animations.death).toBe(14872);
  });

  test("killed Void Rifts retain the genuine 14897 despawn animation", () => {
    const getDeath = Object.getOwnPropertyDescriptor(
      OcellusRift.prototype, "deathAnimationId",
    )?.get;
    expect(getDeath?.call({})).toBe(14897);
    expect(OCELLUS_ASSETS.npcs.voidRift.animations.detonate).toBe(14898);
  });
});
