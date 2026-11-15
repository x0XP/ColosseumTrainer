# x0XP Ocellus Trainer — independent prototype

This is an **original Ocellus Phase 4 implementation built on the existing Sol Heredit Trainer's OSRS SDK framework**. Sol's boss class, arena and combat scripts are not imported.

Development branch: `prototype/ocellus-from-sol`. The live `colosseum` branch and its GitHub Pages deployment are unchanged.

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

The code is in `src/ocellus/`; `src/ocellus/index.tsx` is the build entrypoint on this branch. The source tree retains Sol's original files because it is based on that project. Extracting the Ocellus code to a separate repository is the next packaging step; **do not merge this prototype branch into `colosseum`**.

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

The GitHub Actions `Build Ocellus prototype` workflow runs this pinned build, performs a headless Chromium UI smoke test, and publishes the complete `dist/` directory as a downloadable workflow artifact. The artifact is **not** deployed to the live Sol trainer.

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

## Pending work

1. Validate Phase 4 timing, pray-at-impact and collision accuracy in actual browser play.
2. Replace simplified visuals with appropriate cache scene, animations, UI and effects.
3. Add separately verified Phases 1–3 and transitions.
4. Test OSRS 2746 asset generation and package/build/deploy into a **dedicated Ocellus repository**, not the live Sol site.
