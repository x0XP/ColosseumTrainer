/**
 * Ocellus final-phase arena and timing rules.
 *
 * Independently implemented from observations documented in
 * Julian-Dasilva/ArchiveOcellusTrainer (GPL-3.0), OcellusTimings.ts.
 * The phases, timings and floor shape are observed community data;
 * random orb placement and some single-player behaviour remain estimates.
 *
 * All times are 600ms RuneScape world ticks. Tick 0 is the start of the
 * P4 lead-in; the first inner-void stage begins at tick 8.
 */
export type Tile = Readonly<{ x: number; y: number }>;
export type Stage = "lead-in" | "inner-void" | "after-inner" | "outer-void" | "after-outer";
export type AttackStyle = "melee" | "range" | "magic";
export type EventKind =
  | "inner-start" | "outer-start" | "lifeforce-tell" | "lifeforce-hit"
  | "orb-mature" | "orb-expire" | "explosion-mark" | "explosion-hit"
  | "special-tell" | "special-hit" | "rift-spawn";

export type PhaseEvent = Readonly<{ kind: EventKind; void?: "inner" | "outer"; pulse?: number }>;
export type PhaseFrame = Readonly<{
  tick: number;
  cycle: number;
  offset: number;
  stage: Stage;
  void: "inner" | "outer" | null;
  events: readonly PhaseEvent[];
}>;

export const PLATFORM_ROWS = [
  "...?........ww",
  ".?##########ww",
  ".###########ww",
  ".###########ww",
  ".##########/w.",
  ".#########/w..",
  ".########/w...",
  ".#######ww....",
  ".######wb.....",
  ".#####ww......",
  ".####ww.......",
  ".###ww........",
  "wwwww.........",
] as const;

export const BOARD_WIDTH = 14;
export const BOARD_HEIGHT = PLATFORM_ROWS.length;
export const BOSS_ANCHOR: Tile = { x: 4, y: 6 };
export const PLAYER_SPAWN: Tile = { x: 5, y: 1 };
export const LEAD_IN_TICKS = 8;
export const CYCLE_TICKS = 60;
export const MAX_HP = 5250;
export const STARTING_HP = Math.ceil(MAX_HP / 4);

export const FLOOR_TILES: readonly Tile[] = Object.freeze(
  PLATFORM_ROWS.reduce<Tile[]>((tiles, row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] === "#") tiles.push({ x, y });
    }
    return tiles;
  }, []),
);

export const HOLE_TILES: readonly Tile[] = [
  // Registered to the five-tile inner flood in the P4 Tbow walking clip.
  { x: 1, y: 5 }, { x: 1, y: 7 }, { x: 1, y: 9 },
];

const tileKey = ({ x, y }: Tile) => x + ":" + y;
const floorKeys = new Set(FLOOR_TILES.map(tileKey));
const holeKeys = new Set(HOLE_TILES.map(tileKey));

export function inPlatform(at: Tile): boolean {
  return floorKeys.has(tileKey(at));
}

export function isHole(at: Tile): boolean {
  return holeKeys.has(tileKey(at));
}

/** Five-by-five square around the three-by-three boss footprint. */
export function inNearSquare(at: Tile): boolean {
  return at.x >= 3 && at.x <= 7 && at.y >= 3 && at.y <= 7;
}

export function inBossFootprint(at: Tile): boolean {
  return at.x >= 4 && at.x <= 6 && at.y >= 4 && at.y <= 6;
}

/** Community-reported outer-void collision (not yet confirmed by logs).
 * A player already under the boss at the transition can walk out; do not
 * teleport them or trap them inside the new 3x3 obstruction. */
export function bossFootprintBlocks(stage:Stage,tile:Tile,player:Tile,alive:boolean):boolean {
  return alive && stage==="outer-void" && inBossFootprint(tile) && !inBossFootprint(player);
}

export function distance(a: Tile, b: Tile): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

export function stageAt(tick: number): PhaseFrame {
  if (!Number.isInteger(tick) || tick < 0) throw new RangeError("P4 tick must be >= 0");
  if (tick < LEAD_IN_TICKS) {
    return { tick, cycle: 0, offset: tick, stage: "lead-in", void: null, events: [] };
  }
  const sinceStart = tick - LEAD_IN_TICKS;
  const cycle = 1 + Math.floor(sinceStart / CYCLE_TICKS);
  const offset = sinceStart % CYCLE_TICKS;
  const stage: Stage = offset < 22 ? "inner-void"
    : offset < 31 ? "after-inner"
    : offset < 51 ? "outer-void"
    : "after-outer";
  const voidKind: "inner" | "outer" | null =
    stage === "inner-void" ? "inner" : stage === "outer-void" ? "outer" : null;
  const events: PhaseEvent[] = [];

  if (offset === 0) events.push({ kind: "inner-start", void: "inner" });
  if (offset === 31) events.push({ kind: "outer-start", void: "outer" });

  for (const [start, voidType, maturity, expiry] of [
    [0, "inner", 16, 28],
    [31, "outer", 41, 53],
  ] as const) {
    if (offset === start + 3) events.push({ kind: "lifeforce-tell", void: voidType });
    if (offset === start + 4) events.push({ kind: "lifeforce-hit", void: voidType });
    if (offset === maturity) events.push({ kind: "orb-mature", void: voidType });
    if (offset === expiry) events.push({ kind: "orb-expire", void: voidType });
    // Six targeted marks, each detonating a tick after it is placed.
    const firstMark = start + (voidType === "inner" ? 9 : 9);
    for (let pulse = 0; pulse < 6; pulse++) {
      if (offset === firstMark + pulse * 2) {
        events.push({ kind: "explosion-mark", void: voidType, pulse });
      }
      if (offset === firstMark + pulse * 2 + 1) {
        events.push({ kind: "explosion-hit", void: voidType, pulse });
      }
    }
  }
  // The inner and outer voids are followed by protection-prayer specials.
  if (offset === 24 || offset === 52) events.push({ kind: "special-tell" });
  if (offset === 29 || offset === 57) events.push({ kind: "special-hit" });
  // One tick before cycle 2 and later, new rifts appear.
  if (offset === 59) events.push({ kind: "rift-spawn" });

  return { tick, cycle, offset, stage, void: voidKind, events };
}

