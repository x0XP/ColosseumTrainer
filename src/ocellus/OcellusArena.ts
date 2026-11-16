import * as THREE from "three";
import {
  CacheRenderInstancedModel, CacheRenderReferences,
  CollisionType, Entity, LineOfSightMask, GROUND_OVERLAY_Y,
} from "osrs-sdk";
import type { Location3, Model, Region } from "osrs-sdk";
import { BOARD_WIDTH, BOARD_HEIGHT, FLOOR_TILES, PLATFORM_ROWS, HOLE_TILES, inNearSquare } from "./Phase4Rules";
import type { Tile } from "./Phase4Rules";
import type { OcellusView } from "./OcellusRegion";
import { cliffBoundarySegments, WALKWAY_TILES, voidSurfaceTriangles, voidRimSegments, nativeVoidUv } from "./OcellusArenaTopology";
import { arenaStoneCss } from "./OcellusStone";

/**
 * Visual-only Phase 4 arena. Scenery and effects have no collision, timers or
 * combat rules. Colours and shapes are based on documented arena observations;
 * effects use the native cache spotanims; remaining arena surfaces are
 * reconstructed from the observed region 16472 collision and location flags.
 */
// SDK ground floor is -0.49. Place the stone base slightly underneath
// the original void overlay to eliminate flicker and floating geometry.
const STONE = GROUND_OVERLAY_Y - 0.005;
const SURFACE = GROUND_OVERLAY_Y + 0.003;
const EDGE = SURFACE + 0.002;
const CURB_HEIGHT = 0.4;
const CLIFF_DEPTH = 1.7;
const RIM = "#9f48bd";

const walkwayAt = ({ x, y }: Tile): boolean => "wb/".includes(PLATFORM_ROWS[y]?.[x] ?? ".");
export const BRAZIER_TILES: readonly Tile[] = Object.freeze(PLATFORM_ROWS.flatMap((row, y) =>
  Array.from(row).flatMap((char, x) => char === "b" ? [{ x, y }] : [])));

type Vertex = readonly [number, number, number];
const v = (x: number, y: number, z: number): Vertex => [x, y, z];
function geometry(points: readonly Vertex[], colours?: readonly string[], uv?: readonly [number, number][]): THREE.BufferGeometry {
  const result = new THREE.BufferGeometry();
  result.setAttribute("position", new THREE.Float32BufferAttribute(points.flatMap((p) => [...p]), 3));
  if (colours) {
    const arr = colours.flatMap((col) => {
      const c = new THREE.Color(col);
      return [c.r, c.g, c.b];
    });
    result.setAttribute("color", new THREE.Float32BufferAttribute(arr, 3));
  }
  if (uv) result.setAttribute("uv", new THREE.Float32BufferAttribute(uv.flatMap((pair) => [...pair]), 2));
  return result;
}

/** Raised olive walkway and its sides, including triangular curb corners. */
function walkwayMesh(): THREE.Mesh {
  const positions: Vertex[] = [];
  const colours: string[] = [];
  const addTriangle = (a: Vertex, b: Vertex, c: Vertex, colour: string) => {
    positions.push(a, b, c);
    colours.push(colour, colour, colour);
  };
  const addQuad = (a: Vertex, b: Vertex, c: Vertex, d: Vertex, colour: string) => {
    addTriangle(a, b, c, colour);
    addTriangle(a, c, d, colour);
  };
  const top = STONE + CURB_HEIGHT;
  for (let y = 0; y < PLATFORM_ROWS.length; y++) {
    for (let x = 0; x < PLATFORM_ROWS[y].length; x++) {
      const kind = PLATFORM_ROWS[y][x];
      if (!"wb/".includes(kind)) continue;
      if (kind === "/") {
        // Raised half is southeast of the diagonal; the northwest remains floor.
        addTriangle(v(x + 1, top, y - 1), v(x + 1, top, y), v(x, top, y), "#6b6c40");
        addQuad(v(x + 1, STONE, y - 1), v(x, STONE, y), v(x, top, y), v(x + 1, top, y - 1), "#8e9a80");
        addTriangle(v(x, STONE, y - 1), v(x, STONE, y), v(x + 1, STONE, y - 1), arenaStoneCss({ x, y }));
        continue;
      }
      addQuad(v(x, top, y - 1), v(x + 1, top, y - 1), v(x + 1, top, y), v(x, top, y), "#6b6c40");
      const sides: readonly [Tile, Vertex, Vertex][] = [
        [{ x: x - 1, y }, v(x, STONE, y - 1), v(x, STONE, y)],
        [{ x: x + 1, y }, v(x + 1, STONE, y), v(x + 1, STONE, y - 1)],
        [{ x, y: y - 1 }, v(x + 1, STONE, y - 1), v(x, STONE, y - 1)],
        [{ x, y: y + 1 }, v(x, STONE, y), v(x + 1, STONE, y)],
      ];
      for (const [neighbour, a, b] of sides) {
        if (walkwayAt(neighbour)) continue;
        const c = v(b[0], top, b[2]);
        const d = v(a[0], top, a[2]);
        addQuad(a, b, c, d, neighbour.x < x || neighbour.y < y ? "#8e9a80" : "#3c4233");
      }
    }
  }
  const mesh = new THREE.Mesh(geometry(positions, colours), new THREE.MeshBasicMaterial({
    vertexColors: true, side: THREE.DoubleSide,
  }));
  return mesh;
}

