import { PLATFORM_ROWS } from "./Phase4Rules";
import type { Tile } from "./Phase4Rules";

/** X/Z coordinates in the RuneScape SDK tile convention: tile y spans z=y-1..y. */
export type Point2 = Readonly<{ x: number; z: number }>;

/** Cache texture 215 is a 128x128 starfield. Tile repetition is calibrated
 * from the observed P4 galaxy-floor star density, not from missing map UVs.
 */
// Texture 215 has six distinct star clusters. One repeat per tile matches
// the reference floor's estimated six stars/tile rather than 1.5/tile.
export const NATIVE_VOID_TEXTURE_TILES = 1;
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
/** The curb is non-walkable, but shares the surviving platform's stone foundation. */
export const WALKWAY_TILES: readonly Tile[] = Object.freeze(
  PLATFORM_ROWS.flatMap((row, y) => [...row].flatMap((glyph, x) =>
    "wb/".includes(glyph) ? [{ x, y }] : [])),
);

export type CliffBoundarySegment = Readonly<{ from: Point2; to: Point2 }>;

/** The surviving quadrant's exposed stone sides, not the internal raised curb.
 * The original region is decoded, but these segments describe only the
 * fallback backing around the unchanged playable footprint.
 */
export function cliffBoundarySegments(floor: readonly Tile[], curb: readonly Tile[]): readonly CliffBoundarySegment[] {
  // The two halves of a diagonal curb tile together occupy a full tile.
  // Include the curb's outer edge: previously only floor tiles emitted cliff
  // faces, making the raised walkway appear to float beside the platform.
  const tiles = [...new Map([...floor, ...curb].map(tile => [tileKey(tile), tile])).values()];
  const occupied = new Set(tiles.map(tileKey));
  const outside = (x: number, y: number) => !occupied.has(tileKey({ x, y }));
  const segments: CliffBoundarySegment[] = [];
  const add = (from: Point2, to: Point2) => segments.push({ from, to });
  for (const { x, y } of tiles) {
    if (outside(x - 1, y)) add({ x, z: y - 1 }, { x, z: y });
    if (outside(x + 1, y)) add({ x: x + 1, z: y }, { x: x + 1, z: y - 1 });
    if (outside(x, y - 1)) add({ x: x + 1, z: y - 1 }, { x, z: y - 1 });
    if (outside(x, y + 1)) add({ x, z: y }, { x: x + 1, z: y });
  }
  return segments;
}

/** Join the recessed cardinal cliff corners instead of offsetting each edge
 * independently. Right turns separate loops that touch only at a point. */
export function insetCliffBoundary(segments:readonly CliffBoundarySegment[],inset:number):readonly CliffBoundarySegment[] {
  const key=(p:Point2)=>p.x+":"+p.z;
  const starts=new Map<string,CliffBoundarySegment[]>(),ends=new Map<string,CliffBoundarySegment[]>();
  for(const edge of segments){
    const from=key(edge.from),to=key(edge.to);
    starts.set(from,[...(starts.get(from)??[]),edge]);
    ends.set(to,[...(ends.get(to)??[]),edge]);
  }
  const normal=(e:CliffBoundarySegment)=>({x:e.to.z-e.from.z,z:e.from.x-e.to.x});
  const dot=(a:Point2,b:Point2)=>a.x*b.x+a.z*b.z;
  const turn=(a:CliffBoundarySegment,b:CliffBoundarySegment)=>{
    const n=normal(a);
    return dot(n,{x:b.to.x-b.from.x,z:b.to.z-b.from.z});
  };
  const best=(edges:readonly CliffBoundarySegment[],score:(e:CliffBoundarySegment)=>number)=>
    edges.reduce<CliffBoundarySegment|undefined>((chosen,e)=>!chosen||score(e)>score(chosen)?e:chosen,undefined);
  const joined=(p:Point2,e:CliffBoundarySegment,other?:CliffBoundarySegment):Point2=>{
    const n=normal(e),m=other?normal(other):n;
    const add=dot(n,m)===0;
    return {x:p.x+(n.x+(add?m.x:0))*inset,z:p.z+(n.z+(add?m.z:0))*inset};
  };
  return segments.map(e=>({
    from:joined(e.from,e,best(ends.get(key(e.from))??[],previous=>turn(previous,e))),
    to:joined(e.to,e,best(starts.get(key(e.to))??[],next=>turn(e,next))),
  }));
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
