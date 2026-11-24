import * as THREE from "three";
import {
  CacheRenderInstancedModel, CacheRenderReferences,
  CollisionType, Entity, LineOfSightMask, Settings,
} from "osrs-sdk";
import type { Location3, Model, Region } from "osrs-sdk";
import type { OcellusView } from "./OcellusRegion";
import { effectCue, orbDepartureCue, EFFECT_LOOKS, effectPlaybackAt } from "./OcellusVisualCues";
import type { EffectLayer, VisualCue } from "./OcellusVisualCues";

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
  private instanceKey: string | null = null;
  private cueKey: string | null = null;
  private total = 0;
  private fed = 0;
  private destroyed = false;

  constructor(
    private readonly entity: Entity,
    private readonly read: () => VisualCue | null,
    private readonly readTick: () => number,
    private readonly looks: readonly number[],
  ) {}

  draw(scene: THREE.Scene, _clockDelta: number, progress: number,
    location: Location3, angle: number, pitch: number, visible: boolean,
    offsets: Location3[]): void {
    if(this.destroyed) return;
    const cue=this.read();
    if(!cue || this.cueKey!==cue.key) {
      this.cueKey=cue?.key??null;
      this.total=0;
    }
    const playback=cue?effectPlaybackAt(cue,this.readTick(),progress,Settings.tickMs,this.total):null;
    const key=cue&&playback&&!playback.finished?`${cue.key}:${playback.cycle}`:null;
    if(this.playing && this.instanceKey!==key){
      this.playing.destroy(scene);
      this.playing=null;
      this.instanceKey=null;
    }
    if(!cue||!playback||playback.finished)return;
    this.total=playback.total;
    if(!visible){
      this.playing?.draw(scene,0,progress,location,angle,pitch,false,offsets);
      return;
    }
    if(!this.playing){
      this.instanceKey=key;
      this.fed=0;
      this.playing=CacheRenderInstancedModel.forRenderable(this.entity,
        CacheRenderReferences.spotAnim([{id:cue.spotAnim}]));
      // The pinned SDK ignores the first delta when starting a one-shot.
      // Initialise once at zero, then feed the actual elapsed sequence time.
      this.playing.draw(scene,0,progress,location,angle,pitch,visible,offsets);
      if(playback.elapsed<=0)return;
    }
    const delta=Math.max(0,playback.elapsed-this.fed);
    this.fed+=delta;
    this.playing.draw(scene,delta,progress,location,angle,pitch,visible,offsets);
  }
  getWorldPosition(): THREE.Vector3 {
    return this.playing?.getWorldPosition() ?? new THREE.Vector3();
  }
  async preload(): Promise<void> {
    await Promise.all(this.looks.map((id) => warmCacheEffect(this.entity, id)));
  }
  destroy(scene: THREE.Scene): void {
    this.destroyed=true;
    this.playing?.destroy(scene);
    this.playing=null;
    this.instanceKey=null;
    this.cueKey=null;
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
    const state=this.readState();
    return effectCue(state,this.layer)??orbDepartureCue(state,this.layer);
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
    return new CachedEffectModel(this,()=>this.cue(),()=>this.readState().frame.tick,EFFECT_LOOKS[this.layer]);
  }
}
