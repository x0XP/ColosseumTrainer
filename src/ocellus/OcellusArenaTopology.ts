import { PLATFORM_ROWS } from "./Phase4Rules";
import type { Tile } from "./Phase4Rules";

/** X/Z coordinates in the RuneScape SDK tile convention: tile y spans z=y-1..y. */
export type Point2 = Readonly<{ x: number; z: number }>;

/** Cache texture 215 is a 128x128 starfield. Tile repetition is calibrated
 * from the observed P4 galaxy-floor star density, not from missing map UVs.
 */
export const NATIVE_VOID_TEXTURE_TILES = 2;
export function nativeVoidUv(point: Point2): [number, number] {
  return [point.x / NATIVE_VOID_TEXTURE_TILES, point.z / NATIVE_VOID_TEXTURE_TILES];
}
export type ArenaRimSegment = Readonly<{
  from: Point2;
  to: Point2;
  inward: Point2;
  kind: "straight" | "diagonal";
}>;

const tileKey = ({ x, y }: Tile) => `${x}:${y}`;
/** The curb is non-walkable scenery; omit it when finding exposed cliff faces. */
export const WALKWAY_TILES: readonly Tile[] = Object.freeze(
  PLATFORM_ROWS.flatMap((row, y) => [...row].flatMap((glyph, x) =>
    "wb/".includes(glyph) ? [{ x, y }] : [])),
);

export type CliffBoundarySegment = Readonly<{ from: Point2; to: Point2 }>;

/** The surviving quadrant's exposed stone sides, not the internal raised curb.
 * The underlying room map is unavailable from the pinned cache; this boundary
 * is derived from the verified 84 floor tiles and 29 curb tiles instead.
 */
export function cliffBoundarySegments(floor: readonly Tile[], curb: readonly Tile[]): readonly CliffBoundarySegment[] {
  const occupied = new Set([...floor, ...curb].map(tileKey));
  const outside = (x: number, y: number) => !occupied.has(tileKey({ x, y }));
  const segments: CliffBoundarySegment[] = [];
  const add = (from: Point2, to: Point2) => segments.push({ from, to });
  for (const { x, y } of floor) {
    if (outside(x - 1, y)) add({ x, z: y - 1 }, { x, z: y });
    if (outside(x + 1, y)) add({ x: x + 1, z: y }, { x: x + 1, z: y - 1 });
    if (outside(x, y - 1)) add({ x: x + 1, z: y - 1 }, { x, z: y - 1 });
    if (outside(x, y + 1)) add({ x, z: y }, { x: x + 1, z: y });
  }
  return segments;
}

export const DIAGONAL_WALKWAY_TILES: readonly Tile[] = Object.freeze(
  PLATFORM_ROWS.flatMap((row, y) =>
    [...row].flatMap((symbol, x) => symbol === "/" ? [{ x, y }] : [])),
);

/**
 * The original region 16472 map has three type-9 diagonal walls.
 * Each tile keeps its NW floor triangle when BOTH its west and north
 * neighbours flood, so the border follows the diagonal and not a stair step.
 */
export function floodedDiagonalWalkways(unsafe: readonly Tile[]): readonly Tile[] {
  const set = new Set(unsafe.map(tileKey));
  return DIAGONAL_WALKWAY_TILES.filter(({ x, y }) =>
    set.has(tileKey({ x: x - 1, y })) && set.has(tileKey({ x, y: y - 1 })));
}

/** The full 84-tile stone floor uses one static two-triangle quad per tile.
 * Do not extend the stone floor into the three raised diagonal curb halves.
 * Void flooding adds these diagonal halves separately below.
 */
export function stoneSurfaceTriangles(floor: readonly Tile[]): readonly (readonly [Point2, Point2, Point2])[] {
  const result: [Point2, Point2, Point2][] = [];
  for (const { x, y } of floor) {
    const nw = { x, z: y - 1 }, ne = { x: x + 1, z: y - 1 };
    const sw = { x, z: y }, se = { x: x + 1, z: y };
    result.push([nw, se, ne], [nw, sw, se]);
  }
  return result;
}

export function voidSurfaceTriangles(unsafe: readonly Tile[]): readonly (readonly [Point2, Point2, Point2])[] {
  const result: (readonly [Point2, Point2, Point2])[] = [...stoneSurfaceTriangles(unsafe)];
  for (const { x, y } of floodedDiagonalWalkways(unsafe)) {
    result.push([{ x, z: y - 1 }, { x, z: y }, { x: x + 1, z: y - 1 }]);
  }
  return result;
}

export function voidRimSegments(unsafe: readonly Tile[]): readonly ArenaRimSegment[] {
  const set = new Set(unsafe.map(tileKey));
  const flooded = floodedDiagonalWalkways(unsafe);
  const floodedKeys = new Set(flooded.map(tileKey));
  const segments: ArenaRimSegment[] = [];
  const present = (tile: Tile) => set.has(tileKey(tile));
  const add = (from: Point2, to: Point2, inward: Point2) =>
    segments.push({ from, to, inward, kind: "straight" });
  for (const { x, y } of unsafe) {
    if (!present({ x: x - 1, y }))
      add({ x, z: y - 1 }, { x, z: y }, { x: 1, z: 0 });
    if (!present({ x: x + 1, y }) && !floodedKeys.has(tileKey({ x: x + 1, y })))
      add({ x: x + 1, z: y }, { x: x + 1, z: y - 1 }, { x: -1, z: 0 });
    if (!present({ x, y: y - 1 }))
      add({ x: x + 1, z: y - 1 }, { x, z: y - 1 }, { x: 0, z: 1 });
    if (!present({ x, y: y + 1 }) && !floodedKeys.has(tileKey({ x, y: y + 1 })))
      add({ x, z: y }, { x: x + 1, z: y }, { x: 0, z: -1 });
  }
  const diagonalInward = -Math.SQRT1_2;
  for (const { x, y } of flooded) {
    segments.push({
      from: { x: x + 1, z: y - 1 },
      to: { x, z: y },
      inward: { x: diagonalInward, z: diagonalInward },
      kind: "diagonal",
    });
  }
  return segments;
}
