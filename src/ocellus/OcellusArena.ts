import * as THREE from "three";
import {
  CacheRenderInstancedModel, CacheRenderReferences,
  CollisionType, Entity, LineOfSightMask, GROUND_OVERLAY_Y,
} from "osrs-sdk";
import type { Location3, Model, Region } from "osrs-sdk";
import { BOARD_WIDTH, BOARD_HEIGHT, FLOOR_TILES, PLATFORM_ROWS, HOLE_TILES, inNearSquare } from "./Phase4Rules";
import type { Tile } from "./Phase4Rules";
import type { OcellusView } from "./OcellusRegion";
import { cliffBoundarySegments, insetCliffBoundary, voidSurfaceTriangles, voidRimSegments, nativeVoidUv, stoneSurfaceTriangles } from "./OcellusArenaTopology";
import { loadArenaJson, loadArenaImage } from "./OcellusArenaAssets";
import { fixtureHeight, fixtureRotation } from "./OcellusNativeScenery";
import type { NativeFixture } from "./OcellusNativeScenery";

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
// The recovered rock tops are at -1/128 (floor) and 63/128 (curb).
const NATIVE_FLOOR_Y = GROUND_OVERLAY_Y - 1 / 128;
const CURB_HEIGHT = 0.5;
const CLIFF_DEPTH = 1.7;
const RIM = "#9f48bd";

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

/** One native-coloured surface, retaining the 84-tile geometry and exact
 * cache floor height. The baked texture comes from original rock faces.
 * UV v=0 is the north row (image data uses flipY=false).
 */
function stoneFloorMesh(texture: THREE.Texture): THREE.Mesh {
  const positions: Vertex[] = [];
  const uv: [number, number][] = [];
  for (const triangle of stoneSurfaceTriangles(FLOOR_TILES)) {
    for (const corner of triangle) {
      positions.push(v(corner.x, NATIVE_FLOOR_Y, corner.z));
      uv.push([corner.x / BOARD_WIDTH, (corner.z + 1) / BOARD_HEIGHT]);
    }
  }
  const mesh = new THREE.Mesh(geometry(positions, undefined, uv), new THREE.MeshBasicMaterial({
    map: texture, side: THREE.DoubleSide,
  }));
  mesh.name = "ocellus-native-stone-floor";
  return mesh;
}

/** Reconstructed standing-quadrant depth. All geometry sits below the floor,
 * so it cannot obscure game-cache NPCs, floor effects or walkable tiles.
 * It does not reproduce the missing 16472 room archive or affect collision.
 */
function cliffMesh(inset: number, backingTiles: readonly Tile[]): THREE.Mesh {
  const points: Vertex[] = [];
  const colours: string[] = [];
  for (const { from, to } of insetCliffBoundary(cliffBoundarySegments(FLOOR_TILES, backingTiles),inset)) {
    const a = v(from.x, STONE - 0.004, from.z);
    const b = v(to.x, STONE - 0.004, to.z);
    const c = v(to.x, STONE - CLIFF_DEPTH, to.z);
    const d = v(from.x, STONE - CLIFF_DEPTH, from.z);
    points.push(a, b, c, a, c, d);
    // Fade the exposed stone down into the black, fallen quadrants.
    // Match the green-grey native rock instead of conspicuous grey slabs.
    colours.push("#384132", "#384132", "#101713", "#384132", "#101713", "#101713");
  }
  const mesh=new THREE.Mesh(geometry(points, colours), new THREE.MeshBasicMaterial({
    vertexColors: true, side: THREE.DoubleSide,
  }));
  mesh.name="ocellus-recessed-cliff-backing";
  return mesh;
}

/** Native rock facets recovered from plane 1 and clipped at build time.
 * No geometry above the floor or outside the surviving quadrant is allowed.
 * Native HSL face colours are shaded into the existing dark abyss; the
 * inset reconstructed cliff is retained behind them for coverage.
 */
async function loadNativeFoundation(): Promise<{ mesh: THREE.Mesh; backingTiles: readonly Tile[] }> {
  const data = await loadArenaJson("ocellus-native-foundation.json");
  // The shared asset loader has already checked source IDs and all vertices.
  if(!data.backingTiles)throw new Error("Missing native cliff backing footprint");
  const points = new Float32Array(data.positions.length);
  const colours = new Float32Array(data.positions.length);
  const colour = new THREE.Color();
  for (let i = 0; i < data.positions.length; i += 3) {
    const x = data.positions[i], y = data.positions[i + 1], z = data.positions[i + 2];
    if (![x,y,z].every(Number.isFinite) || y > -0.015 || y < -1.69) throw new Error("Native rock exceeds visual depth");
    points[i] = x; points[i + 1] = GROUND_OVERLAY_Y + y; points[i + 2] = z;
    const rgb = data.vertexColors[i / 3];
    if (!Number.isInteger(rgb) || rgb < 0 || rgb > 0xffffff) throw new Error("Invalid lit native vertex colour");
    colour.setHex(rgb);
    colour.multiplyScalar(0.35 + 0.65 * Math.max(0, 1 + y / CLIFF_DEPTH));
    colours.set([colour.r, colour.g, colour.b], i);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(points,3));
  geo.setAttribute("color", new THREE.BufferAttribute(colours,3));
  const mesh = new THREE.Mesh(geo,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide}));
  mesh.name = "ocellus-native-rock-foundation";
  return { mesh, backingTiles: data.backingTiles };
}

/** Original clipped curb faces. Heights are in the same cache coordinate
 * system as the native playable floor, so their shared edge remains aligned.
 */
