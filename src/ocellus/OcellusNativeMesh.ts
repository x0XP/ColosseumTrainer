import {BOARD_WIDTH,BOARD_HEIGHT,FLOOR_TILES,inPlatform} from "./Phase4Rules";
import {WALKWAY_TILES} from "./OcellusArenaTopology";
import type {Tile} from "./Phase4Rules";

export type ArenaMeshKind="foundation"|"curb"|"flat-floor";
export const NATIVE_FOUNDATION_TOP_Y=-0.00783;
export const NATIVE_FOUNDATION_MIN_Y=-11.75;
export const NATIVE_FOUNDATION_MAX_MARGIN=.75;
export const NATIVE_CURB_MAX_MARGIN=.48;
export const NATIVE_SCENERY_MAX_Y=7;
export const NATIVE_SCENERY_MAX_MARGIN=3;
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
 const margin=kind==="foundation"?NATIVE_FOUNDATION_MAX_MARGIN:kind==="curb"?NATIVE_CURB_MAX_MARGIN:0,epsilon=1e-5;
 if(kind==="foundation"&&data.topY!==NATIVE_FOUNDATION_TOP_Y)return fail("foundation top plane");
 const low=kind==="foundation"?NATIVE_FOUNDATION_MIN_Y:-1/128,high=kind==="foundation"?NATIVE_FOUNDATION_TOP_Y:kind==="curb"?NATIVE_SCENERY_MAX_Y:.75;
 for(let i=0;i<positions.length;i+=3){
   const [x,y,z]=[positions[i],positions[i+1],positions[i+2]];
   const localMargin=kind==="curb"&&typeof data.curbFaces==="number"&&i>=data.curbFaces*9?NATIVE_SCENERY_MAX_MARGIN:margin;
   const rearMargin=kind==="flat-floor"?0:Math.max(1,localMargin);
   if(![x,y,z].every(Number.isFinite)||x< -localMargin-epsilon||x>BOARD_WIDTH+localMargin+epsilon||z< -1-localMargin-epsilon||z>BOARD_HEIGHT-1+rearMargin+epsilon||y<low-epsilon||y>high+(kind==="foundation"?1e-8:epsilon))return fail("vertex bounds");
 }
 if(kind==="flat-floor"){
   if(data.tiles!==84||data.floorY!==-1/128)return fail("flat floor metadata");
   const coverageError=flatFloorCoverageError(positions);
   if(coverageError)return fail(coverageError);
   return {positions,colors,vertexColors};
 }
 if(kind==="curb"){
   if(data.tiles!==29)return fail("curb footprint");
   if(data.reliefTiles!==84||typeof data.raisedFloorFaces!=="number"||!Number.isInteger(data.raisedFloorFaces)||data.raisedFloorFaces<0||data.raisedFloorFaces>colors.length)return fail("raised floor proof");
   if(typeof data.overhangBoxes!=="number"||!Number.isInteger(data.overhangBoxes)||data.overhangBoxes<=0||typeof data.overhangFaces!=="number"||!Number.isInteger(data.overhangFaces)||data.overhangFaces<0||data.overhangFaces>colors.length)return fail("curb overhang proof");
   if(typeof data.floorEdgeFaces!=="number"||!Number.isInteger(data.floorEdgeFaces)||data.floorEdgeFaces<0||data.floorEdgeFaces>data.overhangFaces)return fail("native exposed floor edge proof");
   const tall=data.tall as {faces?:number;components?:number;discardedComponents?:number;maxHeight?:number}|undefined;
   if(!tall||!Number.isInteger(tall.faces)||!Number.isInteger(tall.components)||!Number.isInteger(tall.discardedComponents)||typeof tall.maxHeight!=="number"||!Number.isFinite(tall.maxHeight)||
      (tall.faces??-1)<0||(tall.components??-1)<0||(tall.discardedComponents??-1)<0||tall.maxHeight<.75||tall.maxHeight>NATIVE_SCENERY_MAX_Y||
      data.curbFaces!==colors.length-(tall.faces??-1)||!Number.isInteger(data.curbFaces)||Number(data.curbFaces)<1||
      (tall.faces===0)!==(tall.components===0))return fail("native tall scenery proof");
   const baseEnd=(data.curbFaces as number)*9;
   const tallPositions=positions.slice(baseEnd);
   if(tallPositions.some((v,i)=>i%3===1&&v<.75-epsilon)||positions.slice(0,baseEnd).some((v,i)=>i%3===1&&v>.75+epsilon)||
      Math.abs(tallPositions.reduce((m,v,i)=>i%3===1?Math.max(m,v):m,.75)-tall.maxHeight)>epsilon)return fail("native tall scenery heights");
   return {positions,colors,vertexColors};
 }
 const backing=data.backingTiles,keys=new Set(WALKWAY_TILES.map(t=>t.x+":"+t.y));
 if(!Array.isArray(backing)||backing.length!==24||new Set(backing.map(t=>t?.x+":"+t?.y)).size!==24||backing.some(t=>!keys.has(t?.x+":"+t?.y)))return fail("backing footprint");
 return {positions,colors,vertexColors,backingTiles:backing};
}

