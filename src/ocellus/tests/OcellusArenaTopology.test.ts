import { FLOOR_TILES, inNearSquare } from "../Phase4Rules";
import {
  DIAGONAL_WALKWAY_TILES, WALKWAY_TILES, cliffBoundarySegments, insetCliffBoundary, floodedDiagonalWalkways,
  voidRimSegments, joinedVoidRim, voidSurfaceTriangles, nativeVoidUv,
  NATIVE_VOID_TEXTURE_TILES, stoneSurfaceTriangles, voidRimVertices, VOID_GLOW_PROFILE, VOID_OUTER_GLOW_RATIO, VOID_RIM_VERTICES_PER_EDGE,
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
    expect(NATIVE_VOID_TEXTURE_TILES).toBe(1);
    expect(nativeVoidUv({ x: 0, z: 0 })).toEqual([0, 0]);
    expect(nativeVoidUv({ x: 1, z: -1 })).toEqual([1, -1]);
    expect(nativeVoidUv({ x: 2, z: -2 })).toEqual([2, -2]);
  });
  test("exposed cliff geometry follows the entire platform including the raised curb", () => {
    expect(FLOOR_TILES).toHaveLength(84);
    expect(WALKWAY_TILES).toHaveLength(29);
    const segments = cliffBoundarySegments(FLOOR_TILES, WALKWAY_TILES);
    const occupied = new Set([...FLOOR_TILES, ...WALKWAY_TILES].map(({x, y}) => x + ":" + y));
    let perimeter = 0;
    for (const {x, y} of [...FLOOR_TILES, ...WALKWAY_TILES]) {
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        if (!occupied.has((x + dx) + ":" + (y + dy))) perimeter++;
      }
    }
    expect(segments).toHaveLength(perimeter);
    expect(segments.length).toBeGreaterThan(22);
    const unique = new Set(segments.map(({ from, to }) =>
      [from.x, from.z, to.x, to.z].join(":")));
    expect(unique.size).toBe(segments.length);
    // The original diagonal curb is internal to the surviving platform,
    // not a vertical cliff or collision barrier.
    expect(segments.every((edge) =>
      !((edge.from.x === 11 || edge.to.x === 11)
        && edge.from.z === 4 && edge.to.z === 3))).toBe(true);
  });

  test("adjacent floor and curb tiles form one continuous six-edge foundation", () => {
    const floor = [{ x: 2, y: 3 }];
    expect(cliffBoundarySegments(floor, [])).toHaveLength(4);
    expect(cliffBoundarySegments(floor, [{ x: 3, y: 3 }])).toHaveLength(6);
    expect(cliffBoundarySegments(floor, floor)).toHaveLength(4);
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

test("recessed cliff corners join exactly without vertical seams",()=>{
 const edges=insetCliffBoundary(cliffBoundarySegments([{x:2,y:3}],[]),.2);
 expect(edges).toContainEqual({from:{x:2.2,z:2.2},to:{x:2.2,z:2.8}});
 expect(edges).toContainEqual({from:{x:2.2,z:2.8},to:{x:2.8,z:2.8}});
 const assertClosed=(tiles:readonly {x:number;y:number}[])=>{
   const result=insetCliffBoundary(cliffBoundarySegments(tiles,[]),.2);
   const points=(p:{x:number;z:number})=>p.x+":"+p.z;
   expect(result.map(e=>points(e.from)).sort()).toEqual(result.map(e=>points(e.to)).sort());
 };
 assertClosed([{x:0,y:0},{x:1,y:0},{x:0,y:1}]);
 assertClosed([{x:0,y:0},{x:1,y:1}]);
 assertClosed([...FLOOR_TILES,...WALKWAY_TILES]);
});

test("void rim glow joins both cardinal and diagonal corners at the intended thickness",()=>{
 for(const tiles of [[{x:2,y:3}],[{x:2,y:3},{x:3,y:3},{x:2,y:4}],[{x:0,y:0},{x:1,y:1}],FLOOR_TILES.filter(inNearSquare),FLOOR_TILES.filter(t=>!inNearSquare(t))]){
  const edges=joinedVoidRim(tiles,.18);
  const point=(p:{x:number;z:number})=>p.x.toFixed(8)+":"+p.z.toFixed(8);
  const directed=edges.map(e=>(e.to.z-e.from.z)*e.inward.x-(e.to.x-e.from.x)*e.inward.z<0
    ?{from:e.innerTo,to:e.innerFrom}:{from:e.innerFrom,to:e.innerTo});
  expect(directed.map(e=>point(e.from)).sort()).toEqual(directed.map(e=>point(e.to)).sort());
  for(const e of edges){
   expect((e.innerFrom.x-e.from.x)*e.inward.x+(e.innerFrom.z-e.from.z)*e.inward.z).toBeCloseTo(.18);
   expect((e.innerTo.x-e.to.x)*e.inward.x+(e.innerTo.z-e.to.z)*e.inward.z).toBeCloseTo(.18);
  }
  expect(edges.map(({from,to,inward,kind})=>({from,to,inward,kind}))).toEqual(voidRimSegments(tiles));
 }
});

test("void glow uses joined inner, outer and vertical gradients while retaining the true boundary",()=>{
 for(const tiles of [FLOOR_TILES.filter(inNearSquare),FLOOR_TILES.filter(t=>!inNearSquare(t))]){
  const edges=joinedVoidRim(tiles,.18),outer=joinedVoidRim(tiles,-.18*VOID_OUTER_GLOW_RATIO),base=-.485;
  const {positions,alphas}=voidRimVertices(tiles,base,.18,.15);
  const count=VOID_RIM_VERTICES_PER_EDGE;
  expect(positions.length).toBe(edges.length*count*3);
  expect(alphas.length).toBe(edges.length*count);
  for(let i=0;i<edges.length;i++){
   const e=edges[i],o=outer[i],p=i*count*3,q=i*count;
   expect(positions.slice(p,p+6)).toEqual([e.from.x,base,e.from.z,e.to.x,base,e.to.z]);
   expect(positions.slice(p+54,p+60)).toEqual([e.from.x,base,e.from.z,e.to.x,base,e.to.z]);
   const edgeEnd=p+54+48;
   expect(positions[edgeEnd]).toBeCloseTo(o.innerTo.x);
   expect(positions[edgeEnd+2]).toBeCloseTo(o.innerTo.z);
   expect(alphas[q]).toBe(1);
   expect(alphas[q+2]).toBe(VOID_GLOW_PROFILE[1][1]);
   for(const j of [17,35,53])expect(alphas[q+j]).toBe(0);
   expect(positions[p+count*3-2]).toBeCloseTo(base+.15);
  }
 }
 expect(voidRimVertices([],0,0,.15)).toEqual({positions:[],alphas:[]});
});
