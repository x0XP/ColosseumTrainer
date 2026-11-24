/**
 * New OSRS caches store terrain and locations together in an unnamed map
 * archive keyed by the region ID. File 0 is terrain and file 1 is locations.
 * See RuneLite cache RegionLoader.loadMapDef/loadLocDef:
 * https://github.com/runelite/runelite/blob/master/cache/src/main/java/net/runelite/cache/region/RegionLoader.java
 *
 * Read through the pinned reader's disk/decompression layer, bypassing its
 * legacy named-map dispatch. Reuse its existing binary map/loc decoders.
 */
export async function readNativeRegion(cache, index, square, MapLoader) {
  const rx = square >>> 8, ry = square & 255;
  if (index.named) {
    const map = await cache.getMap(rx, ry);
    const loc = await cache.getLoc(rx, ry);
    return { format: "legacy-named", files: [], map, loc };
  }
  const group = index.archives[square];
  if (!group) throw new Error("Direct region group " + square + " absent");
  const segment = index.indexSegments[square];
  if (!segment || segment.size <= 0) throw new Error("Missing disk segment for region " + square);
  const data = await cache.cacheRequester.readData(index, segment.size, segment.segment, square);
  if (!data?.decompressedData?.length) throw new Error("Empty region group " + square);
  group.loadFiles(data.decompressedData);
  const bytes = id => {
    const content = group.files.find(f => f?.id === id)?.content;
    if (!content?.length) throw new Error("Region " + square + " missing file " + id);
    // The pinned loader constructs DataView from .buffer, so use a new,
    // zero-offset Uint8Array rather than a slice of the group buffer.
    return Uint8Array.from(content);
  };
  const terrain = bytes(0), locations = bytes(1);
  const loader = new MapLoader();
  const map = loader.loadMapDef(terrain, square, rx, ry);
  const loc = loader.loadLocationDef(locations, square, rx, ry);
  if (map?.tiles?.length !== 4 || !map.tiles.every(p => p.length === 64 && p.every(row => row.length === 64))) throw new Error("Invalid terrain dimensions");
  if (!Array.isArray(loc?.locations)) throw new Error("Invalid location data");
  return { format: "direct-region-files", files: [{id:0, bytes:terrain.length}, {id:1, bytes:locations.length}], map, loc };
}
