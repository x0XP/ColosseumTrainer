import { MeleeWeapon, RangedWeapon } from "osrs-sdk";
import type { IncomingAttackRoll } from "osrs-sdk";
import { OcellusRegion, OcellusRift } from "../OcellusRegion";

describe("Ocellus Void Rift combat from recorded P4 rules", () => {
  const rift = Object.create(OcellusRift.prototype) as OcellusRift;
  const incoming = (weapon: unknown, isSpecialAttack = false) =>
    rift.incomingAttackRollModifiers({
      weapon, bonuses: { isSpecialAttack },
    } as unknown as IncomingAttackRoll);

  test("standard melee attacks always hit their maximum", () => {
    expect(incoming(new MeleeWeapon())).toEqual({ guaranteedHit: true, maxDamage: true });
  });

  test("standard ranged attacks always hit their maximum", () => {
    expect(incoming(new RangedWeapon())).toEqual({ guaranteedHit: true, maxDamage: true });
  });

  test("special attacks and other styles keep their normal rolls", () => {
    expect(incoming(new MeleeWeapon(), true)).toEqual({});
    expect(incoming(new RangedWeapon(), true)).toEqual({});
    expect(incoming({})).toEqual({});
  });

  test("killing a living Rift resets the next attack delay", () => {
    const player = { attackDelay: 5 };
    const sim = { removeRift: jest.fn(() => true) };
    const region = {
      player, sim, riftMobs: new Map([[33, rift]]),
      updateView: jest.fn(),
    };
    Object.assign(rift, { riftId: 33 });
    OcellusRegion.prototype.onUnitDeath.call(region as never, rift);
    expect(sim.removeRift).toHaveBeenCalledWith(33);
    expect(player.attackDelay).toBe(0);
    expect(region.riftMobs.has(33)).toBe(false);
  });

  test("an already-detonated Rift cannot grant a bonus attack", () => {
    const player = { attackDelay: 5 };
    const region = {
      player, sim: { removeRift: () => false },
      riftMobs: new Map(), updateView: jest.fn(),
    };
    OcellusRegion.prototype.onUnitDeath.call(region as never, rift);
    expect(player.attackDelay).toBe(5);
  });
});
