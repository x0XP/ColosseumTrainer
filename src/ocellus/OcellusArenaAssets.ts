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
  return validateNativeArenaMesh(value,url.endsWith("ocellus-native-curb.json")?"curb":"foundation");
});

export function loadArenaJson(filename: "ocellus-native-foundation.json" | "ocellus-native-curb.json") {
  return fetchJson(new URL("osrs-assets/" + filename, document.baseURI).href);
}


/** Reuse decoded image data, not mutable THREE.Texture instances. */
export type ArenaImageName = "ocellus-native-floor-sampling.png" | "ocellus-native-floor.png" | "ocellus-flood.png" | "ocellus-native-minimap.png";
/** Reject mismatched generated assets before storing them in the shared cache. */
export const ARENA_IMAGE_DIMENSIONS:Readonly<Record<ArenaImageName,readonly [number,number]>> = {
  "ocellus-native-floor.png":[896,832],
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
