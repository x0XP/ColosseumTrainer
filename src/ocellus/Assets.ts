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
      deflectLoop: 14864,
      deflectLand: 14865,
      lifeforceCast: 14855,
      transitionCast: 14844,
      void: 14857,
      slash: 14846,
    }},
    voidRift: { id: 16678, animations: {
      idle: 14895, spawn: 14896, death: 14897, detonate: 14898,
    }},
  },
  models: {
    ocellusBrazier: { id: 62440, animations: { idle: 14833 } },
    ocellusFloorHole: { id: 62508, animations: { idle: 14891 } },
  },
  // Actual game-cache spotanims replace placeholder 3D orbs and cones.
  spotAnims: {
    innerOrbSpawn: { id: 4311 },
    outerOrbSpawn: { id: 4309 },
    orbIdle: { id: 4310 },
    orbDespawn: { id: 4312 },
    orbTell: { id: 4313 },
    orbRegain: { id: 4314 },
    explosion: { id: 4339 },
    explosionTelegraph: { id: 4340 },
    meleeTransition: { id: 4328 },
    rangedTransition: { id: 4330 },
    magicTransition: { id: 4329 },
    levitation: { id: 4316 },
    riftBurst: { id: 4306 },
    deathBurst: { id: 4274 },
    deathSkirt: { id: 4275 },
    deathCrack: { id: 4276 },
  },
  sounds: {
    endShout: { id: 12490 },
    flood: { id: 12497 },
    explosionSeriesStart: { id: 12638 },
    explosionMark: { id: 12537 },
    meleeTell: { id: 12572 },
    meleeHit: { id: 12567 },
    rangedBeforeHit: { id: 12555 },
    rangedHit: { id: 12556 },
    magicWindUp: { id: 12554 },
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
