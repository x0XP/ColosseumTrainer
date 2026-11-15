import * as THREE from "three";
import {
  CacheRenderInstancedModel, CacheRenderReferences,
  CollisionType, Entity, LineOfSightMask,
} from "osrs-sdk";
import type { Location3, Model, Region } from "osrs-sdk";
import { FLOOR_TILES, PLATFORM_ROWS, HOLE_TILES, inNearSquare } from "./Phase4Rules";
import type { Tile } from "./Phase4Rules";
import type { OcellusView } from "./OcellusRegion";

/**
 * Visual-only Phase 4 arena. Scenery and effects have no collision, timers or
 * combat rules. Colours and shapes are based on documented arena observations;
 * effects use lightweight geometry until cache spotanims are calibrated.
 */
const STONE = -0.43;
const SURFACE = STONE + 0.014;
const EDGE = SURFACE + 0.007;
const CURB_HEIGHT = 0.4;
const DARK = "#1e2529";
const STAR = "#babcc2";
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
        addTriangle(v(x, STONE, y - 1), v(x, STONE, y), v(x + 1, STONE, y - 1), "#4a4339");
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

function starTexture(): THREE.Texture {
  const size = 128;
  const canvas = new OffscreenCanvas(size, size);
  const context = canvas.getContext("2d");
  if (context) {
    context.fillStyle = DARK;
    context.fillRect(0, 0, size, size);
    let seed = 0x2545f491;
    const next = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < 96; i++) {
      context.fillStyle = STAR;
      context.globalAlpha = 0.35 + 0.65 * next();
      context.fillRect(Math.floor(next() * size), Math.floor(next() * size), next() < 0.2 ? 2 : 1, 1);
    }
    context.globalAlpha = 1;
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function floorMask(inner: boolean): readonly Tile[] {
  return FLOOR_TILES.filter((at) => inNearSquare(at) === inner);
}

function voidGeometry(tiles: readonly Tile[]): THREE.BufferGeometry {
  const positions: Vertex[] = [];
  const uv: [number, number][] = [];
  for (const { x, y } of tiles) {
    const pts: readonly [number, number][] = [
      [x, y - 1], [x + 1, y], [x + 1, y - 1],
      [x, y - 1], [x, y], [x + 1, y],
    ];
    for (const [px, pz] of pts) {
      positions.push(v(px, SURFACE, pz));
      uv.push([px / 4, pz / 4]);
    }
  }
  return geometry(positions, undefined, uv);
}

function rimGeometry(tiles: readonly Tile[]): THREE.BufferGeometry {
  const occupied = new Set(tiles.map(({ x, y }) => x + ":" + y));
  const positions: Vertex[] = [];
  const colours: string[] = [];
  const add = (a: Vertex, b: Vertex, c: Vertex, d: Vertex) => {
    positions.push(a, b, c, a, c, d);
    colours.push(RIM, RIM, DARK, RIM, DARK, DARK);
  };
  for (const { x, y } of tiles) {
    const borders: readonly [Tile, readonly [number, number], readonly [number, number], readonly [number, number]][] = [
      [{ x: x - 1, y }, [x, y - 1], [x, y], [0.15, 0]],
      [{ x: x + 1, y }, [x + 1, y], [x + 1, y - 1], [-0.15, 0]],
      [{ x, y: y - 1 }, [x + 1, y - 1], [x, y - 1], [0, 0.15]],
      [{ x, y: y + 1 }, [x, y], [x + 1, y], [0, -0.15]],
    ];
    for (const [neighbour, p, q, d] of borders) {
      if (occupied.has(neighbour.x + ":" + neighbour.y)) continue;
      add(v(p[0], EDGE, p[1]), v(q[0], EDGE, q[1]),
        v(q[0] + d[0], EDGE, q[1] + d[1]), v(p[0] + d[0], EDGE, p[1] + d[1]));
    }
  }
  return geometry(positions, colours);
}

function makeVoidLayer(tiles: readonly Tile[], stars: THREE.Texture): THREE.Group {
  const group = new THREE.Group();
  group.add(new THREE.Mesh(voidGeometry(tiles), new THREE.MeshBasicMaterial({
    map: stars, side: THREE.DoubleSide,
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
  private readonly texture = starTexture();

  constructor(private readonly read: () => OcellusView) {
    this.inner = makeVoidLayer(floorMask(true), this.texture);
    this.outer = makeVoidLayer(floorMask(false), this.texture);
    this.root.add(walkwayMesh(), this.inner, this.outer);
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
  async preload(): Promise<void> {}
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
