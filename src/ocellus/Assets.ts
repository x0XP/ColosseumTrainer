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
    twistedBow: { id: 20997 },
    scytheOfVitur: { id: 22325 },
    toxicBlowpipe: { id: 12926 },
    masoriMaskF: { id: 27235 },
    masoriBodyF: { id: 27238 },
    masoriChapsF: { id: 27241 },
    zaryteVambraces: { id: 26235 },
    necklaceOfRupture: { id: 33639 },
    dizanasQuiver: { id: 28951 },
    dragonArrows: { id: 11212 },
    avernicTreadsMax: { id: 31097 },
    venatorRing: { id: 28310 },
    saradominBrew: { id: 6685 },
    superRestore: { id: 3024 },
    superCombatPotion: { id: 12695 },
    rangingPotion: { id: 2444 },
  },
} as const satisfies CacheAssets;
