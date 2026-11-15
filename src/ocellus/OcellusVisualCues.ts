import type { Tile, AttackStyle } from "./Phase4Rules";
import type { OcellusView } from "./OcellusRegion";

export type VisualCue = Readonly<{
  spotAnim: number;
  loops: boolean;
  key: string;
  tile: Tile;
}>;
export type EffectLayer = "inner-orb" | "outer-orb" | "explosion";

/** Exact cache 2746 spotanim IDs, cross-checked against the P4 reference. */
export function specialTellSpotId(style: AttackStyle): number {
  switch (style) {
    case "melee": return 4328;
    case "range": return 4330;
    case "magic": return 4329;
  }
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
