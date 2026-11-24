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
  return response.json();
});

export function loadArenaJson(filename: "ocellus-native-foundation.json" | "ocellus-native-curb.json") {
  return fetchJson(new URL("osrs-assets/" + filename, document.baseURI).href);
}


/** Reuse decoded image data, not mutable THREE.Texture instances. */
export type ArenaImageName = "ocellus-native-floor.png" | "ocellus-flood.png";
const decodedImages = createArenaAssetCache(async (url:string) => {
  const image = new Image();
  image.src = url;
  await image.decode();
  if (!image.naturalWidth || !image.naturalHeight)
    throw new Error("Empty decoded arena image: "+url);
  return image;
});

export function loadArenaImage(filename:ArenaImageName):Promise<HTMLImageElement> {
  return decodedImages(new URL("osrs-assets/textures/"+filename,document.baseURI).href);
}
