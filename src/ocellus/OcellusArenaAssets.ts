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
