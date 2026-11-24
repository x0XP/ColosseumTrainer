import {BOARD_WIDTH,BOARD_HEIGHT} from "./Phase4Rules";
import {WALKWAY_TILES} from "./OcellusArenaTopology";
import type {Tile} from "./Phase4Rules";

export type ArenaMeshKind="foundation"|"curb";
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
 const margin=kind==="foundation"?.18:0,epsilon=1e-5;
 const low=kind==="foundation"?-1.69:-1/128,high=kind==="foundation"?-.015:.75;
 for(let i=0;i<positions.length;i+=3){
   const [x,y,z]=[positions[i],positions[i+1],positions[i+2]];
   if(![x,y,z].every(Number.isFinite)||x< -margin-epsilon||x>BOARD_WIDTH+margin+epsilon||z< -1-margin-epsilon||z>BOARD_HEIGHT-1+margin+epsilon||y<low-epsilon||y>high+epsilon)return fail("vertex bounds");
 }
 if(kind==="curb"){
   if(data.tiles!==29)return fail("curb footprint");
   return {positions,colors,vertexColors};
 }
 const backing=data.backingTiles,keys=new Set(WALKWAY_TILES.map(t=>t.x+":"+t.y));
 if(!Array.isArray(backing)||backing.length!==24||new Set(backing.map(t=>t?.x+":"+t?.y)).size!==24||backing.some(t=>!keys.has(t?.x+":"+t?.y)))return fail("backing footprint");
 return {positions,colors,vertexColors,backingTiles:backing};
}
