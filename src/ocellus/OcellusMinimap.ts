import type {Tile} from "./Phase4Rules";
export const MINIMAP_CENTER=76;
export const MINIMAP_TILE_PIXELS=4;
/** The displayed position follows client-cycle interpolation, never a
 * different camera target. Invalid render samples fall back to the tile. */
export function minimapPlayerPosition(tile:Tile,perceived?:Tile):Tile {
 return perceived&&Number.isFinite(perceived.x)&&Number.isFinite(perceived.y)?{x:perceived.x,y:perceived.y}:tile;
}
export function minimapPoint(tile:Tile,player:Tile,rotation=0):Tile {
 const x=(tile.x-player.x)*MINIMAP_TILE_PIXELS,y=(tile.y-player.y)*MINIMAP_TILE_PIXELS;
 const angle=Number.isFinite(rotation)?rotation:0;
 const cos=Math.cos(angle),sin=Math.sin(angle);
 return {x:MINIMAP_CENTER+Math.round(x*cos-y*sin),y:MINIMAP_CENTER+Math.round(x*sin+y*cos)};
}
/** SDK NPC locations are south-west anchors, not north-west corners. */
export function minimapNpcCenter(anchor:Tile,size:number):Tile {
 const offset=(size-1)/2;
 return {x:anchor.x+offset,y:anchor.y-offset};
}
/** Native surface image is in the same north-up coordinate system as the
 * trainer floor. Rotate the terrain but paint pixel-aligned dots in screen
 * space, avoiding blurred markers at diagonal camera angles. */
export function drawNativeMinimap(ctx:OffscreenCanvasRenderingContext2D,image:HTMLImageElement,
 player:Tile,npcs:readonly Tile[],width:number,height:number,rotation=0):void {
 ctx.save();
 ctx.imageSmoothingEnabled=false;
 ctx.save();
 ctx.translate(MINIMAP_CENTER,MINIMAP_CENTER);
 ctx.rotate(Number.isFinite(rotation)?rotation:0);
 ctx.translate(-MINIMAP_CENTER,-MINIMAP_CENTER);
 ctx.drawImage(image,MINIMAP_CENTER-(player.x+.5)*MINIMAP_TILE_PIXELS,
 MINIMAP_CENTER-(player.y+.5)*MINIMAP_TILE_PIXELS,width*MINIMAP_TILE_PIXELS,height*MINIMAP_TILE_PIXELS);
 ctx.restore();
 ctx.fillStyle="#ffff00";
 for(const npc of npcs){const p=minimapPoint(npc,player,rotation);ctx.fillRect(p.x-1,p.y-1,3,3);}
 ctx.fillStyle="#ffffff";ctx.fillRect(MINIMAP_CENTER-1,MINIMAP_CENTER-1,3,3);
 ctx.restore();
}
