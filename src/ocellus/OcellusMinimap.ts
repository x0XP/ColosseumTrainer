import type {Tile} from "./Phase4Rules";
export const MINIMAP_CENTER=76;
export const MINIMAP_TILE_PIXELS=4;
export function minimapPoint(tile:Tile,player:Tile):Tile {
 return {x:MINIMAP_CENTER+(tile.x-player.x)*MINIMAP_TILE_PIXELS,y:MINIMAP_CENTER+(tile.y-player.y)*MINIMAP_TILE_PIXELS};
}
/** Native surface image is in the same north-up coordinate system as the
 * trainer floor. The player stays centred and the SDK rotates the canvas. */
export function drawNativeMinimap(ctx:OffscreenCanvasRenderingContext2D,image:HTMLImageElement,
 player:Tile,npcs:readonly Tile[],width:number,height:number):void {
 ctx.save();
 ctx.imageSmoothingEnabled=false;
 ctx.drawImage(image,MINIMAP_CENTER-(player.x+.5)*MINIMAP_TILE_PIXELS,
 MINIMAP_CENTER-(player.y+.5)*MINIMAP_TILE_PIXELS,width*MINIMAP_TILE_PIXELS,height*MINIMAP_TILE_PIXELS);
 ctx.fillStyle="#ffff00";
 for(const npc of npcs){const p=minimapPoint(npc,player);ctx.fillRect(p.x-1,p.y-1,3,3);}
 ctx.fillStyle="#ffffff";ctx.fillRect(MINIMAP_CENTER-1,MINIMAP_CENTER-1,3,3);
 ctx.restore();
}
