# x0XP Ocellus Trainer — independent prototype

This is an **original Ocellus Phase 4 implementation built on the existing Sol Heredit Trainer's OSRS SDK framework**. Sol's boss class, arena and combat scripts are not imported.

Development branch: `colosseum` (the default branch). Sol and Ocellus build together from one checkout and publish via a single GitHub Pages workflow.

## Present implementation

- OSRS SDK movement, prayer, inventory, equipment, 3D rendering and attackable boss
- Ocellus NPC 16677, Void Rift NPC 16678, using OpenRS2 OSRS cache 2746
- Phase 4's triangular 84-tile platform, 3x3 boss and 5x5 inner square
- 8-tick lead-in and repeating 60-tick phases: 22 inner, 9 transition, 20 outer, 9 transition
- Lifeforce drains, delayed recoverable fragments, floor hazards, targeted explosion marks, prayer-switch specials and attackable rifts that detonate after 30 ticks
- Session-only attempt details: fight time, Ocellus HP, dodge/prayer success and rifts, with a manual Reset
- x0XP dark/gold controls and visual appearance borrowed from the Sol trainer, including LoadoutManager and Advanced settings

**This is an experimental Phase 4 prototype, not a verified full fight.** Phases 1–3 have **not** been implemented. Timing and interaction rules are derived from publicly documented fight logs and community research, and still require actual gameplay calibration. Some presentation is simplified: floor geometry is custom rather than the game's full room, orbs are coloured floor tiles instead of their full animation, and damage changes do not yet use the complete RuneScape hitsplat pipeline. The engine uses deterministic seeded patterns to make tests reproducible.

## Separation

The Ocellus code is in `src/ocellus/`. `TRAINER_VARIANT=ocellus` selects the Ocellus entrypoint, HTML and ES2019 TypeScript profile. Sol keeps its default entrypoint, HTML and ES5 build target. Both live on `colosseum`, compiled with their respective SDK/cache profiles and deployed as one site.

## Development

Use Node.js 22, the OSRS 2746 asset cache, and the TFA-compatible pinned SDK and cache-reader forks (the same pins used by ArchiveOcellusTrainer). The old Sol development SDK cannot decode these newer assets.

```bash
OSRS_SDK_REPO=https://github.com/Julian-Dasilva/osrs-sdk.git \
OSRS_SDK_COMMIT=9995966c094c4cd18ab8b05038c9890ab95a189f \
OSRS_CACHE_READER_REPO=https://github.com/Julian-Dasilva/osrscachereader.git \
OSRS_CACHE_READER_COMMIT=8ba9131f1afd1193e7c6180db5a895ffe9e21fa8 \
NETLIFY_CACHE_DIR=/tmp/ocellus-prototype-cache \
bash scripts/build-ocellus.sh

# Serve the generated dist directory; do not open index.html via file://
python3 -m http.server 8000 --directory dist
# opens on http://127.0.0.1:8000/
```

The single GitHub Pages workflow first preserves the Sol build, then compiles Ocellus from the same checkout, runs the Chromium smoke test, and publishes Sol under `/ColosseumTrainer/` and Ocellus under `/ColosseumTrainer/ocellus/`.

### Checks

```bash
npm test -- --runInBand
npx tsc --noEmit --skipLibCheck
```

The deterministic `src/ocellus/tests/Phase4.test.ts` suite checks the geometry, cycle boundaries, event timing, damage, rifts and orb placement. Existing Sol tests must still pass.

## Research and attribution

- Built on `x0XP/ColosseumTrainer`, itself a GPL-licensed derivative of `Supalosa/ColosseumTrainer`.
- Encounter rules were independently written with reference to `Julian-Dasilva/ArchiveOcellusTrainer` (GPL-3.0), especially its `src/content/ocellus/js/OcellusTimings.ts`, sourced from 2026-10-23 RuneLite fight logs and community VODs.
- The Ocellus reference is a **research source**, not an imported runtime dependency. Attribution is retained here.
- OSRS and game assets belong to Jagex. This is an unofficial fan project.

## Native map recovery

Cache 2746 (OSRS revision 241) uses the newer unnamed map index. The older reader's named m/l lookup does not establish that the map is absent. The build now attempts group 16472 directly (file 0 terrain, file 1 locations), following RuneLite's RegionLoader layout, and retains a plane-1 scene audit with original heights, object placements, models and floor definitions if decoding succeeds. The extraction succeeded: 306 tiles and 52 placements in the audited window. Objects 62894 and 62895 are placed at plane-1 local (40,32) (trainer 8,8), using models 62357 and 62739 respectively, with native sequence 10772 on the second object and offsetHeight -64 on both. The trainer now uses these exact static fixtures rather than a generic fire. The static native rock objects 62924/62925 (models 62274/62275) are extracted at their exact map anchors. Their opaque, untextured triangles are clipped to the surviving footprint with a narrow decorative margin and kept below the floor plane. Native face colours are retained with an approximate abyss fade. The original reconstructed cliff is inset behind them as backing; the original upper rock faces from models 62274, 62275 and 62277 cover all 84 playable tiles at a common native altitude of -1/128 tile. Their packed-HSL face colours are baked at 64 samples per tile and mapped onto the existing single floor mesh, replacing the reconstructed checkerboard in 3D. The raised curb now uses the three original models' clipped upper and vertical faces in the 29 visual walkway tiles, replacing rectangular caps and preserving partial outer edges. Its face colours are cache-derived but full client lighting remains approximate. The 2D floor, cliff backing, and dynamic hanging censer remain reconstructed. Full client lighting is not yet reproduced. This intentionally does not draw the intact, pre-collapse map over the playable phase.

## Pending work

1. Validate Phase 4 timing, pray-at-impact and collision accuracy in actual browser play.
2. Replace simplified visuals with appropriate cache scene, animations, UI and effects.
3. Add separately verified Phases 1–3 and transitions.
4. Continue validating OSRS 2746 assets and deploy tested improvements from the default `colosseum` branch.
