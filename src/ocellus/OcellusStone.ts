import { FLOOR_TILES, inNearSquare, isHole } from "./Phase4Rules";
import { floodedDiagonalWalkways, joinedVoidRim } from "./OcellusArenaTopology";
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

/** Shared reconstructed border parameters: geometry and colour are the
 * same in both views. Neither is a claim of measured client blending. */
export const VOID_RIM_COLOR="#9f48bd";
export const VOID_RIM_DEPTH=.18;
const rimByStage={
 "inner-void":joinedVoidRim(FLOOR_TILES.filter(inNearSquare),VOID_RIM_DEPTH),
 "outer-void":joinedVoidRim(FLOOR_TILES.filter(t=>!inNearSquare(t)),VOID_RIM_DEPTH),
};
export function drawOcellusVoidRim(ctx:OffscreenCanvasRenderingContext2D,scale:number,stage:PhaseFrame["stage"]):void {
 if(stage!=="inner-void"&&stage!=="outer-void"||!Number.isFinite(scale)||scale<=0)return;
 ctx.save();
 for(const e of rimByStage[stage]){
   // Convert SDK z coordinates back to the world-space 2D canvas y.
   const a=e.from,b=e.to,c=e.innerTo,d=e.innerFrom;
   const x=(a.x+b.x)*scale/2,y=((a.z+b.z)/2+1)*scale;
   const gradient=ctx.createLinearGradient(x,y,x+e.inward.x*VOID_RIM_DEPTH*scale,y+e.inward.z*VOID_RIM_DEPTH*scale);
   gradient.addColorStop(0,VOID_RIM_COLOR);
   gradient.addColorStop(1,VOID_RIM_COLOR+"00");
   ctx.fillStyle=gradient;
   ctx.beginPath();
   ctx.moveTo(a.x*scale,(a.z+1)*scale);
   ctx.lineTo(b.x*scale,(b.z+1)*scale);
   ctx.lineTo(c.x*scale,(c.z+1)*scale);
   ctx.lineTo(d.x*scale,(d.z+1)*scale);
   ctx.closePath();ctx.fill();
 }
 ctx.restore();
}

export type FloorLayers=Readonly<{ground:"native"|"void";hole:boolean;mark:boolean;orb:boolean}>;
/** Ground and transient effects are independent. The old single-value
 * selector replaced all star/stone pixels when a mark occupied a tile. */
export function floorLayersAt(at:Tile,frame:Pick<PhaseFrame,"stage">,
 marks:readonly Readonly<{tile:Tile}>[],orbs:readonly Readonly<{tile:Tile;picked:boolean}>[]):FloorLayers {
 const matches=({tile}:Readonly<{tile:Tile}>)=>tile.x===at.x&&tile.y===at.y;
 const flooded=(frame.stage==="inner-void"&&inNearSquare(at))||(frame.stage==="outer-void"&&!inNearSquare(at));
 return {ground:flooded?"void":"native",hole:!flooded&&isHole(at),mark:marks.some(matches),orb:orbs.some(o=>!o.picked&&matches(o))};
}
/** Only the legacy top-down fallback uses symbolic markers. Keep original
 * ground pixels beneath them; the 3D view continues to use cache models. */
export function drawOcellusFloorLayers(ctx:OffscreenCanvasRenderingContext2D,at:Tile,scale:number,
 layers:FloorLayers,stone?:HTMLImageElement,flood?:HTMLImageElement):void {
 drawOcellusFloorTile(ctx,at,scale,layers.ground,stone,flood);
 drawOcellusFloorMarkers(ctx,at,scale,layers);
}
/** Draw transient symbols after the shared continuous border. */
export function drawOcellusFloorMarkers(ctx:OffscreenCanvasRenderingContext2D,at:Tile,scale:number,layers:FloorLayers):void {
 if(!layers.hole&&!layers.mark&&!layers.orb)return;
 const x=(at.x+.5)*scale,y=(at.y+.5)*scale;
 ctx.save();
 const circle=(radius:number,fill:string,stroke?:string)=>{
   ctx.beginPath();ctx.arc(x,y,radius*scale,0,Math.PI*2);
   ctx.fillStyle=fill;ctx.fill();
   if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=Math.max(1,scale*.055);ctx.stroke();}
 };
 if(layers.hole)circle(.38,"#090510","#64347b");
 if(layers.mark)circle(.43,"#64347b55","#a65dca");
 if(layers.orb)circle(.22,"#2e9b9c","#81e6db");
 ctx.restore();
}
