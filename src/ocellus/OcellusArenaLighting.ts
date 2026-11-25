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

// Conservative presentation grade in linear RGB, never a replacement for
// the original cache colours. Zero stays zero and neutral stone stays neutral.
export function stoneGrade(r:number,g:number,b:number,amount:number):readonly [number,number,number] {
  const t=Math.max(0,Math.min(1,amount)),l=.2126*r+.7152*g+.0722*b;
  const saturation=1-.22*t;
  return [l+(r-l)*saturation,l+(g-l)*saturation,l+(b-l)*saturation];
}

/** Small directional modulation of recovered native cliff faces. The
 * original Gouraud colours still determine their hue and most of their light.
 * Degenerate triangles retain their original exposure. */
export function cliffFacetExposure(positions:readonly number[],i:number):number {
  const ux=positions[i+3]-positions[i],uy=positions[i+4]-positions[i+1],uz=positions[i+5]-positions[i+2];
  const vx=positions[i+6]-positions[i],vy=positions[i+7]-positions[i+1],vz=positions[i+8]-positions[i+2];
  const x=uy*vz-uz*vy,y=uz*vx-ux*vz,z=ux*vy-uy*vx;
  const length=Math.hypot(x,y,z);
  if(!Number.isFinite(length)||length<1e-8)return 1;
  const facing=(.36*x+.8*y-.48*z)/length;
  return .96+.16*facing;
}

/** Near wall relief receives more legible cache colour; distant geometry
 * still disappears toward the abyss. Distances and heights are world tiles. */
export function backdropExposure(distance:number,height:number):number {
  const smooth=(a:number,b:number,v:number)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
  return (.91-.59*smooth(17,33,distance))*(.24+.76*smooth(-13,-3,height));
}

/** Suppress over-bright mip peaks on phone-sized flood surfaces, preserving
 * the original texture and brightest source texels at close range. */
export function starMipWeight(width:number):number {
  return width>=32?.18:width>=16?.08:0;
}
