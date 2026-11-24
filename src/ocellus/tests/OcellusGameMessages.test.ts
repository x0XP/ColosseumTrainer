import { appendOcellusGameMessage } from "../OcellusGameMessages";
import { OcellusRegion } from "../OcellusRegion";
import { OcellusRift } from "../OcellusRegion";

describe("Original Ocellus game-chat cues", () => {
  test("maintains an immutable, chronological six-line game chat", () => {
    const first = appendOcellusGameMessage([], 11, "Ocellus manipulates your lifeforce!");
    expect(first).toEqual([{ id: 1, tick: 11, text: "Ocellus manipulates your lifeforce!" }]);
    let current = first;
    for (let t = 12; t <= 20; t++) current = appendOcellusGameMessage(current, t, "line " + t);
    expect(current).toHaveLength(6);
    expect(current.map(x => x.id)).toEqual([5, 6, 7, 8, 9, 10]);
    expect(current[5].text).toBe("line 20");
    expect(first).toHaveLength(1);
  });

  test("ignores blank messages instead of appending empty chat rows", () => {
    const existing = appendOcellusGameMessage([], 11, "Hello");
    expect(appendOcellusGameMessage(existing, 12, "   ")).toBe(existing);
  });

  test("uses the game message effect for the lifeforce tell", () => {
    const region = {
      player: {}, boss: {}, sim: { current: () => ({ tick: 11 }) }, chat: [],
      addChat: (OcellusRegion.prototype as unknown as {
        addChat(this: unknown, text: string): void;
      }).addChat,
    };
    (OcellusRegion.prototype as unknown as {
      applyEffect(this: unknown, effect: { kind: "message"; text: string }): void;
    }).applyEffect.call(region, { kind: "message", text: "Ocellus manipulates your lifeforce!" });
    expect(region.chat).toEqual([{ id: 1, tick: 11, text: "Ocellus manipulates your lifeforce!" }]);
  });

  test("Rift kill chat is emitted only when a living Rift is destroyed", () => {
    const mockRift = Object.create(OcellusRift.prototype) as OcellusRift;
    Object.assign(mockRift, { riftId: 5, playAnimation: jest.fn() });
    const make = (destroyed: boolean) => ({
      sim: { removeRift: () => destroyed, current: () => ({ tick: 96 }) },
      chat: [] as unknown[],
      addChat: (OcellusRegion.prototype as unknown as {
        addChat(this: unknown, text: string): void;
      }).addChat,
      player: { attackDelay: 4 },
      riftMobs: new Map([[5, mockRift]]),
      updateView: jest.fn(),
    });
    const success = make(true);
    OcellusRegion.prototype.onUnitDeath.call(success as never, mockRift);
    expect(success.player.attackDelay).toBe(0);
    expect(success.chat).toEqual([{ id: 1, tick: 96, text: "Destroying the void rift empowers you!" }]);
    const alreadyBurst = make(false);
    OcellusRegion.prototype.onUnitDeath.call(alreadyBurst as never, mockRift);
    expect(alreadyBurst.chat).toEqual([]);
  });
});
