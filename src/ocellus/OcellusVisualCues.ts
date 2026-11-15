import type { Tile, AttackStyle } from "./Phase4Rules";
import type { OcellusView } from "./OcellusRegion";

export type VisualCue = Readonly<{
  spotAnim: number;
  loops: boolean;
  key: string;
  tile: Tile;
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
  state: Pick<OcellusView, "frame" | "orbs" | "marks">,
  previous: Readonly<{ cue: VisualCue; tick: number }> | null,
): VisualCue | null {
  const active = effectCue(state, "explosion");
  if (active) return active;
  if (previous && state.frame.tick === previous.tick + 1
    && state.frame.events.some(({ kind }) => kind === "explosion-hit")) return previous.cue;
  return null;
}

/** The native orb-leaving sequence is 4312, not an instant disappearance. */
export function orbLeavingCue(previous: VisualCue): VisualCue {
  return { ...previous, spotAnim: 4312, loops: false, key: previous.key + ":leaving" };
}

export function effectCue(state: Pick<OcellusView, "frame" | "orbs" | "marks">, layer: EffectLayer): VisualCue | null {
  if (layer === "explosion") {
    const mark = state.marks[0];
    return mark
      ? {
          spotAnim: 4339,
          loops: false,
          key: `explosion-${mark.void}-${mark.pulse}-${mark.tile.x}-${mark.tile.y}`,
          tile: mark.tile,
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
  };
}
