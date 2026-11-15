import * as THREE from "three";
import {
  CacheRenderInstancedModel, CacheRenderReferences,
  CollisionType, Entity, LineOfSightMask, Settings,
} from "osrs-sdk";
import type { Location3, Model, Region } from "osrs-sdk";
import type { OcellusView } from "./OcellusRegion";
import { effectCue } from "./OcellusVisualCues";
import type { EffectLayer, VisualCue } from "./OcellusVisualCues";

/**
 * The effects are real RuneScape cache spotanims, not procedural placeholders.
 * Each layer keeps a single SDK-rendered instance and changes it only when
 * the encounter changes cue. The effect is visual; mechanics remain in P4.
 */
class CachedEffectModel implements Model {
  private playing: CacheRenderInstancedModel | null = null;
  private currentKey: string | null = null;
  private ended = false;
  private age: { tick: number; percent: number; fed: number } | null = null;

  constructor(
    private readonly entity: Entity,
    private readonly read: () => VisualCue | null,
  ) {}

  private fightSeconds(progress: number): number {
    const tick = this.entity.region.world.globalTickCounter;
    const previous = this.age;
    if (!previous) {
      this.age = { tick, percent: progress, fed: 0 };
      return 0;
    }
    const seconds = (tick - previous.tick + progress - previous.percent) * (Settings.tickMs / 1000);
    const elapsed = Math.max(0, seconds - previous.fed);
    previous.fed += elapsed;
    return elapsed;
  }

  draw(scene: THREE.Scene, clockDelta: number, progress: number,
    location: Location3, angle: number, pitch: number, visible: boolean,
    offsets: Location3[]): void {
    const cue = this.read();
    const changed = this.currentKey !== cue?.key;
    if (this.playing && (!cue || changed || (cue.loops && this.ended))) {
      this.playing.destroy(scene);
      this.playing = null;
      this.currentKey = null;
      this.age = null;
    }
    if (!this.playing && cue) {
      this.ended = false;
      this.currentKey = cue.key;
      this.playing = CacheRenderInstancedModel.forRenderable(
        this.entity,
        CacheRenderReferences.spotAnim([{ id: cue.spotAnim }]),
        { onSpotAnimComplete: () => { this.ended = true; } },
      );
    }
    if (this.playing && cue) {
      // The explosion mark is synchronized to 600ms game ticks rather than
      // a potentially delayed browser render frame.
      const elapsed = cue.spotAnim === 4339 ? this.fightSeconds(progress) : clockDelta;
      this.playing.draw(scene, elapsed, progress, location, angle, pitch, visible, offsets);
    }
  }
  getWorldPosition(): THREE.Vector3 {
    return this.playing?.getWorldPosition() ?? new THREE.Vector3();
  }
  async preload(): Promise<void> {}
  destroy(scene: THREE.Scene): void {
    this.playing?.destroy(scene);
    this.playing = null;
  }
}

/**
 * Three permanent visual actors avoid recreating cache rendering pools per
 * arena tick: the two lifeforce orbs and the active explosion mark.
 */
export class OcellusSpotEffect extends Entity {
  constructor(
    region: Region,
    private readonly layer: EffectLayer,
    private readonly readState: () => OcellusView,
  ) {
    super(region, { x: 0, y: 0 });
  }
  private cue(): VisualCue | null {
    return effectCue(this.readState(), this.layer);
  }
  override get collisionType(): CollisionType { return CollisionType.NONE; }
  override get lineOfSight(): LineOfSightMask { return LineOfSightMask.NONE; }
  override get drawOutline(): boolean { return false; }
  override visible(): boolean { return this.cue() !== null; }
  override getPerceivedLocation(): Location3 {
    const tile = this.cue()?.tile;
    return tile ? { x: tile.x, y: tile.y, z: 0 } : { x: 0, y: 0, z: 0 };
  }
  override draw(): void { /* 2D mode has tile indicators; no blue entity squares. */ }
  protected override create3dModel(): Model {
    return new CachedEffectModel(this, () => this.cue());
  }
}
