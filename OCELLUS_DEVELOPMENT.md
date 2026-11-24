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

### Native minimap and 2D visual consistency

The native top-surface report is baked into a separate transparent 224×208 PNG containing both the playable floor and recovered curb fragments. The Ocellus-only SDK map hook draws that artwork at four pixels per tile, centered on the player, with a rotating map and fixed interface mask, and visible NPC markers. No future hazard or safe-tile markers are added. This is cache-derived artwork, not a verified replica of the live client's minimap settings or colours.

The legacy SDK 2D viewport draws entities into a world-space canvas without translating to each entity origin. Previously the Ocellus tile override drew each tile at (0,0). Tiles now use their real world-space pixel destinations, including hazard overlays. The top-surface artwork supplies the missing 2D curb background, and the 2D active flood uses the same derived texture as 3D. All five decoded geometry/image assets remain shared across attempts; the combat grid and 3D rendering are unchanged. Production browser checks validate the minimap pixels and asset requests. The visual tracker is maintained in [OCELLUS_VISUAL_PROGRESS.md](OCELLUS_VISUAL_PROGRESS.md).

### Consolidated camera, assets, and presentation pass

The starting pitch and spawn view retain the calibrated values. The focal bias is now bounded to 1.25 tiles toward the centre of Ocellus's 3×3 footprint, instead of always facing south of the player. This is a trainer framing choice, not a measured RuneLite camera match. Native arena mesh validation now checks source order, metadata, face counts, colours, and world bounds before the shared cache accepts data. Each attempt still owns and disposes its GPU resources. Native floor effects use logical 600 ms encounter ticks so adjusted training speed does not distort their sequence age. Rewinding clears their previous playback instances. Healing hitsplats reuse unoccupied native SDK locations. Build checkout and revision markers distinguish the source used by each unified Pages deployment.

### Rendered evidence and original fixture lighting

The successful 7135525 deployment's retained tick-17 and tick-33 screenshots show the purple hanging censer and supporting fixtures; the tick-82 image shows the levitating boss and a living rift. The remaining visual problem at spawn was the large centre-aligned boss bar obscuring the raised model. The Ocellus SDK patch relocates that same bar to the left. This is a visibility choice and not evidence of exact game HUD placement.

The retained native region report gives model 62357 (loc 62894, shape 22, orientation 3, ambient 20, contrast 500) and model 62739 (loc 62895, shape 10, orientation 1, ambient 70, contrast 1750). The pinned raw-model asset adapter normally exports both with actor lighting. The Ocellus-only patch reads the actual object definition and uses its cache object light, transformed into the raw model's local orientation; other model exports are unchanged. The source revision and requested/observed screenshot ticks are retained alongside the visual artifact.

### Player-follow camera correction (24 November)

User clarified that the camera should follow the player, not Ocellus. This supersedes all prior boss-relative framing choices. The Ocellus-specific SDK camera patch now changes only the starting pitch. Initialisation, per-client-tick following, interpolation, projection, reset, zoom and rotation remain the original pinned SDK implementation. No automatic boss tracking or HUD-relative camera translation is added.

### Visual pass after player-follow correction

Remove the finite abyss mesh seen as a horizontal dark seam in the user's screenshot. A uniform scene background supplies the same dark colour at every camera angle and zoom. The player-follow camera, rotation, zoom and projection are unchanged. Join the void glow strips at their polygon corners; preserve the original edge and .18-tile inward thickness, including diagonal wall segments. Native flood texture uses nearest magnification and mipmapped minification. The current frame of an already-loaded cache instanced model is submitted synchronously, instead of waiting until after WebGL render; cold pools remain asynchronous. The original shipped head icons are all 25×25 pixels. Render those pixels without upscaling and do not retain combat curses or rift charge indicators on dying NPCs. The optional 2D fallback composes separate ground and symbolic markers; no changes to 3D effect identities or encounter mechanics.

Compiled native actor audit: the successful 7daca07 Pages bundle supplies the pinned geometry counts, NPC scale, sequence lengths and frame counts. New build checks compare actual OSRB payloads, require all visible loadout meshes and shared player pose data, and reject broken indices, colours, UVs and missing textures. The late-spawning Rift's original decoded payload and native frame sounds are warmed in the temporary Ocellus viewport before the fight; no hidden NPC is added to the world.

### Native presentation timing and raster pass

The Ocellus-specific pinned SDK supports an optional absolute spot-animation clock for the three floor-effect actors, including the first render after asynchronous instance allocation. Other models retain their normal time source. The minimap reads the original player's interpolated position on live draws and retains a fixed interface mask; diagnostics may still draw exact tile positions. Rift charge uses integer pixels and restores canvas fill state. Floor texture mipmaps are a rendering-quality choice to reduce distant shimmer, not a measured game-client match. No camera changes or combat-rule changes.

### Posed transparency and complete phase captures