/** Local backing colours sampled from recovered rock; the backing itself
 * remains reconstructed, not a claimed original wall. */
export const ARENA_ABYSS_RGB=0x000000;
export const CLIFF_FALLBACK_RGB=0x384132;
// The safety backing must not grow into a large artificial slab.
export const CLIFF_BOTTOM_Y=-5.25;
export const NATIVE_CLIFF_FADE_END=-11.75;
/** Original faces remain visible below the old backing cutoff. */
export function nativeCliffVisibility(y:number):number{
 if(!Number.isFinite(y))return 0;
 if(y>=CLIFF_BOTTOM_Y)return .28+.72*cliffVisibility(y);
 const t=Math.max(0,Math.min(1,(y-NATIVE_CLIFF_FADE_END)/(CLIFF_BOTTOM_Y-NATIVE_CLIFF_FADE_END)));
 return .28*t*t*(3-2*t);
}
export function cliffVisibility(y:number):number {
 if(!Number.isFinite(y))return 0;
 const t=Math.max(0,Math.min(1,(y-CLIFF_BOTTOM_Y)/(NATIVE_FOUNDATION_TOP_Y-CLIFF_BOTTOM_Y)));
 // The reference shows a solid face for most of the drop. Concentrate
 // the transition to black near the foot so the native mineral patches survive.
 return 1-Math.pow(1-t,2.5);
}
export function nativeCliffSampler(positions:readonly number[],colors:readonly number[]){
 type Sample={x:number;y:number;z:number;rgb:number};
 const cells=new Map<string,Sample[]>();
 const seen=new Set<string>();
 for(let i=0;i<positions.length;i+=3){
  const x=positions[i],y=positions[i+1],z=positions[i+2],rgb=colors[i/3];
  if(![x,y,z].every(Number.isFinite)||y<CLIFF_BOTTOM_Y||y>NATIVE_FOUNDATION_TOP_Y+1e-8||
     !Number.isInteger(rgb)||rgb<0||rgb>0xffffff)continue;
  const key=[x,y,z,rgb].join(",");
  if(seen.has(key))continue;
  seen.add(key);
  const cell=Math.floor(x)+":"+Math.floor(z);
  if(!cells.has(cell))cells.set(cell,[]);
  cells.get(cell)!.push({x,y,z,rgb});
 }
 return (x:number,z:number,y=NATIVE_FOUNDATION_TOP_Y)=>{
  if(![x,y,z].every(Number.isFinite))return CLIFF_FALLBACK_RGB;
  const near:{d:number;rgb:number}[]=[];
  for(let ix=Math.floor(x-1.5);ix<=Math.floor(x+1.5);ix++)
   for(let iz=Math.floor(z-1.5);iz<=Math.floor(z+1.5);iz++)
    for(const p of cells.get(ix+":"+iz)??[]){
     const d=(x-p.x)**2+(z-p.z)**2+4*(y-p.y)**2;
     if(d<=2.25)near.push({d,rgb:p.rgb});
    }
  const nearest=near.sort((a,b)=>a.d-b.d).slice(0,4);
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

/** Each original face is clipped to one playable tile. Check every tile,
 * not just total area: missing or duplicated geometry must never make the
 * baked underlay disappear. The extracted 2746 floor has 252 up-facing
 * triangles and exactly unit area in every one of the 84 floor cells. */
export function flatFloorCoverageError(positions:readonly number[]):string|null{
 if(positions.length%9!==0)return "flat floor triangle arrays";
 const area=new Map<string,number>();
 for(let i=0;i<positions.length;i+=9){
  const [ax,ay,az,bx,by,bz,cx,cy,cz]=positions.slice(i,i+9);
  if(![ax,ay,az,bx,by,bz,cx,cy,cz].every(Number.isFinite)||[ay,by,cy].some(y=>y!==-1/128))return "flat floor height";
  const x=Math.floor((ax+bx+cx)/3),y=Math.floor((az+bz+cz)/3)+1;
  if(!inPlatform({x,y})||[ax,bx,cx].some(v=>v<x-1e-7||v>x+1+1e-7)||[az,bz,cz].some(v=>v<y-1-1e-7||v>y+1e-7))return "flat floor footprint";
  const doubleArea=(bz-az)*(cx-ax)-(bx-ax)*(cz-az);
  if(!(doubleArea>0))return "flat floor winding";
  const key=x+":"+y;
  area.set(key,(area.get(key)??0)+doubleArea/2);
 }
 if(FLOOR_TILES.some(({x,y})=>Math.abs((area.get(x+":"+y)??0)-1)>1e-6))return "flat floor tile coverage";
 return null;
}


type SectionPoint=Readonly<{x:number;z:number}>;
/** Horizontal sections of the actual native triangles, not a procedural
 * rock texture. Used only to recess the fallback behind existing geometry. */
export function nativeCliffSection(positions:readonly number[],height:number):readonly (readonly [SectionPoint,SectionPoint])[]{
 const segments:[SectionPoint,SectionPoint][]=[];
 for(let i=0;i+8<positions.length;i+=9){
  const p=[0,3,6].map(j=>({x:positions[i+j],y:positions[i+j+1],z:positions[i+j+2]}));
  if(p.some(v=>![v.x,v.y,v.z].every(Number.isFinite)))continue;
  const hits:SectionPoint[]=[];
  const add=(v:SectionPoint)=>{if(!hits.some(h=>Math.hypot(h.x-v.x,h.z-v.z)<1e-7))hits.push(v);};
  for(let j=0;j<3;j++){
   const a=p[j],b=p[(j+1)%3],da=a.y-height,db=b.y-height;
   if(Math.abs(da)<1e-8)add({x:a.x,z:a.z});
   if(da*db<0){const t=da/(da-db);add({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});}
  }
  // Entirely horizontal faces cannot establish the vertical cliff profile.
  if(hits.length===2)segments.push([hits[0],hits[1]]);
 }
 return segments;
}
/** Test the short inward ray from a joined fallback contour point against
 * native rock. Only move the fallback INWARD, and cap the extra setback
 * so shared corners cannot fold across adjacent unit boundary edges. */
export function nativeBackingPoint(edge:SectionPoint,point:SectionPoint,sections:readonly (readonly [SectionPoint,SectionPoint])[]):SectionPoint{
 const dx=point.x-edge.x,dz=point.z-edge.z,len=Math.hypot(dx,dz);
 if(!Number.isFinite(len)||len<1e-8)return point;
 const ux=dx/len,uz=dz/len;
 let nearest=Infinity;
 for(const [a,b] of sections){
  const sx=b.x-a.x,sz=b.z-a.z,den=ux*sz-uz*sx;
  if(Math.abs(den)<1e-8)continue;
  const ax=a.x-point.x,az=a.z-point.z;
  const t=(ax*sz-az*sx)/den,u=(ax*uz-az*ux)/den;
  if(t>=-1e-7&&t<=.24&&u>=-1e-7&&u<=1+1e-7)nearest=Math.min(nearest,Math.max(0,t));
 }
 if(!Number.isFinite(nearest))return point;
 const inset=Math.min(.28,nearest+.04);
 return {x:point.x+ux*inset,z:point.z+uz*inset};
}
