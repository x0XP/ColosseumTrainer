import { Player } from "osrs-sdk";
import { OcellusBoss, OcellusPlayer, OcellusRift } from "../OcellusRegion";
import { stageAt } from "../Phase4Rules";

describe("Ocellus levitation and melee attack animation", () => {
  const hoveringBoss = Object.create(OcellusBoss.prototype) as OcellusBoss;
  const otherRift = Object.create(OcellusRift.prototype) as OcellusRift;

  function tryAttack(tick: number, attackRange: number, aggro: unknown): number {
    let swings = 0;
    const originalAttack = jest.spyOn(Player.prototype, "attackIfPossible")
      .mockImplementation(() => { swings++; });
    try {
      const player = {
        aggro,
        attackRange,
        region: { getSnapshot: () => ({ frame: stageAt(tick) }) },
      };
      OcellusPlayer.prototype.attackIfPossible.call(player as never);
    } finally {
      originalAttack.mockRestore();
    }
    return swings;
  }

  test("melee waits through the full first inner-void hover", () => {
    for (const tick of [8, 11, 19, 24, 29]) {
      expect(tryAttack(tick, 1, hoveringBoss)).toBe(0);
    }
  });

  test("melee resumes immediately on tick 30 when Ocellus lands", () => {
    expect(tryAttack(7, 1, hoveringBoss)).toBe(1);
    expect(tryAttack(29, 1, hoveringBoss)).toBe(0);
    expect(tryAttack(30, 1, hoveringBoss)).toBe(1);
    expect(tryAttack(39, 1, hoveringBoss)).toBe(1);
  });

  test("ranged and magic continue to attack the hovering boss", () => {
    for (const tick of [8, 12, 24, 29, 68, 89]) {
      expect(tryAttack(tick, 5, hoveringBoss)).toBe(1);
      expect(tryAttack(tick, 10, hoveringBoss)).toBe(1);
    }
  });

  test("melee still attacks Void Rifts even when Ocellus hovers", () => {
    expect(tryAttack(68, 1, otherRift)).toBe(1);
    expect(tryAttack(8, 1, null)).toBe(1);
  });

  test("the levitating restriction repeats every 60-tick phase cycle", () => {
    for (const tick of [68, 80, 89, 128, 149]) {
      expect(tryAttack(tick, 1, hoveringBoss)).toBe(0);
    }
    for (const tick of [90, 150]) {
      expect(tryAttack(tick, 1, hoveringBoss)).toBe(1);
    }
  });
});
