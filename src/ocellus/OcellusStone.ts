import { FLOOR_TILES, inNearSquare, isHole } from "./Phase4Rules";
import { floodedDiagonalWalkways } from "./OcellusArenaTopology";
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

/** The SDK passes a world-space 2D canvas; no per-entity translate occurs.
 * Use tile coordinates, and share the native texture with the 3D viewport.
 */
export function drawOcellusFloorTile(ctx:OffscreenCanvasRenderingContext2D,
  at:Tile,scale:number,visual:FloorVisual,stone?:HTMLImageElement,flood?:HTMLImageElement):void {
  const x=at.x*scale,y=at.y*scale,pixels=NATIVE_FLOOR_PIXELS_PER_TILE;
  ctx.save();
  ctx.imageSmoothingEnabled=false;
  if(visual==="native" && stone?.complete && stone.naturalWidth>= (at.x+1)*pixels && stone.naturalHeight>=(at.y+1)*pixels) {
    ctx.drawImage(stone,at.x*pixels,at.y*pixels,pixels,pixels,x,y,scale,scale);
  } else if(visual==="void" && flood?.complete && flood.naturalWidth>0 && flood.naturalHeight>0) {
    ctx.drawImage(flood,x,y,scale,scale);
  } else {
    const color=visual==="native"?arenaStoneAt(at):FLOOR_OVERLAY_COLORS[visual];
    ctx.fillStyle="#"+color.toString(16).padStart(6,"0");
    ctx.fillRect(x,y,scale,scale);
  }
  ctx.restore();
}

const diagonalFloodTiles=floodedDiagonalWalkways(FLOOR_TILES.filter(t=>!inNearSquare(t)));

/** Visual-only NW half-tile floods over the original diagonal curb. */
export function drawOcellusDiagonalFlood(ctx:OffscreenCanvasRenderingContext2D,scale:number,
 stage:PhaseFrame["stage"],flood?:HTMLImageElement):void {
 if(stage!=="outer-void")return;
 for(const tile of diagonalFloodTiles){
   const x=tile.x*scale,y=tile.y*scale;
   ctx.save();
   ctx.beginPath();
   ctx.moveTo(x,y);
   ctx.lineTo(x+scale,y);
   ctx.lineTo(x,y+scale);
   ctx.closePath();
   ctx.clip();
   drawOcellusFloorTile(ctx,tile,scale,"void",undefined,flood);
   ctx.restore();
 }
}
