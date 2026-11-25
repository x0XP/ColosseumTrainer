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

// Visual-only reflected light falls off from the true flood outline, not
// the square bounds or the nearest unsafe tile centre.
type LightPoint=Readonly<{x:number;z:number}>;
type LightEdge=Readonly<{from:LightPoint;to:LightPoint}>;
export function distanceToLightEdge(x:number,z:number,edge:LightEdge):number {
 const dx=edge.to.x-edge.from.x,dz=edge.to.z-edge.from.z,den=dx*dx+dz*dz;
 const t=den>0?Math.max(0,Math.min(1,((x-edge.from.x)*dx+(z-edge.from.z)*dz)/den)):0;
 return Math.hypot(x-edge.from.x-t*dx,z-edge.from.z-t*dz);
}
export function rimReflection(x:number,z:number,edges:readonly LightEdge[]):number {
 let distance=Infinity;
 for(const edge of edges)distance=Math.min(distance,distanceToLightEdge(x,z,edge));
 const t=Math.max(0,1-distance/.58);
 return t*t*(3-2*t);
}
/** The two channels correspond to inner/outer geometry. Sample at pixel
 * centres; the alpha channel is opaque and the unused blue channel is zero. */
export function rimReflectionPixels(width:number,height:number,padding:number,pixelsPerTile:number,
 inner:readonly LightEdge[],outer:readonly LightEdge[]){
 const w=(width+2*padding)*pixelsPerTile,h=(height+2*padding)*pixelsPerTile;
 const pixels=new Uint8Array(w*h*4);
 for(let py=0;py<h;py++)for(let px=0;px<w;px++){
  const x=(px+.5)/pixelsPerTile-padding,z=(py+.5)/pixelsPerTile-padding-1,i=(py*w+px)*4;
  pixels[i]=Math.round(255*rimReflection(x,z,inner));
  pixels[i+1]=Math.round(255*rimReflection(x,z,outer));pixels[i+3]=255;
 }
 return {width:w,height:h,pixels};
}
export function environmentLightAt(stage:string,tick:number,progress:number){
 const phase=tick+Math.max(0,Math.min(1,Number.isFinite(progress)?progress:0));
 const voidPulse=.91+.055*Math.sin(phase*1.4)+.035*Math.sin(phase*3.1);
 return {inner:stage==="inner-void"?voidPulse:0,outer:stage==="outer-void"?voidPulse:0,
  flame:1+.12*Math.sin(phase*4)+.07*Math.sin(phase*9)};
}

/** Contact occlusion only uses the low portions of native scenery. Clip
 * triangles before projecting, so a tall branch cannot cast a contact blob
 * underneath its entire canopy. The directional shadow stays separate. */
export function contactPolygon(positions:readonly number[],i:number):readonly (readonly [number,number])[] {
 let poly:number[][]=[0,3,6].map(j=>positions.slice(i+j,i+j+3));
 if(poly.some(p=>p.length!==3||!p.every(Number.isFinite)))return [];
 for(const [limit,sign] of [[.08,1],[.52,-1]]){
  const out:number[][]=[];
  for(let j=0;j<poly.length;j++){
   const a=poly[j],b=poly[(j+1)%poly.length],da=(a[1]-limit)*sign,db=(b[1]-limit)*sign;
   if(da>=0)out.push(a);
   if((da>=0)!==(db>=0)){
    const t=da/(da-db);
    out.push(a.map((v,k)=>v+(b[k]-v)*t));
   }
  }
  poly=out;
 }
 const projected=poly.map(p=>[p[0]+SHADOW_PADDING_TILES,p[2]+1+SHADOW_PADDING_TILES] as const);
 const area=projected.reduce((sum,p,j)=>{const q=projected[(j+1)%projected.length];return sum+p[0]*q[1]-p[1]*q[0];},0);
 if(Math.abs(area)<1e-8)return [];
 return area>0?projected:projected.reverse();
}

/** Reflection envelopes follow native spotanimation age, not render time.
 * No pre-spawn marker or glow after the native departure sequence ends. */
export function fragmentLight(spotAnim:number,elapsedSeconds:number,durationCycles:number):readonly [number,number] {
 if(!Number.isFinite(elapsedSeconds)||elapsedSeconds<0||durationCycles<=0)return [0,1];
 const duration=durationCycles/50,t=Math.max(0,Math.min(1,elapsedSeconds/duration));
 if(spotAnim===4310)return [.68+.12*Math.sin(elapsedSeconds*2*Math.PI/duration),.82];
 if(spotAnim===4312)return [.68*(1-t),.82-.22*t];
 if(spotAnim===4311||spotAnim===4309)return [.18+.5*t,.58+.24*t];
 return [0,1];
}

/** The world-to-texture coordinate of the SDK player anchor. The shadow
 * follows the interpolated model, not the click destination. */
export function playerContactPosition(player:Readonly<{x:number;y:number}>|undefined,hp:number):readonly [number,number,number]{
 if(!player||!Number.isFinite(player.x)||!Number.isFinite(player.y)||!(hp>0))return [0,0,0];
 return [player.x+.5,player.y-.5,1];
}

/** Parentheses are essential for the SDK's negative ground height: emitting
 * position.y--0.490000 makes GLSL lex a decrement operator and the native
 * cliff program fails to link. Keep the original geometry visible. */
export function nativeRockHeightAssignment(groundY:number):string {
 if(!Number.isFinite(groundY))throw Error("Invalid native rock ground height");
 return `nativeRockY=position.y-(${groundY.toFixed(6)});`;
}