/** Reconstructed standing-quadrant depth. All geometry sits below the floor,
 * so it cannot obscure game-cache NPCs, floor effects or walkable tiles.
 * It does not reproduce the missing 16472 room archive or affect collision.
 */
function cliffMesh(): THREE.Mesh {
  const points: Vertex[] = [];
  const colours: string[] = [];
  for (const { from, to } of cliffBoundarySegments(FLOOR_TILES, WALKWAY_TILES)) {
    const a = v(from.x, STONE - 0.004, from.z);
    const b = v(to.x, STONE - 0.004, to.z);
    const c = v(to.x, STONE - CLIFF_DEPTH, to.z);
    const d = v(from.x, STONE - CLIFF_DEPTH, from.z);
    points.push(a, b, c, a, c, d);
    // Fade the exposed stone down into the black, fallen quadrants.
    colours.push("#77766b", "#77766b", "#22252a", "#77766b", "#22252a", "#22252a");
  }
  return new THREE.Mesh(geometry(points, colours), new THREE.MeshBasicMaterial({
    vertexColors: true, side: THREE.DoubleSide,
  }));
}

function abyssMesh(): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(BOARD_WIDTH * 4, BOARD_HEIGHT * 4).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x05070b, side: THREE.DoubleSide }),
  );
  mesh.position.set(BOARD_WIDTH / 2, STONE - CLIFF_DEPTH - 0.01, (BOARD_HEIGHT - 1) / 2);
  return mesh;
}

function floorMask(inner: boolean): readonly Tile[] {
  return FLOOR_TILES.filter((at) => inNearSquare(at) === inner);
}

function voidGeometry(tiles: readonly Tile[]): THREE.BufferGeometry {
  const positions: Vertex[] = [];
  const uv: [number, number][] = [];
  // The original map square 16472 keeps northwest floor halves on type-9
  // diagonal walls; a plain tile mask otherwise leaves visible triangular gaps.
  for (const triangle of voidSurfaceTriangles(tiles)) {
    for (const point of triangle) {
      positions.push(v(point.x, SURFACE, point.z));
      uv.push(nativeVoidUv(point));
    }
  }
  return geometry(positions, undefined, uv);
}

function rimGeometry(tiles: readonly Tile[]): THREE.BufferGeometry {
  const positions: Vertex[] = [];
  const colours: string[] = [];
  const addQuad = (
    a: Vertex, b: Vertex, c: Vertex, d: Vertex,
    edgeColor: string, fadeColor: string,
  ) => {
    positions.push(a, b, c, a, c, d);
    colours.push(edgeColor, edgeColor, fadeColor, edgeColor, fadeColor, fadeColor);
  };
  // Two fading surfaces per border segment: a strip into the void, and
  // the wall rising out of it. The latter was missing from the old prototype.
  // Diagonal border segments come from the actual cache wall topology.
  const rimDepth = 0.18;
  const rimHeight = 0.15;
  for (const edge of voidRimSegments(tiles)) {
    const a = v(edge.from.x, EDGE, edge.from.z);
    const b = v(edge.to.x, EDGE, edge.to.z);
    const innerA = v(edge.from.x + edge.inward.x * rimDepth,
      EDGE, edge.from.z + edge.inward.z * rimDepth);
    const innerB = v(edge.to.x + edge.inward.x * rimDepth,
      EDGE, edge.to.z + edge.inward.z * rimDepth);
    addQuad(a, b, innerB, innerA, RIM, "#000000");
    const highA = v(edge.from.x, EDGE + rimHeight, edge.from.z);
    const highB = v(edge.to.x, EDGE + rimHeight, edge.to.z);
    addQuad(a, b, highB, highA, RIM, "#000000");
  }
  return geometry(positions, colours);
}

function makeVoidLayer(tiles: readonly Tile[], stars: THREE.Texture): THREE.Group {
  const group = new THREE.Group();
  group.add(new THREE.Mesh(voidGeometry(tiles), new THREE.MeshBasicMaterial({
    map: stars, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  })));
  group.add(new THREE.Mesh(rimGeometry(tiles), new THREE.MeshBasicMaterial({
    vertexColors: true, side: THREE.DoubleSide, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false,
  })));
  return group;
}

