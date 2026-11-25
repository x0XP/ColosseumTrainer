import {validateNativeArenaMesh} from "./OcellusNativeMesh";
/** Immutable CPU-side asset data can be reused between attempts. GPU meshes
 * remain owned and disposed by their respective arena instances. */
export function createArenaAssetCache<T>(load: (url: string) => Promise<T>): (url: string) => Promise<T> {
  const pending = new Map<string, Promise<T>>();
  return (url: string) => {
    const existing = pending.get(url);
    if (existing) return existing;
    const request = Promise.resolve().then(() => load(url)).catch(error => {
      pending.delete(url);
      throw error;
    });
    pending.set(url, request);
    return request;
  };
}

const fetchJson = createArenaAssetCache(async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Native arena asset request failed: " + response.status + " " + url);
  const value=await response.json();
  return validateNativeArenaMesh(value,url.endsWith("ocellus-native-flat-floor.json")?"flat-floor":url.endsWith("ocellus-native-curb.json")?"curb":"foundation");
});

export function loadArenaJson(filename: "ocellus-native-foundation.json" | "ocellus-native-curb.json" | "ocellus-native-flat-floor.json") {
  return fetchJson(new URL("osrs-assets/" + filename, document.baseURI).href);
}


/** Reuse decoded image data, not mutable THREE.Texture instances. */
export type ArenaImageName = "ocellus-native-relief.png" | "ocellus-native-upper.png" | "ocellus-native-floor-sampling.png" | "ocellus-native-floor.png" | "ocellus-flood.png" | "ocellus-native-minimap.png";
/** Reject mismatched generated assets before storing them in the shared cache. */
export const ARENA_IMAGE_DIMENSIONS:Readonly<Record<ArenaImageName,readonly [number,number]>> = {
  "ocellus-native-floor.png":[896,832],
  "ocellus-native-upper.png":[896,832],
  "ocellus-native-relief.png":[896,832],
  "ocellus-native-floor-sampling.png":[896,832],
  "ocellus-flood.png":[128,128],
  "ocellus-native-minimap.png":[224,208],
};
export function validateArenaImage(filename:ArenaImageName,width:number,height:number):void {
  const [w,h]=ARENA_IMAGE_DIMENSIONS[filename];
  if(width!==w||height!==h)throw new Error("Wrong arena image dimensions: "+filename+" "+width+"x"+height+"; expected "+w+"x"+h);
}
const decodedImages = createArenaAssetCache(async (url:string) => {
  const image = new Image();
  image.src = url;
  await image.decode();
  const filename=new URL(url).pathname.split("/").pop() as ArenaImageName;
  validateArenaImage(filename,image.naturalWidth,image.naturalHeight);
  return image;
});

export function loadArenaImage(filename:ArenaImageName):Promise<HTMLImageElement> {
  return decodedImages(new URL("osrs-assets/textures/"+filename,document.baseURI).href);
}

/** Render-time image reader: one pending decode, then retry after a
 * bounded cooldown. No promise rejection or request storm in a draw. */
export function createArtworkReader<T>(load:()=>Promise<T>,now=()=>performance.now(),cooldown=1000):()=>T|undefined {
 let image:T|undefined,pending=false,retryAfter=0;
 return ()=>{
  if(image!==undefined)return image;
  if(!pending&&now()>=retryAfter){
   pending=true;
   void Promise.resolve().then(load).then(value=>{image=value;pending=false;},
    ()=>{retryAfter=now()+cooldown;pending=false;});
  }
  return undefined;
 };
}

export const loadBackdrop=createArenaAssetCache(async (url:string)=>{
  const response=await fetch(url);
  if(!response.ok)throw Error("Native backdrop request failed: "+response.status);
  const data=await response.json();
  if(data.cache!==2746||data.square!==16472||data.plane!==1||data.models?.join(",")!=="62230,62231,62232,62237,62239,62238,62229"||
    !Array.isArray(data.positions)||!data.positions.length||data.positions.length%9!==0||
    !data.positions.every(Number.isFinite)||!Array.isArray(data.vertexColors)||data.vertexColors.length!==data.positions.length/3||
    !data.vertexColors.every((c:number)=>Number.isInteger(c)&&c>=0&&c<=0xffffff))throw Error("Invalid native arena backdrop");
  return data as {positions:number[];vertexColors:number[]};
});
