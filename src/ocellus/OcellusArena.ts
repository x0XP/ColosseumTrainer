import * as THREE from "three";
import {
  CacheRenderInstancedModel, CacheRenderReferences,
  CollisionType, Entity, LineOfSightMask, GROUND_OVERLAY_Y,
} from "osrs-sdk";
import type { Location3, Model, Region } from "osrs-sdk";
import { BOARD_WIDTH, BOARD_HEIGHT, FLOOR_TILES, PLATFORM_ROWS, HOLE_TILES, inNearSquare } from "./Phase4Rules";
import type { Tile } from "./Phase4Rules";
import type { OcellusView } from "./OcellusRegion";
import { cliffBoundarySegments, insetCliffBoundary, voidSurfaceTriangles, voidRimVertices, nativeVoidUv, stoneSurfaceTriangles } from "./OcellusArenaTopology";
import { loadArenaJson, loadArenaImage } from "./OcellusArenaAssets";
import {NATIVE_FOUNDATION_TOP_Y,NATIVE_FOUNDATION_MIN_Y,ARENA_ABYSS_RGB,cliffDepthProfile,cliffVisibility,nativeCliffSampler} from "./OcellusNativeMesh";
import { fixtureHeight, fixtureRotation } from "./OcellusNativeScenery";
import { VOID_RIM_COLOR, VOID_RIM_DEPTH } from "./OcellusStone";
import type { NativeFixture } from "./OcellusNativeScenery";

/**
 * Visual-only Phase 4 arena. Scenery and effects have no collision, timers or
 * combat rules. Colours and shapes are based on documented arena observations;
 * effects use the native cache spotanims; remaining arena surfaces are
 * reconstructed from the observed region 16472 collision and location flags.
 */
// SDK ground floor is -0.49. Place the stone base slightly underneath
// the original void overlay to eliminate flicker and floating geometry.
const SURFACE = GROUND_OVERLAY_Y + 0.003;
const EDGE = SURFACE + 0.002;
// The recovered rock tops are at -1/128 (floor) and 63/128 (curb).
const NATIVE_FLOOR_Y = GROUND_OVERLAY_Y - 1 / 128;
const CURB_HEIGHT = 0.5;
const RIM = VOID_RIM_COLOR;

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
function cliffMesh(inset: number, backingTiles: readonly Tile[], sample: (x:number,z:number)=>number): THREE.Mesh {
  const points: Vertex[]=[];
  const colours:number[]=[];
  const profile=cliffDepthProfile(),abyss=new THREE.Color(ARENA_ABYSS_RGB);
  const append=(point:Vertex,colour:THREE.Color)=>{
    points.push(point);colours.push(colour.r,colour.g,colour.b);
  };
  // Adjacent strips share exactly the same positions and sampled colours.
  // Blend in linear working RGB, as on the recovered native foundation.
  for(const {from,to} of insetCliffBoundary(cliffBoundarySegments(FLOOR_TILES,backingTiles),inset)){
    const fromColour=new THREE.Color(sample(from.x,from.z)),toColour=new THREE.Color(sample(to.x,to.z));
    for(let i=0;i<profile.length-1;i++){
      const top=profile[i],bottom=profile[i+1];
      const a=v(from.x,GROUND_OVERLAY_Y+top.y,from.z),b=v(to.x,GROUND_OVERLAY_Y+top.y,to.z);
      const c=v(to.x,GROUND_OVERLAY_Y+bottom.y,to.z),d=v(from.x,GROUND_OVERLAY_Y+bottom.y,from.z);
      const ca=abyss.clone().lerp(fromColour,top.visibility),cb=abyss.clone().lerp(toColour,top.visibility);
      const cc=abyss.clone().lerp(toColour,bottom.visibility),cd=abyss.clone().lerp(fromColour,bottom.visibility);
      append(a,ca);append(b,cb);append(c,cc);append(a,ca);append(c,cc);append(d,cd);
    }
  }
  const geo=geometry(points);
  geo.setAttribute("color",new THREE.Float32BufferAttribute(colours,3));
  const mesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide}));
  mesh.name="ocellus-recessed-cliff-backing";
  return mesh;
}

/** Native rock facets recovered from plane 1 and clipped at build time.
 * No geometry above the floor or outside the surviving quadrant is allowed.
 * Native HSL face colours are shaded into the existing dark abyss; the
 * inset reconstructed cliff is retained behind them for coverage.
 */
