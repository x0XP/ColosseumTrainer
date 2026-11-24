import type { Tile, AttackStyle } from "./Phase4Rules";
import type { OcellusView } from "./OcellusRegion";

export type VisualCue = Readonly<{
  spotAnim: number;
  loops: boolean;
  key: string;
  tile: Tile;
  startedAt: number;
  durationCycles: number;
}>;
export type EffectLayer = "inner-orb" | "outer-orb" | "explosion";

/** Every native cache spotanim that can occur on each visual layer.
 * Loading the complete sequence before the fight avoids missing the
 * first 600ms frame while the SDK creates a new instanced model.
 */
export const EFFECT_LOOKS: Readonly<Record<EffectLayer, readonly number[]>> = {
  "inner-orb": [4311, 4310, 4312],
  "outer-orb": [4309, 4310, 4312],
  explosion: [4339],
};

/** The OSRS ranged/magic/melee tell has a near-black central disc.
 * The pinned SDK otherwise renders its untextured central face as bright
 * white, as shown in the 2026-11-16 Chromium visual audit. Original cache
 * face-colour 4 is replaced with 0x020203 in the reference presentation.
 * This leaves the purple attack spikes and independently textured stars.
 */
export const OCELLUS_TRANSITION_CORE_RECOLOR = Object.freeze({ 4: 0x020203 });

/** Exact cache 2746 spotanim IDs, cross-checked against the P4 reference. */
export function specialTellSpotId(style: AttackStyle): number {
  switch (style) {
    case "melee": return 4328;
    case "range": return 4330;
    case "magic": return 4329;
  }
}

/** Keep the original 4339 visual alive on its explosion impact tick,
 * even though the mechanical mark is cleared on impact. */
export function lingeringExplosionCue(
  state: Pick<OcellusView, "frame" | "orbs" | "marks" | "impactMark">,
  previous: Readonly<{ cue: VisualCue; tick: number }> | null,
): VisualCue | null {
  const active = effectCue(state, "explosion");
  if (active) return active;
  if (previous && state.frame.tick === previous.tick + 1
    && state.frame.events.some(({ kind }) => kind === "explosion-hit")) return previous.cue;
  return null;
}

/** The native orb-leaving sequence is 4312, not an instant disappearance. */
export function orbLeavingCue(previous: VisualCue, startedAt = previous.startedAt): VisualCue {
  return { ...previous, spotAnim:4312, loops:false, key:previous.key+":leaving", startedAt, durationCycles:30 };
}

/** Departure is authoritative simulation data, not a prior render callback. */
export function orbDepartureCue(state:Pick<OcellusView,"frame"|"departingOrbs">,layer:EffectLayer):VisualCue|null {
  if(layer==="explosion") return null;
  const kind=layer==="inner-orb"?"inner":"outer";
  const orb=state.departingOrbs?.find(o=>o.void===kind);
  if(!orb) return null;
  return {spotAnim:4312,loops:false,key:`orb-${kind}-${orb.createdAt}:leaving`,tile:orb.tile,
    startedAt:orb.claimAt??orb.expiresAt,durationCycles:30};
}

export function effectCue(state: Pick<OcellusView, "frame" | "orbs" | "marks" | "impactMark">, layer: EffectLayer): VisualCue | null {
  if (layer === "explosion") {
    const mark = state.marks[0] ?? (state.frame.events.some(e=>e.kind==="explosion-hit") ? state.impactMark : null);
    return mark
      ? {
          spotAnim: 4339,
          loops: false,
          key: `explosion-${state.frame.cycle}-${mark.void}-${mark.pulse}-${mark.tile.x}-${mark.tile.y}`,
          tile: mark.tile,
          startedAt: state.frame.events.some(e=>e.kind==="explosion-hit") ? state.frame.tick-1 : state.frame.tick,
          durationCycles:55,
        }
      : null;
  }
  const voidKind = layer === "inner-orb" ? "inner" : "outer";
  const orb = state.orbs.find((item) => item.void === voidKind && !item.picked);
  if (!orb) return null;
  const mature = state.frame.tick >= orb.maturesAt;
  return {
    spotAnim: mature ? 4310 : voidKind === "inner" ? 4311 : 4309,
    loops: mature,
    key: `orb-${voidKind}-${orb.createdAt}-${mature ? "ready" : "forming"}`,
    tile: orb.tile,
    startedAt:mature?orb.maturesAt:orb.createdAt,
    durationCycles:mature?32:voidKind==="inner"?364:182,
  };
}

/** A monotonic fight-clock cursor shared by all native floor effects. The
 * visual clock stops while game ticks are paused and catches up after a
 * dropped render frame, rather than running ahead on wall-clock time. */
export type EffectClock = Readonly<{ tick:number; percent:number; fed:number }>;
export function advanceEffectClock(previous: EffectClock|null,tick:number,percent:number,tickMs:number): {clock:EffectClock;delta:number} {
  const phase=Math.max(0,Math.min(1,Number.isFinite(percent)?percent:0));
  if(!previous || tick<previous.tick) return {clock:{tick,percent:phase,fed:0},delta:0};
  const target=(tick-previous.tick+phase-previous.percent)*Math.max(0,tickMs)/1000;
  const delta=Math.max(0,target-previous.fed);
  return {clock:{...previous,fed:previous.fed+delta},delta};
}

/** Native sequence age is anchored to its event tick, never the first
 * render that happens to observe it. Mature 4310 loops use its native
 * 32-client-cycle period, avoiding frame-by-frame restart drift. */
export function effectPlaybackAt(cue:VisualCue,tick:number,percent:number,tickMs:number,previousTotal=0){
  const phase=Math.max(0,Math.min(1,Number.isFinite(percent)?percent:0));
  const prior=Number.isFinite(previousTotal)?Math.max(0,previousTotal):0;
  const rate=Number.isFinite(tickMs)?Math.max(0,tickMs):0;
  const age=Number.isFinite(tick)&&Number.isFinite(cue.startedAt)?(tick-cue.startedAt+phase)*rate/1000:0;
  const total=Math.max(prior,0,age);
  const duration=cue.durationCycles/50;
  if(!Number.isFinite(duration)||duration<=0)
    return {total,cycle:0,elapsed:0,finished:true};
  const cycle=cue.loops?Math.floor((total+1e-9)/duration):0;
  // Avoid floating-point residue at exact loop boundaries and never feed
  // a one-shot the time from after its final native frame.
  const elapsed=Math.min(duration,Math.max(0,total-cycle*duration));
  return {total,cycle,elapsed,finished:!cue.loops&&total+1e-9>=duration};
}

/** Native animation ages use the encounter's logical game clock. Changing
 * trainer playback speed must not truncate a cache sequence at a phase boundary. */
export const NATIVE_GAME_TICK_MS=600;
export function nativeEffectPlaybackAt(cue:VisualCue,tick:number,percent:number,previousTotal=0){
  return effectPlaybackAt(cue,tick,percent,NATIVE_GAME_TICK_MS,previousTotal);
}
