import {BOARD_WIDTH,BOARD_HEIGHT,inPlatform} from "./Phase4Rules";
import {WALKWAY_TILES} from "./OcellusArenaTopology";
import type {Tile} from "./Phase4Rules";

export type ArenaMeshKind="foundation"|"curb"|"flat-floor";
export const NATIVE_FOUNDATION_TOP_Y=-0.00783;
export const NATIVE_FOUNDATION_MIN_Y=-3.19;
export const NATIVE_FOUNDATION_MAX_MARGIN=.75;
export type NativeArenaMesh=Readonly<{
  positions:number[];colors:number[];vertexColors:number[];
  backingTiles?:readonly Tile[];
}>;

/** Validate native geometry before it enters the shared CPU-side cache.
 * Wrong cache, model order, corrupted coordinates and invalid lit colors
 * must fail early rather than becoming invisible geometry or GPU NaNs. */
export function validateNativeArenaMesh(value:unknown,kind:ArenaMeshKind):NativeArenaMesh{
 const fail=(reason:string):never=>{throw new Error("Invalid native "+kind+": "+reason);};
 if(!value||typeof value!=="object")return fail("missing payload");
 const data=value as Record<string,unknown>;
 if(data.cache!==2746||data.square!==16472||data.plane!==1||data.lighting!=="cache-object")return fail("cache metadata");
 const sources=data.sources;
 if(!Array.isArray(sources)||sources.map(s=>s?.model).join(",")!=="62274,62275,62277")return fail("source models");
 const {positions,colors,vertexColors}=data;
 if(!Array.isArray(positions)||!Array.isArray(colors)||!Array.isArray(vertexColors)||colors.length===0||positions.length!==colors.length*9||vertexColors.length!==colors.length*3)return fail("triangle arrays");
 const isRgb=(v:unknown)=>typeof v==="number"&&Number.isInteger(v)&&v>=0&&v<=0xffffff;
 if(!colors.every(isRgb)||!vertexColors.every(isRgb))return fail("face colors");
 const margin=kind==="foundation"?NATIVE_FOUNDATION_MAX_MARGIN:kind==="curb"?.18:0,epsilon=1e-5;
 if(kind==="foundation"&&data.topY!==NATIVE_FOUNDATION_TOP_Y)return fail("foundation top plane");
 const low=kind==="foundation"?NATIVE_FOUNDATION_MIN_Y:-1/128,high=kind==="foundation"?NATIVE_FOUNDATION_TOP_Y:.75;
 for(let i=0;i<positions.length;i+=3){
   const [x,y,z]=[positions[i],positions[i+1],positions[i+2]];
   if(![x,y,z].every(Number.isFinite)||x< -margin-epsilon||x>BOARD_WIDTH+margin+epsilon||z< -1-margin-epsilon||z>BOARD_HEIGHT-1+margin+epsilon||y<low-epsilon||y>high+(kind==="foundation"?1e-8:epsilon))return fail("vertex bounds");
 }
 if(kind==="flat-floor"){
   if(data.tiles!==84||data.floorY!==-1/128)return fail("flat floor metadata");
   for(let i=0;i<positions.length;i+=9){
     if([positions[i+1],positions[i+4],positions[i+7]].some(y=>y!==-1/128))return fail("flat floor height");
     const x=Math.floor((positions[i]+positions[i+3]+positions[i+6])/3);
     const y=Math.floor((positions[i+2]+positions[i+5]+positions[i+8])/3)+1;
     if(!inPlatform({x,y}))return fail("flat floor footprint");
   }
   return {positions,colors,vertexColors};
 }
 if(kind==="curb"){
   if(data.tiles!==29)return fail("curb footprint");
   if(data.reliefTiles!==84||typeof data.raisedFloorFaces!=="number"||!Number.isInteger(data.raisedFloorFaces)||data.raisedFloorFaces<0||data.raisedFloorFaces>colors.length)return fail("raised floor proof");
   if(typeof data.overhangBoxes!=="number"||!Number.isInteger(data.overhangBoxes)||data.overhangBoxes<=0||typeof data.overhangFaces!=="number"||!Number.isInteger(data.overhangFaces)||data.overhangFaces<0||data.overhangFaces>colors.length)return fail("curb overhang proof");
   return {positions,colors,vertexColors};
 }
 const backing=data.backingTiles,keys=new Set(WALKWAY_TILES.map(t=>t.x+":"+t.y));
 if(!Array.isArray(backing)||backing.length!==24||new Set(backing.map(t=>t?.x+":"+t?.y)).size!==24||backing.some(t=>!keys.has(t?.x+":"+t?.y)))return fail("backing footprint");
 return {positions,colors,vertexColors,backingTiles:backing};
}

