import type { Tile } from "./Phase4Rules";

/** Region 16472, plane 1, local (40,32); decoded from cache 2746.
 * Map objects 62894 and 62895 occupy the censer tile. Their cache object
 * transforms are preserved separately from raw model geometry.
 * These are the low stand and animated flame visible behind the boss.
 */
export type NativeFixture = Readonly<{
  objectId: number;
  modelId: number;
  shape: number;
  orientation: number;
  tile: Tile;
  offsetHeight: number;
  animation: number;
}>;

export const OCELLUS_CENSER_FIXTURES = [
  { objectId: 62894, modelId: 62357, shape: 22, orientation: 3, tile: { x: 8, y: 8 }, offsetHeight: -64, animation: -1 },
  { objectId: 62895, modelId: 62739, shape: 10, orientation: 1, tile: { x: 8, y: 8 }, offsetHeight: -64, animation: 10772 },
] as const satisfies readonly NativeFixture[];

/** Cache model vertices have downward Y; SDK world Z is upwards in tiles. */
export function fixtureHeight(fixture: NativeFixture): number {
  return -fixture.offsetHeight / 128;
}

/** Raw SDK models receive an additional +PI/2 basis rotation in the
 * instancer. Cancel it, then apply the cache orientation in reflected
 * X/-Z coordinates (ObjectDefinition.getModel's quarter-turn).
 */
export function fixtureRotation(fixture: NativeFixture): number {
  return -(fixture.orientation + 1) * Math.PI / 2;
}
