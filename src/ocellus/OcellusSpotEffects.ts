import * as THREE from "three";
import {
  CacheRenderInstancedModel, CacheRenderReferences,
  CollisionType, Entity, LineOfSightMask, Settings,
} from "osrs-sdk";
import type { Location3, Model, Region } from "osrs-sdk";
import type { OcellusView } from "./OcellusRegion";
import { effectCue, lingeringExplosionCue, orbLeavingCue, EFFECT_LOOKS, advanceEffectClock } from "./OcellusVisualCues";
import type { EffectLayer, VisualCue, EffectClock } from "./OcellusVisualCues";

/**
 * The effects are real RuneScape cache spotanims, not procedural placeholders.
 * Each layer keeps a single SDK-rendered instance and changes it only when
 * the encounter changes cue. The effect is visual; mechanics remain in P4.
 */
// SDK instanced animation pools are built asynchronously. Without preloading,
// short effects such as the 55-cycle void explosion can start rendering late.
const warmedLooks = new Map<number, Promise<void>>();
function warmCacheEffect(entity: Entity, spotAnim: number): Promise<void> {
  const cached = warmedLooks.get(spotAnim);
  if (cached) return cached;
  const preparation = (async () => {
    const model = CacheRenderInstancedModel.forRenderable(
      entity, CacheRenderReferences.spotAnim([{ id: spotAnim }]),
    );
    try {
      await model.preload();
    } finally {
      // Release the temporary instance; the SDK keeps its decoded model pool.
      model.destroy(new THREE.Scene());
    }
  })().catch((error) => {
    warmedLooks.delete(spotAnim);
    throw error;
  });
  warmedLooks.set(spotAnim, preparation);
  return preparation;
}

class CachedEffectModel implements Model {
  private playing: CacheRenderInstancedModel | null = null;
  private currentKey: string | null = null;
  private ended = false;
  private age: EffectClock | null = null;
  private generation = 0;

  constructor(
    private readonly entity: Entity,
    private readonly read: () => VisualCue | null,
    private readonly finished: (key: string) => void,
    private readonly looks: readonly number[],
  ) {}

  private fightSeconds(progress: number): number {
    const next=advanceEffectClock(this.age,this.entity.region.world.globalTickCounter,progress,Settings.tickMs);
    this.age=next.clock;
    return next.delta;
  }

  draw(scene: THREE.Scene, _clockDelta: number, progress: number,
    location: Location3, angle: number, pitch: number, visible: boolean,
    offsets: Location3[]): void {
    const cue = this.read();
    const changed = this.currentKey !== cue?.key;
    if (this.playing && (!cue || changed || (cue.loops && this.ended))) {
      this.generation++;
      this.playing.destroy(scene);
      this.playing = null;
      this.currentKey = null;
      this.age = null;
    }
    if (!this.playing && cue) {
      this.ended = false;
      this.currentKey = cue.key;
      const generation=++this.generation;
      this.playing = CacheRenderInstancedModel.forRenderable(
        this.entity,
        CacheRenderReferences.spotAnim([{ id: cue.spotAnim }]),
        { onSpotAnimComplete: () => {
          // An async completion from a previous orb/loop cannot finish the
          // replacement effect after a reset or a stage transition.
          if(generation!==this.generation || this.currentKey!==cue.key) return;
          this.ended = true;
          this.finished(cue.key);
        } },
      );
    }
    if (this.playing && cue) {
      // All ground effects follow the actual encounter clock. Formation,
      // maturity and disappearance no longer drift during slow rendering.
      const elapsed = this.fightSeconds(progress);
      this.playing.draw(scene, elapsed, progress, location, angle, pitch, visible, offsets);
    }
  }
  getWorldPosition(): THREE.Vector3 {
    return this.playing?.getWorldPosition() ?? new THREE.Vector3();
  }
  async preload(): Promise<void> {
    await Promise.all(this.looks.map((id) => warmCacheEffect(this.entity, id)));
  }
  destroy(scene: THREE.Scene): void {
    this.generation++;
    this.playing?.destroy(scene);
    this.playing = null;
    this.currentKey = null;
    this.age = null;
  }
}

/**
 * Three permanent visual actors avoid recreating cache rendering pools per
 * arena tick: the two lifeforce orbs and the active explosion mark.
 */
export class OcellusSpotEffect extends Entity {
  private previous: { cue: VisualCue; tick: number } | null = null;
  private leaving: { cue: VisualCue; at: number } | null = null;
  private completedKey: string | null = null;

  constructor(
    region: Region,
    private readonly layer: EffectLayer,
    private readonly readState: () => OcellusView,
  ) {
    super(region, { x: 0, y: 0 });
  }
  private cue(): VisualCue | null {
    const state = this.readState();
    const active = effectCue(state, this.layer);
    if (active) {
      this.previous = { cue: active, tick: state.frame.tick };
      this.leaving = null;
      this.completedKey = null;
      return active;
    }
    if (this.layer === "explosion") return lingeringExplosionCue(state, this.previous);
    if (this.previous && !this.leaving) {
      this.leaving = { cue: orbLeavingCue(this.previous.cue), at: state.frame.tick };
      this.previous = null;
    }
    if (!this.leaving) return null;
    // The real sequence ends the effect. The tick limit handles an unseen
    // effect when a browser tab is suspended without render callbacks.
    if (this.completedKey === this.leaving.cue.key
      || state.frame.tick > this.leaving.at + 3) {
      this.leaving = null;
      return null;
    }
    return this.leaving.cue;
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
    return new CachedEffectModel(this, () => this.cue(), (key) => {
      this.completedKey = key;
    }, EFFECT_LOOKS[this.layer]);
  }
}
