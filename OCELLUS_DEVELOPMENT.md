# x0XP Ocellus Trainer — Phase 4 trainer

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

**This is an experimental Phase 4 prototype, not a verified full fight.** Phases 1–3 have **not** been implemented. Timing and interaction rules are derived from publicly documented fight logs and community research, and still require actual gameplay calibration. Native cache models, spot animations, hitsplats and recovered arena geometry are used throughout Phase 4. Final client postprocessing and some phase-specific scenery remain approximate. Normal attempts use fresh seeds; the loopback-only smoke harness uses seed 42 for reproducible verification.

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

Cache 2746 (OSRS revision 241) uses the newer unnamed map index. The older reader's named m/l lookup does not establish that the map is absent. The build now attempts group 16472 directly (file 0 terrain, file 1 locations), following RuneLite's RegionLoader layout, and retains a plane-1 scene audit with original heights, object placements, models and floor definitions if decoding succeeds. The extraction succeeded: 306 tiles and 52 placements in the audited window. Objects 62894 and 62895 are placed at plane-1 local (40,32) (trainer 8,8), using models 62357 and 62739 respectively, with native sequence 10772 on the second object and offsetHeight -64 on both. The trainer now uses these exact static fixtures rather than a generic fire. The static native rock objects 62924/62925/62928 (models 62274/62275/62277) are extracted at their exact map anchors. Their opaque, untextured triangles are clipped to the surviving footprint with a narrow decorative margin and kept below the floor plane. Native face colours are retained with an approximate abyss fade. The original reconstructed cliff is inset behind them as backing; the original upper rock faces from models 62274, 62275 and 62277 cover all 84 playable tiles at a common native altitude of -1/128 tile. Their packed-HSL face colours are baked at 64 samples per tile and mapped onto the existing single floor mesh, replacing the reconstructed checkerboard in 3D. The raised curb now uses the three original models' clipped upper and vertical faces in the 29 visual walkway tiles, replacing rectangular caps and preserving partial outer edges. Its face colours are cache-derived but full client lighting remains approximate. The 2D floor uses the same baked native texture. Recessed cliff backing and the placement of the dynamic hanging censer remain reconstructed. Full client lighting is not yet reproduced. This intentionally does not draw the intact, pre-collapse map over the playable phase.

## Pending work

1. Validate Phase 4 timing, pray-at-impact and collision accuracy in actual browser play.
2. Verify remaining reconstructed scenery and dynamic animation details against live footage.
3. Add separately verified Phases 1–3 and transitions.
4. Continue validating OSRS 2746 assets and deploy tested improvements from the default `colosseum` branch.

### Native floor edge handling

The first 64-sample/tile extraction rejected raised curb-lip samples along the east wall. Floor baking now selects only native faces at the verified flat elevation, and counts any nearest-colour extension within the same tile where the cache lip occludes the underlay. The build rejects tiles with less than half verified flat coverage and total fallback above 10%. The north ledge contributes its own original foundation facets; recessed backing uses a matching darker palette. Collision and phase timings are unchanged.

### Cache object lighting and flood presentation

The original rock definitions use ambient 20 and contrast 1750. The extraction now applies the pinned SDK scene-lighting convention (ambient 64 + definition ambient, contrast 768 + definition contrast, directional light -50/-10/-50). Smooth and flat face normals produce individual lit RGB vertices; clipping interpolates those colours in linear RGB. The 64-sample-per-tile native floor texture is baked with the same lighting, and both 2D and 3D consume it. This does not certify the live RuneScape client's final postprocessing or the exact post-collapse texture UVs.

Texture 215 is preserved untouched for original models. A separate flood-only image uses its six original star clusters per tile, with a palette calibrated to the reference footage's #1e2529 background and #babcc2 stars. The 2D overlay priority matches the 3D ordering (marks/orbs above flood, flood above permanent holes).

### Attempt feedback and asset lifecycle

