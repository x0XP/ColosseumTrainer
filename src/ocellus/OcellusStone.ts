import type { Tile } from "./Phase4Rules";

/**
 * The surviving P4 quadrant is a desaturated green-grey checkerboard.
 * These are calibrated approximations of the visible floor in real encounter
 * footage (not a claim that we extracted missing region 16472 terrain data).
 */
export const LIGHT_STONE = 0x4d5849;
export const DARK_STONE = 0x3e483d;

export function arenaStoneAt(tile: Tile): number {
  return (tile.x + tile.y) % 2 ? DARK_STONE : LIGHT_STONE;
}

export function arenaStoneCss(tile: Tile): string {
  return "#" + arenaStoneAt(tile).toString(16).padStart(6, "0");
}