/** Local backing colours sampled from recovered rock; the backing itself
 * remains reconstructed, not a claimed original wall. */
export const ARENA_ABYSS_RGB=0x05070b;
export const CLIFF_FALLBACK_RGB=0x384132;
export const CLIFF_BOTTOM_Y=-3.2;
export function cliffVisibility(y:number):number {
 if(!Number.isFinite(y))return 0;
 const t=Math.max(0,Math.min(1,(y-CLIFF_BOTTOM_Y)/(NATIVE_FOUNDATION_TOP_Y-CLIFF_BOTTOM_Y)));
 return t*t*(3-2*t);
}
export function nativeCliffSampler(positions:readonly number[],colors:readonly number[]):(x:number,z:number)=>number {
 const unique=new Map<string,{x:number;y:number;z:number;rgb:number}>();
 for(let i=0;i<positions.length;i+=3){
  const [x,y,z]=[positions[i],positions[i+1],positions[i+2]],rgb=colors[i/3];
  if(![x,y,z].every(Number.isFinite)||y<-.6||y>NATIVE_FOUNDATION_TOP_Y+1e-8||!Number.isInteger(rgb)||rgb<0||rgb>0xffffff)continue;
  unique.set([x,y,z,rgb].join(","),{x,y,z,rgb});
 }
 const samples=[...unique.values()];
 return (x,z)=>{
  if(!Number.isFinite(x)||!Number.isFinite(z))return CLIFF_FALLBACK_RGB;
  const nearest=samples.map(s=>({rgb:s.rgb,d:(x-s.x)**2+(z-s.z)**2+4*(s.y-NATIVE_FOUNDATION_TOP_Y)**2}))
   .filter(s=>s.d<=2.25).sort((a,b)=>a.d-b.d).slice(0,4);
  if(!nearest.length)return CLIFF_FALLBACK_RGB;
  let total=0,r=0,g=0,b=0;
  for(const s of nearest){const w=1/Math.max(.0025,s.d);total+=w;r+=w*((s.rgb>>>16)&255);g+=w*((s.rgb>>>8)&255);b+=w*(s.rgb&255);}
  return (Math.round(r/total)<<16)|(Math.round(g/total)<<8)|Math.round(b/total);
 };
}

/** Match the reconstructed backing to the same depth curve used on native
 * rock. Intermediate levels approximate the continuous fade in linear RGB. */
export function cliffDepthProfile(){
 return Array.from({length:9},(_,i)=>{
  const y=i===8?CLIFF_BOTTOM_Y:NATIVE_FOUNDATION_TOP_Y+(CLIFF_BOTTOM_Y-NATIVE_FOUNDATION_TOP_Y)*i/8;
  return {y,visibility:cliffVisibility(y)};
 });
}

/** The fallback wall is only an occlusion safety net. Recess it farther
 * into the rock at lower elevations and fade it faster than native faces.
 * Do not let a uniform rectangular slab define the actual cliff profile. */
export function cliffBackingDepthProfile(topInset:number){
 return cliffDepthProfile().map(level=>{
  const depth=(NATIVE_FOUNDATION_TOP_Y-level.y)/(NATIVE_FOUNDATION_TOP_Y-CLIFF_BOTTOM_Y);
  return {y:level.y,inset:topInset+Math.max(0,.45-topInset)*depth*depth,visibility:level.visibility*level.visibility};
 });
}