Normal resets vary deterministic encounter patterns through a fresh seed. Live and final attempt metrics share one calculation. Native ground effects use the encounter clock rather than wall time, and the impact mark is retained on its impact tick even if a render frame is skipped. The compiled asset audit checks all 16 encounter spot sequences, including their decoded frame counts, duration, scale and sound references. Only four verified unavailable source sounds (12812, 12813, 12815, 12826) are tolerated by the frame sound patch.

The native floor bake contains 344,064 playable-floor pixels, with zero fallback or extended pixels in the verified cache-2746 extraction. Only the 24 substantially covered walkway cells (at least 80% native surface coverage) contribute recessed cliff backing; five thin original edge fragments remain visible as native geometry without a full-tile artificial cliff. Native foundation and curb payloads are cached on the CPU across resets, while each attempt owns and disposes its own GPU meshes. Failed network requests remain retryable. Collision and all 84 playable tiles are unchanged.

### Defence and stat-drain protection

The 21 October 2026 Fractured Archive hotfix sets a minimum of 60% of base Defence for Ocellus, or 150 from his base 250. The Ocellus-only landing guard clamps after each weapon callback, including successive hits. Deflected attacks retain the SDK's impact visuals but do not apply combat-stat drains. The existing Phase 4 stat persistence and unverified reflection behaviour are unchanged. The final-phase stat reset rule is not confirmed by the reference, so no artificial reset is added.

The 28 October 2026 post-release update additionally capped offensive-stat reduction at 50%. The per-hit guard now enforces that floor on Attack, Strength, Ranged and Magic, rounding fractional minima upward. The OSRS Wiki Demon attribute listing reports Ocellus at 80% demonbane effectiveness, so the boss supplies that multiplier to the SDK weapon formulas rather than inheriting its non-demon default. No stat reset is added: the same October update removed Defence restoration between P3 quadrants. The Phase 4 warning audio volume was also increased in that patch, but the exact client gain is not published.
Sources: https://oldschool.runescape.wiki/w/Demon_(attribute), https://beta.osrs.cloud/news/halloween-event-2026-tfa-tweaks--more

### Phase-specific movement obstruction

The reference trainer's 23 October community report describes the boss's 3×3 footprint as movement-blocking only during the outer void. This is provisional, not established by combat logs. Existing nine logical floor entities supply movement-only collision in that stage; they remain visible floor and do not block projectile line of sight. Movement before the NPC turn uses the upcoming mechanic tick. Players already under Ocellus can leave normally, with no forced teleport or trap; this escape behavior is a trainer safeguard pending game confirmation. All other stages and Sol are unchanged.

### Reset rendering and image lifetime

The 319349d browser trace confirmed the outer-void nine-tile footprint route and tick-59 clearance. Its deployment was blocked by a reset probe reading an empty frame (0 actors, 0 calls) before WebGL reconciliation. The probe now runs after the verified normal-input dodge at tick 18, rather than before it. The arena image decoder shares CPU-side floor and flood images with 2D/3D consumers and successive attempts; each arena retains separate GPU texture ownership. Browser checks require one request for each geometry and image asset. This is a resource-lifetime improvement, not a measured FPS gain.

### Projectile landing frame

The SDK boss incoming queue executes before the same tick's encounter presentation. Using the last published frame delayed the 60% explosion damage reduction by one tick. A scoped landing-frame accessor now uses the upcoming simulator tick only within the boss's actual incoming-hit queue. Attack-launch deflection and other presentation timing are unchanged. Regression cases cover the first mark, sixth impact and first unmitigated tick of both voids, plus the next cycle. The 60% value remains the previously selected community approximation, not a verified weapon-specific formula.

### Long encounter regression

A deterministic test-only ten-cycle stress replay checks 608 mechanic ticks for each of five seeds (including 32-bit limits), using independent sampled player positions and HP inputs. It verifies 120 explosions, 20 transitions, 20 fragments and the 2/3/4/5 capped rift sequence per replay, exact resource accounting, one group detonation hit, safe spawn tiles, bounded active state, snapshot isolation and repeatability. This is not an unassisted in-browser kill or a claim that team-derived solo damage and timing values have been confirmed.
