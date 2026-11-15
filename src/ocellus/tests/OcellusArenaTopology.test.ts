import { FLOOR_TILES, inNearSquare } from "../Phase4Rules";
import {
  DIAGONAL_WALKWAY_TILES, floodedDiagonalWalkways,
  voidRimSegments, voidSurfaceTriangles, nativeVoidUv,
  NATIVE_VOID_TEXTURE_TILES,
} from "../OcellusArenaTopology";

describe("original Ocellus region 16472 arena topology", () => {
  test("native game-cache stars repeat consistently across floor tiles", () => {
    expect(NATIVE_VOID_TEXTURE_TILES).toBe(2);
    expect(nativeVoidUv({ x: 0, z: 0 })).toEqual([0, 0]);
    expect(nativeVoidUv({ x: 1, z: -1 })).toEqual([0.5, -0.5]);
    expect(nativeVoidUv({ x: 2, z: -2 })).toEqual([1, -1]);
  });
  const inner = FLOOR_TILES.filter(inNearSquare);
  const outer = FLOOR_TILES.filter((tile) => !inNearSquare(tile));

  test("the three original diagonals are included only in the outer void", () => {
    expect(DIAGONAL_WALKWAY_TILES).toEqual([
      { x: 11, y: 4 }, { x: 10, y: 5 }, { x: 9, y: 6 },
    ]);
    expect(floodedDiagonalWalkways(inner)).toEqual([]);
    expect(floodedDiagonalWalkways(outer)).toEqual(DIAGONAL_WALKWAY_TILES);
  });
  test("a flooded diagonal is exactly the northwest triangle of its cache tile", () => {
    expect(voidSurfaceTriangles(inner)).toHaveLength(inner.length * 2);
    expect(voidSurfaceTriangles(outer)).toHaveLength(outer.length * 2 + 3);
    const final = voidSurfaceTriangles(outer).slice(-3);
    expect(final[0]).toEqual([
      { x: 11, z: 3 }, { x: 11, z: 4 }, { x: 12, z: 3 },
    ]);
  });
  test("outer rim follows diagonal walls, not their invisible square edges", () => {
    const rim = voidRimSegments(outer);
    expect(rim.filter((segment) => segment.kind === "diagonal")).toHaveLength(3);
    expect(rim).toContainEqual({
      from: { x: 12, z: 3 }, to: { x: 11, z: 4 },
      inward: { x: -Math.SQRT1_2, z: -Math.SQRT1_2 }, kind: "diagonal",
    });
    expect(voidRimSegments(inner).every((segment) => segment.kind === "straight")).toBe(true);
  });
});