The e91edcf Pages artifact was decoded independently: 62739/10772 begins opaque but all 64 posed frames change alpha (474 vertices). 4306/14910 and 16678/14898 also begin opaque and each changes 504 vertices across ten frames. The instanced SDK now creates its material after posing and chooses transparency from actual posed alpha values. Opaque-only geometry remains in the opaque queue. This does not change the non-instanced NPC renderer, which already enables cache alpha. The browser evidence now also captures the active outer void and cleared floor with requested/observed ticks, stage and local player/orb positions.

### Attached spot graphics

The deployed cache 2746 payloads for death crack 4276, Rift burst 4306 and the three transition tells contain texture 215. The non-instanced SDK was discarding those UVs and textures when building attached graphics. The Ocellus-specific patch restores them without altering native geometry or triangle priority order, and excludes textured faces from the existing dark-core recolour. Each tell has 144 textured triangles and 33 ordered draw runs; the original face colour 4 is shared by 888 plain and 432 textured vertices. Transparent fragments are alpha tested and animated effects are not culled against their bind-pose bounds. Exact client blending and final rendered comparison remain outstanding.

### Actor presentation lifecycle

Prevent stale asynchronous models from reattaching after a reset and preserve attached graphics when a cached draw skips animation recomputation. Native animated meshes are not culled using their unanimated bounding sphere. Add browser evidence for the original transition texture material and the active posed boss/player meshes after reset. The ten visible item meshes in the reference bundle have one skin assignment per vertex, and this now becomes a build invariant. No equipment defaults, gameplay or camera controls were changed.

### Native texture sampling

Restore repeating UV semantics and the correct display RGB input colour space for the cache model textures in the Ocellus-only SDK checkout. The original death crack 4276 includes 255 out-of-range UV components. Clamping these stretches edge pixels rather than repeating the star texture. Preserve nearest texels close up; enable mip filtering at a distance. The browser material probe now checks texture dimensions, sRGB and both wrap axes. These are renderer corrections, not new combat mechanics or camera changes.

### Continuous mature-fragment animation

The mature native 4310 graphic now retains a single instanced actor throughout its 32-client-cycle repetitions. Its absolute encounter age drives native looping and the per-instance sound cursor; formation, departure and explosion still terminate at their original duration. No combat or camera changes. Production verification pending.

### Shared 2D void rim and foreground order

The top-down fallback now draws the entire ground first, including the three native diagonal halves, then a joined gradient strip using the same rim colour, depth and topology as the reconstructed 3D border. Transient hole, mark and fragment symbols are drawn last; they cannot be overwritten by a neighbouring ground tile. The 2D appearance is a training fallback, not a native cache-graphic reproduction. No collision, timing or camera changes.

The continuous-fragment browser regression spans the outer void and cleared floor at ticks 51 and 59, comparing the live model identity, slot, elapsed age and cue key. This fixture is local CI only; no live gameplay instrumentation is enabled. Previous c3339f4 production render proofs passed.

### Actor material and placement presentation

Native actor material groups follow the actual triangle index buffer. Attached graphics have their local placement updated each render, even on cached animation frames. Cache RGB is converted only when the recolour changes, but native alpha is updated each sampled frame. These changes preserve the previous world-to-local placement formula, animation IDs and camera behaviour. Production validation pending.

Newly loaded actor meshes now present the first native pose before their first client cycle. The render-only path preserves any active one-shot and neither advances the animation clock nor consumes a client tick. This prevents the bind pose being displayed during a mesh load or equipment replacement. Production confirmation pending.

### NPC raster and cold instance submission

Boss and Rift health bars share integer raster baselines with their charge bars, retaining the existing palette and health scale. Cold asynchronous instance draws discard obsolete presentation requests. Camera and gameplay unchanged.

### Native floor mipmap sampling

The 84-tile source raster remains unchanged and transparent outside the original footprint. A separate 896×832 3D sampling image extends the nearest verified opaque texel into unused space, preventing black transparent texels from contaminating mipmaps. The actual stone mesh and collision footprint remain unchanged. Chromium checks every native pixel against the original image. No camera changes.

### Instanced native geometry presentation

Correct texture membership for indexed instanced geometry. Share invariant UV data and convert baked RGB only once per pool; retain independent alpha arrays per pose. Remove unused normals from unlit cache materials. Instance count now tracks each frame's highest occupied slot, including when an actor leaves that frame. Browser proof checks live fragment frame counts and absence of unused normal attributes. No combat, camera or native animation timing changes. GPU performance benefits remain unmeasured.

### Stable native hitsplat placement

The original four damage/miss/healing positions are retained. Reserve surviving slots before assigning new ones, resolve duplicate or invalid offsets, and retain the existing four-hit cap and delay filtering. This prevents overlapping numbers when incoming projectiles arrive in a different list order. The Ocellus-specific SDK patch leaves the Sol build untouched.

### Synchronous preloaded native effects

Preloaded model pools are indexed by the resolved cache bundle and can allocate a native actor immediately on its first draw. A new cache configuration never uses another bundle's pool. Cold loading and the latest-draw guard remain intact, failed pools are removed for retry, and destroyed actors cannot claim a slot. Chromium verifies that the mature fragment used the synchronous prepared path. Camera and combat rules unchanged.
