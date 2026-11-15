import type { CacheAssets } from "osrs-sdk/asset-manifest";

/**
 * Ocellus cache assets, separate from Colosseum.
 * IDs were cross-checked against ArchiveOcellusTrainer's documented
 * RuneLite/OpenRS2 2746 cache observations. No source files copied.
 */
export const OCELLUS_ASSETS = {
  npcs: {
    ocellus: { id: 16677, animations: {
      idle: 14840,
      walk: 14849,
      attack: 14851,
      death: 14872,
      deflect: 14863,
      void: 14857,
      slash: 14846,
    }},
    voidRift: { id: 16678, animations: {
      idle: 14895, spawn: 14896, death: 14897, detonate: 14898,
    }},
  },
  items: {
    ocellusTwistedBow: { id: 20997 },
    ocellusScytheOfVitur: { id: 22325 },
    ocellusToxicBlowpipe: { id: 12926 },
    ocellusMasoriMaskF: { id: 27235 },
    ocellusMasoriBodyF: { id: 27238 },
    ocellusMasoriChapsF: { id: 27241 },
    ocellusZaryteVambraces: { id: 26235 },
    ocellusNecklaceOfRupture: { id: 33639 },
    ocellusDizanasQuiver: { id: 28951 },
    ocellusDragonArrows: { id: 11212 },
    ocellusAvernicTreadsMax: { id: 31097 },
    ocellusVenatorRing: { id: 28310 },
    ocellusSaradominBrew: { id: 6685 },
    ocellusSuperRestore: { id: 3024 },
    ocellusSuperCombatPotion: { id: 12695 },
    ocellusRangingPotion: { id: 2444 },
  },
} as const satisfies CacheAssets;
