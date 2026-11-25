import * as THREE from "three";
import { BOARD_HEIGHT, BOARD_WIDTH } from "./Phase4Rules";
import { shadowProjection, SHADOW_PADDING_TILES } from "./OcellusArenaLighting";

/** Project the recovered curb, roots and branches onto the floor once per
 * attempt. The floor mesh itself clips this texture to surviving stone. */
export function floorLighting(positions: readonly number[]): THREE.CanvasTexture {
  const pixels = 48;
  const canvas = document.createElement("canvas");
  canvas.width = (BOARD_WIDTH+2*SHADOW_PADDING_TILES) * pixels;
  canvas.height = (BOARD_HEIGHT+2*SHADOW_PADDING_TILES) * pixels;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // Paint a union mask first. Overlapping clipped cache triangles should
  // cast one shadow regardless of the density of the source geometry.
  const mask = document.createElement("canvas");
  mask.width = canvas.width;
  mask.height = canvas.height;
  const brush = mask.getContext("2d")!;
  brush.fillStyle = "#263020";
  const project=(i:number)=>{
    const [x,z]=shadowProjection(positions[i],positions[i+1],positions[i+2]);
    return {x:x*pixels,y:z*pixels};
  };
  brush.beginPath();
  for (let i = 0; i < positions.length; i += 9) {
    if (Math.max(positions[i+1], positions[i+4], positions[i+7]) < .12) continue;
    const a=project(i),b=project(i+3),c=project(i+6);
    const clockwise=(b.x-a.x)*(c.y-a.y)>(b.y-a.y)*(c.x-a.x);
    const second=clockwise?b:c,third=clockwise?c:b;
    brush.moveTo(a.x,a.y);
    brush.lineTo(second.x,second.y);
    brush.lineTo(third.x,third.y);
    brush.closePath();
  }
  // One nonzero fill rasterises the silhouette, including shared edges, once.
  brush.fill();
  // Keep the hard centre of the silhouette and soften its boundary over a
  // fraction of a tile. Both passes are baked once, outside the render loop.
  ctx.globalAlpha = .16;
  ctx.filter = "blur(4px)";
  ctx.drawImage(mask, 0, 0);
  ctx.filter = "none";
  ctx.globalAlpha = .14;
  ctx.drawImage(mask, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.flipY = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
