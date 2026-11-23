import { FLOOR_TILES, inNearSquare } from "../Phase4Rules";
import {
  DIAGONAL_WALKWAY_TILES, WALKWAY_TILES, cliffBoundarySegments, floodedDiagonalWalkways,
  voidRimSegments, voidSurfaceTriangles, nativeVoidUv,
  NATIVE_VOID_TEXTURE_TILES, stoneSurfaceTriangles,
} from "../OcellusArenaTopology";

describe("original Ocellus region 16472 arena topology", () => {
  test("one stone floor mesh retains exactly 84 non-overlapping full tiles", () => {
    const triangles = stoneSurfaceTriangles(FLOOR_TILES);
    expect(FLOOR_TILES).toHaveLength(84);
    expect(triangles).toHaveLength(168);
    for (const [index, { x, y }] of FLOOR_TILES.entries()) {
      // Exactly two upward-facing triangles per original RuneScape floor tile.
      expect(triangles.slice(index * 2, index * 2 + 2)).toEqual([
        [{ x, z: y - 1 }, { x: x + 1, z: y }, { x: x + 1, z: y - 1 }],
        [{ x, z: y - 1 }, { x, z: y }, { x: x + 1, z: y }],
      ]);
    }
    // The diagonal curb geometry is separate from the batched stone floor.
    expect(stoneSurfaceTriangles([{ x: 1, y: 2 }])).toHaveLength(2);
  });

  test("native game-cache stars repeat consistently across floor tiles", () => {
    expect(NATIVE_VOID_TEXTURE_TILES).toBe(2);
    expect(nativeVoidUv({ x: 0, z: 0 })).toEqual([0, 0]);
    expect(nativeVoidUv({ x: 1, z: -1 })).toEqual([0.5, -0.5]);
    expect(nativeVoidUv({ x: 2, z: -2 })).toEqual([1, -1]);
  });
  test("exposed cliff geometry follows only the outer stone boundary", () => {
    expect(FLOOR_TILES).toHaveLength(84);
    expect(WALKWAY_TILES).toHaveLength(29);
    const segments = cliffBoundarySegments(FLOOR_TILES, WALKWAY_TILES);
    expect(segments).toHaveLength(22);
    const unique = new Set(segments.map(({ from, to }) =>
      [from.x, from.z, to.x, to.z].join(":")));
    expect(unique.size).toBe(segments.length);
    // The original diagonal curb is internal to the surviving platform,
    // not a vertical cliff or collision barrier.
    expect(segments.every((edge) =>
      !((edge.from.x === 11 || edge.to.x === 11)
        && edge.from.z === 4 && edge.to.z === 3))).toBe(true);
  });

  test("a standalone tile has four cliff faces and a curb hides its neighbour face", () => {
    const floor = [{ x: 2, y: 3 }];
    expect(cliffBoundarySegments(floor, [])).toHaveLength(4);
    expect(cliffBoundarySegments(floor, [{ x: 3, y: 3 }])).toHaveLength(3);
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