async function loadNativeFoundation(): Promise<{ mesh: THREE.Mesh; backingTiles: readonly Tile[]; sample:(x:number,z:number)=>number }> {
  const data = await loadArenaJson("ocellus-native-foundation.json");
  // The shared asset loader has already checked source IDs and all vertices.
  if(!data.backingTiles)throw new Error("Missing native cliff backing footprint");
  const points = new Float32Array(data.positions.length);
  const colours = new Float32Array(data.positions.length);
  const colour = new THREE.Color(),abyss=new THREE.Color(ARENA_ABYSS_RGB);
  for (let i = 0; i < data.positions.length; i += 3) {
    const x = data.positions[i], y = data.positions[i + 1], z = data.positions[i + 2];
    if (![x,y,z].every(Number.isFinite) || y > NATIVE_FOUNDATION_TOP_Y || y < NATIVE_FOUNDATION_MIN_Y) throw new Error("Native rock exceeds visual depth");
    points[i] = x; points[i + 1] = GROUND_OVERLAY_Y + y; points[i + 2] = z;
    const rgb = data.vertexColors[i / 3];
    if (!Number.isInteger(rgb) || rgb < 0 || rgb > 0xffffff) throw new Error("Invalid lit native vertex colour");
    colour.setHex(rgb);
    colour.lerp(abyss,1-cliffVisibility(y));
    colours.set([colour.r, colour.g, colour.b], i);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(points,3));
  geo.setAttribute("color", new THREE.BufferAttribute(colours,3));
  const mesh = new THREE.Mesh(geo,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide}));
  mesh.name = "ocellus-native-rock-foundation";
  return { mesh, backingTiles: data.backingTiles, sample:nativeCliffSampler(data.positions,data.vertexColors) };
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
  const {positions,alphas}=voidRimVertices(tiles,EDGE,VOID_RIM_DEPTH,.15);
  const colour=new THREE.Color(RIM),rgba=new Float32Array(alphas.length*4);
  for(let i=0;i<alphas.length;i++)rgba.set([colour.r,colour.g,colour.b,alphas[i]],i*4);
  const result=new THREE.BufferGeometry();
  result.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
  result.setAttribute("color",new THREE.BufferAttribute(rgba,4));
  return result;
}

function makeVoidLayer(tiles: readonly Tile[], stars: THREE.Texture): THREE.Group {
  const group = new THREE.Group();
  const surface=new THREE.Mesh(voidGeometry(tiles), new THREE.MeshBasicMaterial({
    map: stars, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  }));
  surface.name="ocellus-void-surface";
  const rim=new THREE.Mesh(rimGeometry(tiles), new THREE.MeshBasicMaterial({
    vertexColors: true, side: THREE.DoubleSide, transparent: true,
    blending: THREE.NormalBlending, depthWrite: false, forceSinglePass:true,
  }));
  rim.name="ocellus-void-rim";
  group.add(surface,rim);
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
    // r163 requires LinearFilter magnification for anisotropic sampling.
    // This slightly softens close-up texels but reduces grazing-angle shimmer.
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.minFilter = THREE.LinearMipmapLinearFilter;
    this.texture.anisotropy = 4;
    this.floorTexture = new THREE.Texture();
    this.floorTexture.flipY = false;
    this.floorTexture.colorSpace = THREE.SRGBColorSpace;
    this.floorTexture.magFilter = THREE.LinearFilter;
    // r163 only applies anisotropy with linear magnification. Preserve
    // nearest texels within each mip level for the original stone facets.
    this.floorTexture.minFilter = THREE.NearestMipmapLinearFilter;
    this.floorTexture.anisotropy = 4;
    this.floorTexture.generateMipmaps = true;
    // Each attempt owns its GPU textures; the decoded CPU-side images
    // are shared. A late load cannot resurrect a destroyed GPU texture.
    this.textureReady = loadArenaImage("ocellus-flood.png").then(image=>{
      if (!this.destroyed) { this.texture.image=image; this.texture.needsUpdate=true; }
    });
    this.floorReady = loadArenaImage("ocellus-native-floor-sampling.png").then(image=>{
      if (!this.destroyed) { this.floorTexture.image=image; this.floorTexture.needsUpdate=true; }
    });
    this.inner = makeVoidLayer(floorMask(true), this.texture);
    this.outer = makeVoidLayer(floorMask(false), this.texture);
    this.root.name="ocellus-arena";
    this.inner.name="ocellus-inner-void";
    this.outer.name="ocellus-outer-void";
    this.inner.visible=false;
    this.outer.visible=false;
    // The viewport supplies one uniform scene background, not a finite plane.
    this.root.add(stoneFloorMesh(this.floorTexture), this.inner, this.outer);
    this.curbReady = loadNativeCurb().then(mesh => {
      if (this.destroyed) { mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); return; }
      this.root.add(mesh);
    });
    this.foundationReady = loadNativeFoundation().then(({ mesh, backingTiles, sample }) => {
      if (this.destroyed) { mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); return; }
      this.root.add(cliffMesh(0.20, backingTiles, sample), mesh);
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

  /** The SDK compiles the whole detached root, including hidden flood layers. */
  sceneRoot(): THREE.Object3D { return this.root; }
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
