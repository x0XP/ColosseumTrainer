import { inNearSquare, isHole } from "./Phase4Rules";
import type { Tile, PhaseFrame } from "./Phase4Rules";

/**
 * Fallback palette for the brief period before the original floor artwork
 * loads in 2D. The 3D floor uses the cache-derived artwork instead.
 */
export const LIGHT_STONE = 0x4d5849;
export const DARK_STONE = 0x3e483d;

export function arenaStoneAt(tile: Tile): number {
  return (tile.x + tile.y) % 2 ? DARK_STONE : LIGHT_STONE;
}

export function arenaStoneCss(tile: Tile): string {
  return "#" + arenaStoneAt(tile).toString(16).padStart(6, "0");
}

export type FloorVisual = "native" | "mark" | "orb" | "void" | "hole";

/** 2D overlays have the same order as the 3D encounter: marks and orbs
 * remain visible above the flood, which hides permanent holes when active. */
export function floorVisualAt(at: Tile, frame: Pick<PhaseFrame,"stage">,
  marks: readonly Readonly<{tile:Tile}>[], orbs: readonly Readonly<{tile:Tile;picked:boolean}>[]): FloorVisual {
  const onTile = ({tile}:Readonly<{tile:Tile}>) => tile.x===at.x && tile.y===at.y;
  if(marks.some(onTile)) return "mark";
  if(orbs.some(o=>!o.picked && onTile(o))) return "orb";
  if((frame.stage==="inner-void" && inNearSquare(at)) || (frame.stage==="outer-void" && !inNearSquare(at))) return "void";
  if(isHole(at)) return "hole";
  return "native";
}
export const FLOOR_OVERLAY_COLORS: Readonly<Record<Exclude<FloorVisual,"native">,number>> = Object.freeze({mark:0x64347b,orb:0x2e9b9c,void:0x1e2529,hole:0x150c25});
export const NATIVE_FLOOR_PIXELS_PER_TILE = 64;
