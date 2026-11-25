/** Shared projection constants for the baked scenery shadow and its receiver.
 * A padded texture preserves silhouettes on the exterior curb rather than
 * stretching the last playable-board texel across the cliff edge. */
export const SHADOW_PADDING_TILES = 2;
export const SHADOW_RAY_X = .46;
export const SHADOW_RAY_Z = .32;

export function shadowProjection(x:number,y:number,z:number):readonly [number,number] {
  return [x-y*SHADOW_RAY_X+SHADOW_PADDING_TILES,z+1-y*SHADOW_RAY_Z+SHADOW_PADDING_TILES];
}

/** Native rise starts at offset 0 (two ticks); landing starts at 21
 * (one tick). The ground shadow follows the same visual lifetime. */
export function bossShadowLift(stage:string,offset:number,progress:number):number {
  if(stage!=="inner-void")return 0;
  const phase=offset+Math.max(0,Math.min(1,progress));
  return Math.max(0,Math.min(1,phase/2,22-phase));
}

/** A continuous flicker clock must not restart with the combat cycle. */
export function flameGlowScale(tick:number,progress:number):number {
  const phase=tick+Math.max(0,Math.min(1,progress));
  return .83+.07*Math.sin(phase*4)+.04*Math.sin(phase*9);
}

/** The reflection peaks on impact, then fades within that tick. */
export function markGlowOpacity(impact:boolean,progress:number):number {
  return impact?.48*(1-Math.max(0,Math.min(1,progress))):.35;
}