async function loadNativeCurb(): Promise<THREE.Mesh> {
  const data = await loadArenaJson("ocellus-native-curb.json");
  // Validated before caching; each arena owns its own GPU buffers.
  const points = new Float32Array(data.positions.length);
  const colours = new Float32Array(data.positions.length);
  const colour = new THREE.Color();
  for (let i = 0; i < data.positions.length; i += 3) {
    const x=data.positions[i], y=data.positions[i+1], z=data.positions[i+2];
    if (![x,y,z].every(Number.isFinite) || y < -1/128-1e-6 || y > .75+1e-6) throw new Error("Native curb outside recovered height band");
    points[i]=x; points[i+1]=GROUND_OVERLAY_Y+y; points[i+2]=z;
    const rgb = data.vertexColors[i / 3];
    if (!Number.isInteger(rgb) || rgb < 0 || rgb > 0xffffff) throw new Error("Invalid lit native vertex colour");
    colour.setHex(rgb);
    colours.set([colour.r,colour.g,colour.b],i);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position",new THREE.BufferAttribute(points,3));
  geo.setAttribute("color",new THREE.BufferAttribute(colours,3));
  const mesh = new THREE.Mesh(geo,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide}));
  mesh.name="ocellus-native-curb";
  return mesh;
}

function abyssMesh(): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(BOARD_WIDTH * 4, BOARD_HEIGHT * 4).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x05070b, side: THREE.DoubleSide }),
  );
  mesh.name="ocellus-abyss";
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
  private readonly foundationReady: Promise<void>;
  private readonly curbReady: Promise<void>;
  private readonly floorTexture: THREE.Texture;
  private readonly floorReady: Promise<void>;
  private destroyed = false;

  constructor(private readonly read: () => OcellusView) {
    // The ground uses the native texture 215 star positions with the
    // measured flood palette; model textures 215 remain unmodified.
    // A loader promise prevents silently displaying a placeholder.
    this.texture = new THREE.Texture();
    this.texture.flipY = false;
    this.texture.wrapS = THREE.RepeatWrapping;
    this.texture.wrapT = THREE.RepeatWrapping;
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.floorTexture = new THREE.Texture();
    this.floorTexture.flipY = false;
    this.floorTexture.colorSpace = THREE.SRGBColorSpace;
    this.floorTexture.magFilter = THREE.NearestFilter;
    this.floorTexture.minFilter = THREE.NearestFilter;
    this.floorTexture.generateMipmaps = false;
    // Each attempt owns its GPU textures; the decoded CPU-side images
    // are shared. A late load cannot resurrect a destroyed GPU texture.
    this.textureReady = loadArenaImage("ocellus-flood.png").then(image=>{
      if (!this.destroyed) { this.texture.image=image; this.texture.needsUpdate=true; }
    });
    this.floorReady = loadArenaImage("ocellus-native-floor.png").then(image=>{
      if (!this.destroyed) { this.floorTexture.image=image; this.floorTexture.needsUpdate=true; }
    });
    this.inner = makeVoidLayer(floorMask(true), this.texture);
    this.outer = makeVoidLayer(floorMask(false), this.texture);
    this.root.name="ocellus-arena";
    this.inner.name="ocellus-inner-void";
    this.outer.name="ocellus-outer-void";
    this.inner.visible=false;
    this.outer.visible=false;
    this.root.add(abyssMesh(), stoneFloorMesh(this.floorTexture), this.inner, this.outer);
    this.curbReady = loadNativeCurb().then(mesh => {
      if (this.destroyed) { mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); return; }
      this.root.add(mesh);
    });
    this.foundationReady = loadNativeFoundation().then(({ mesh, backingTiles }) => {
      if (this.destroyed) { mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); return; }
      this.root.add(cliffMesh(0.20, backingTiles), mesh);
    });
  }

  draw(scene: THREE.Scene, delta: number, _progress: number, _location: Location3,
    _angle: number, _pitch: number, visible: boolean): void {
    if(this.destroyed)return;
    if (this.root.parent !== scene) scene.add(this.root);
    const state = this.read();
    this.root.visible = visible;
    this.inner.visible = state.frame.stage === "inner-void";
    this.outer.visible = state.frame.stage === "outer-void";

  }

  getWorldPosition(): THREE.Vector3 { return this.root.getWorldPosition(new THREE.Vector3()); }
  async preload(): Promise<void> {
    await Promise.all([this.textureReady, this.foundationReady, this.floorReady, this.curbReady]);
  }
  destroy(scene: THREE.Scene): void {
    if(this.destroyed)return;
    this.destroyed = true;
    if (this.root.parent === scene) scene.remove(this.root);
    this.root.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      node.geometry.dispose();
      const material = node.material;
      if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
      else material.dispose();
    });
    this.root.clear();
    this.texture.dispose();
    this.floorTexture.dispose();
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

/** Original static-map scenery at the censer tile. No mechanics/collision. */
export class OcellusNativeFixture extends Entity {
  constructor(region: Region, private readonly fixture: NativeFixture) {
    super(region, { ...fixture.tile });
  }
  override get collisionType(): CollisionType { return CollisionType.NONE; }
  override get lineOfSight(): LineOfSightMask { return LineOfSightMask.NONE; }
  override get drawOutline(): boolean { return false; }
  override get animationIndex(): number { return this.fixture.animation; }
  override draw(): void { /* Native 3D scenery only. */ }
  override getPerceivedLocation(): Location3 {
    return { ...this.location, z: fixtureHeight(this.fixture) };
  }
  override getPerceivedRotation(): number { return fixtureRotation(this.fixture); }
  override create3dModel(): Model {
    return CacheRenderInstancedModel.forRenderable(this, CacheRenderReferences.model(this.fixture.modelId));
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