/**
 * Boss protection prayers, based on the documented P4 cycle.
 * Matching styles are blocked using the prayer active at projectile launch.
 * Reflected damage is omitted: the reference trainer's 10% value is
 * explicitly an owner estimate, rather than observed Ocellus evidence.
 */
export type BossOverhead = "None" | "Deflect Melee" | "Deflect Range" | "Soul Split";

/** The boss is off-stage for the first four ticks of the Phase 4 lead-in. */
export function bossVisibleAt(frame: PhaseFrame): boolean {
  return frame.tick >= 4;
}

export function bossOverheadAt(frame: PhaseFrame): BossOverhead {
  if (frame.stage === "lead-in") return "None";
  if (frame.offset <= 24) return "Deflect Melee";
  if (frame.offset <= 29) return "Soul Split";
  if (frame.offset === 30) return "None";
  if (frame.offset <= 52) return "Deflect Range";
  if (frame.offset <= 58) return "Soul Split";
  return "None";
}

/** Cache 2746 headicons_prayer sprite archive 440: exact observed Ocellus curse frames. */
export function bossOverheadSprite(frame: PhaseFrame): number | null {
  switch (bossOverheadAt(frame)) {
    case "Deflect Melee": return 15;
    case "Deflect Range": return 16;
    case "Soul Split": return 11;
    case "None": return null;
  }
}

/** The void is lethal only on its unsafe tiles, with observed grace periods. */
export function voidFloorHits(frame: PhaseFrame, at: Tile): boolean {
  if (!inPlatform(at)) return false;
  if (frame.stage === "inner-void") return frame.offset >= 2 && inNearSquare(at);
  if (frame.stage === "outer-void") return frame.offset >= 36 && !inNearSquare(at);
  return false;
}

/** Deterministic independent random value for reproducible boss mechanics. */
export function random01(seed: number, a: number, b = 0): number {
  let value = (Math.trunc(seed) ^ Math.imul(a + 17, 0x45d9f3b) ^ Math.imul(b + 31, 0x27d4eb2d)) | 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  value ^= value >>> 16;
  return (value >>> 0) / 4294967296;
}

/** The outer lifeforce orb appears on the 5x5 ring, as far as possible
 * from where the player entered that ring. When the player approaches
 * from outside, use their current position as the anchor instead.
 * The actual entry tracking is owned by Phase4Simulation, not the renderer.
 */
export function outerOrbLocation(entry: Tile, seed: number, tick: number): Tile {
  const ring = FLOOR_TILES.filter((at) =>
    inNearSquare(at) && !inBossFootprint(at) && !isHole(at));
  if (ring.length === 0) throw new Error("Ocellus outer orb ring has no valid floor tiles");
  const squaredDistance = (at: Tile) =>
    (at.x - entry.x) ** 2 + (at.y - entry.y) ** 2;
  const farthest = Math.max(...ring.map(squaredDistance));
  const candidates = ring.filter((at) => squaredDistance(at) === farthest);
  // Stable tie-breaking ensures the same seed and entry replay the same view.
  const pick = Math.floor(random01(seed, tick, 23) * candidates.length);
  return candidates[pick];
}

/** Prefer a safe orb within 2-5 Chebyshev tiles of the player. */
export function orbLocation(player: Tile, voidType: "inner" | "outer", seed: number, tick: number): Tile {
  const safe = FLOOR_TILES.filter((at) =>
    !isHole(at) && !inBossFootprint(at)
    && !(voidType === "inner" ? inNearSquare(at) : !inNearSquare(at)));
  const allowed = safe.filter(at => distance(at, player) >= 2 && distance(at, player) <= 5);
  // If the player is too far from safe floor, use the nearest legal
  // fragment tile, never an unsafe tile or an unrelated spawn location.
  const nearest = Math.min(...safe.map(at => distance(at, player)));
  const candidates = allowed.length ? allowed : safe.filter(at => distance(at, player) === nearest);
  const index = Math.floor(random01(seed, tick, voidType === "inner" ? 1 : 2) * candidates.length);
  return candidates[index] ?? PLAYER_SPAWN;
}

export function specialStyle(seed: number, cycle: number, nth: 0 | 1): AttackStyle {
  const choices: readonly AttackStyle[] = ["melee", "range", "magic"];
  return choices[Math.floor(random01(seed, cycle, nth + 10) * choices.length)];
}

export function riftLocations(seed: number, cycle: number, count: number): readonly Tile[] {
  const at = FLOOR_TILES.filter((tile) => !isHole(tile) && !inNearSquare(tile)
    && distance(tile, { x: 5, y: 5 }) >= 3);
  const picked: Tile[] = [];
  for (let i = 0; i < count && at.length; i++) {
    const index = Math.floor(random01(seed, cycle, i + 18) * at.length);
    picked.push(at.splice(index, 1)[0]);
  }
  return picked;
}