class ArenaModel implements Model {
  private readonly root = new THREE.Group();
  private readonly inner: THREE.Group;
  private readonly outer: THREE.Group;
  private readonly texture: THREE.Texture;
  private readonly textureReady: Promise<void>;

  constructor(private readonly read: () => OcellusView) {
    // Texture 215 is the original 128x128 starfield used on Ocellus's
    // native void-hole (62508) and transition (62698) game models.
    // A loader promise makes missing assets a build/runtime failure rather
    // than silently displaying the old procedurally-generated dots.
    let loaded!: () => void;
    let failed!: (error: unknown) => void;
    this.textureReady = new Promise<void>((resolve, reject) => {
      loaded = resolve;
      failed = reject;
    });
    const uri = new URL("osrs-assets/textures/215.png", document.baseURI).href;
    this.texture = new THREE.TextureLoader().load(
      uri, () => loaded(), undefined, (error) => failed(error),
    );
    // Match the SDK cache texture's row direction and the tile repeating UVs.
    this.texture.flipY = false;
    this.texture.wrapS = THREE.RepeatWrapping;
    this.texture.wrapT = THREE.RepeatWrapping;
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.inner = makeVoidLayer(floorMask(true), this.texture);
    this.outer = makeVoidLayer(floorMask(false), this.texture);
    this.root.add(abyssMesh(), cliffMesh(), walkwayMesh(), this.inner, this.outer);
  }

  draw(scene: THREE.Scene, delta: number, _progress: number, _location: Location3,
    _angle: number, _pitch: number, visible: boolean): void {
    if (this.root.parent !== scene) scene.add(this.root);
    const state = this.read();
    this.root.visible = visible;
    this.inner.visible = state.frame.stage === "inner-void";
    this.outer.visible = state.frame.stage === "outer-void";

  }

  getWorldPosition(): THREE.Vector3 { return this.root.getWorldPosition(new THREE.Vector3()); }
  async preload(): Promise<void> {
    await this.textureReady;
  }
  destroy(scene: THREE.Scene): void {
    if (this.root.parent === scene) scene.remove(this.root);
    this.root.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      node.geometry.dispose();
      const material = node.material;
      if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
      else material.dispose();
    });
    this.texture.dispose();
  }
}

export class OcellusArena extends Entity {
  constructor(region: Region, private readonly read: () => OcellusView) {
    super(region, { x: 0, y: 0 });
  }
  override get collisionType(): CollisionType { return CollisionType.NONE; }
  override get lineOfSight(): LineOfSightMask { return LineOfSightMask.NONE; }
  override get drawOutline(): boolean { return false; }
  override draw(): void { /* Three.js scenery only: prevent a blue 2D entity tile. */ }
  override create3dModel(): Model { return new ArenaModel(this.read); }
}

export class OcellusBrazier extends Entity {
  constructor(region: Region, at: Tile) { super(region, at); }
  override get collisionType(): CollisionType { return CollisionType.NONE; }
  override get lineOfSight(): LineOfSightMask { return LineOfSightMask.NONE; }
  override get drawOutline(): boolean { return false; }
  override get animationIndex(): number { return 14833; }
  override draw(): void { /* Decorative model only. */ }
  override getPerceivedLocation(): Location3 {
    return { ...this.location, z: CURB_HEIGHT };
  }
  override create3dModel(): Model {
    return CacheRenderInstancedModel.forRenderable(this, CacheRenderReferences.model(62440));
  }
}

/** Native raid object 62713 "Fire" beside the hanging Zarosian Censer.
 * The original bowl/stand still lacks a verified cache placement. */
export class OcellusFire extends Entity {
  constructor(region: Region, at: Tile) { super(region, at); }
  override get collisionType(): CollisionType { return CollisionType.NONE; }
  override get lineOfSight(): LineOfSightMask { return LineOfSightMask.NONE; }
  override get drawOutline(): boolean { return false; }
  override get animationIndex(): number { return 12005; }
  override draw(): void { /* Native 3D fire, not a 2D tile indicator. */ }
  override getPerceivedLocation(): Location3 {
    return { ...this.location, z: CURB_HEIGHT };
  }
  override create3dModel(): Model {
    return CacheRenderInstancedModel.forRenderable(this, CacheRenderReferences.model(55960));
  }
}

export class OcellusFloorHole extends Entity {
  constructor(region: Region, at: Tile, private readonly stage: () => string) {
    super(region, at);
  }
  override get collisionType(): CollisionType { return CollisionType.NONE; }
  override get lineOfSight(): LineOfSightMask { return LineOfSightMask.NONE; }
  override get drawOutline(): boolean { return false; }
  override get animationIndex(): number { return 14891; }
  override visible(): boolean { return this.stage() !== "outer-void"; }
  override draw(): void { /* FloorTile paints the 2D hole below. */ }
  override create3dModel(): Model {
    return CacheRenderInstancedModel.forRenderable(this, CacheRenderReferences.model(62508));
  }
}
