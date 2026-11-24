# Ocellus Phase 4 — visual fidelity tracker

Primary objective: match the real game's Phase 4 visuals, while retaining the Sol trainer's dark/gold website controls. Scope excludes Phases 1–3 and new gameplay assistance.

**Scores are approximate engineering assessments, not measured pixel similarity or a count of fully completed checklist items.** 0 = absent, 25 = early approximation, 50 = substantial implementation with gaps, 75 = native implementation with some validation, 100 = verified against matched real-game captures at all relevant stages. Round to the nearest five points; keep scores unchanged until there is new evidence. A passing build confirms availability and regressions, not visual equivalence.

| Category | Estimated progress | Change since last report | Remaining evidence/work |
|---|---:|---:|---|
| Arena geometry and scenery | ███████████████░░░░░ 75% | +0% | Native floor, curb, joined backing and visible censer; matched cliff silhouette and full-angle comparison remain. |
| Lighting, textures and materials | ██████████████░░░░░░ 70% | +0% | Cache-lit floor/curb; fixture object lighting applied, production and final client lighting comparison pending. |
| Ocellus model and animations | ██████████████░░░░░░ 70% | +0% | Native 16677; exact pose timing, hover height, orientation, death and overhead comparison remain. |
| Void effects and environmental hazards | ██████████████░░░░░░ 70% | +0% | Native star source, calibrated flood, matching 2D diagonal halves; exact UV, rim and formation/clear remain. |
| Attack graphics and special effects | ████████████████░░░░ 80% | +0% | Native transition and mark graphics; logical-clock mark playback, exact positions and deflection effects pending. |
| Lifeforce fragments | ██████████████████░░ 90% | +5% | Native formation, mature, departure, drain/recovery; logical-clock timing, visual scale and game-frame comparison pending. |
| Void Rift visuals | ███████████████░░░░░ 75% | +0% | Native 16678, spawn/idle/death/detonation and bars; exact scale, charge bar and simultaneous burst comparison remain. |
| Player visuals and equipment | ████████████░░░░░░░░ 60% | +0% | SDK native equipment/animations; audit loadouts, clip/interpolation and hitsplats against client. |
| Camera and viewport | ███████████░░░░░░░░░ 55% | +0% | Native SDK player-follow restored; starting pitch retained; matched zoom/perspective and production camera capture pending. |
| RuneLite interface accuracy | ██████████████░░░░░░ 70% | +0% | Native overheads and rotated minimap; bar repositioned and non-overlapping healsplats; exact interface layout pending. |
| Website interface | ████████████████░░░░ 80% | +0% | Sol-derived controls and attempt metrics; chat newest lines, keyboard focus, narrow-layout handling; browser checks pending. |
| Rendering quality and smoothness | █████████████████░░░ 85% | +0% | Batched floor and cached validated assets, idempotent GPU teardown and effect rewind; device profiling pending. |
| Visual verification | ██████████░░░░░░░░░░ 50% | +5% | Successful production captures reviewed and generated mesh/image bounds independently validated; matched real-game captures remain. |

Overall (rounded unweighted mean): **72% (+1%)**. Baseline is the last reported 71%. Scores are implementation estimates, not measured pixel similarity. No camera changes.

## Current batch

- Native minimap from original top-surface samples, player-centred rotation and NPC markers (90591e7; production validation pending).
- 2D floor world-coordinate correction, native curb background, and shared flood texture (593591f).
- NPC markers use the centre of their south-west anchored footprints (d36cf90; Test workflow passed).
- Rotating terrain with screen-space, pixel-aligned NPC and player dots; regression cases cover quarter-turn and diagonal camera angles (7135525; Test workflow passed, production validation pending).
- Remove duplicate clipped rock triangles from shared box boundaries without removing distinct original faces. Record duplicate counts per model in the extraction summary and exercise coplanar wall fixtures.
- Add browser pixel checks for solid 3×3 minimap markers at three rotated camera angles (production validation pending).
- Recessed backing uses joined convex/concave corners; closed contour tests include point-touching tiles.
- 2D outer flood follows the three native diagonal wall halves, matching existing 3D topology.
- Reject incorrectly sized native floor, flood and minimap images before sharing across attempts.
- Geometry extraction and lighting tests also run in the fast Test workflow.
- Superseded boss-relative focal bias following user feedback: camera follows the player only, using the native SDK interpolation. Preserve starting pitch, zoom, rotation and projection.
- Native orb and mark playback use logical fight time at any trainer speed; reset/rewind clears old effect instances.
- Native mesh metadata, coordinates, colours and source order are validated before caching. GPU destruction is idempotent and named scene layers support diagnostics.
- Boss green healsplats avoid native damage slots; game chat scrolls to the latest message, result keyboard focus and narrow-screen overflow improved.
- Pages checks out the exact triggering SHA and embeds source revision markers for both trainers.
- Reviewed successful 7135525 browser screenshots: the native purple hanging censer, support, floor, transition VFX and rifts are visible; the large boss bar obscures the levitating boss at spawn.
- Ocellus-only health bar keeps SDK artwork and moves left of the central combat view, with bounded compact width.
- Cache object lighting now applies to static censer models 62357 and 62739, using each original definition's ambient, contrast and orientation instead of generic actor lighting.
- Retain source SHA and requested/observed ticks with all five Chromium evidence frames.
- Replace finite abyss mesh with uniform scene background, removing the observed horizon seam.
- Join void glow strips at cardinal/diagonal corners; avoid duplicate transparent face passes and keep close-up native stars sharp.
- Loaded instanced effects and scenery now submit the current frame synchronously before WebGL rendering; cold pools retain their async path.
- Verified deployed head-icon rasters are 25×25; use original dimensions, suppress live curses/charge bars on dying NPCs, and quantise charge pixels.
- Legacy 2D fallback preserves underlying ground and composes mark/orb/hole indicators independently; 3D models remain native.
- Preload decoded Void Rift model and native frame sounds before the encounter; spawn remains unchanged.
- Audit the six shipped NPC/scenery models, all 18 native NPC/scenery sequences, 16 default/alternate equipment and supply IDs, and all 38 shared player sequences directly from compiled payloads.
- Camera follows player only; no camera edits in this batch.
- Remaining artificial cliff backing retained pending a rendered comparison; geometric coverage alone does not prove a hole-free result.
- Progress scores reflect implementation plus available evidence; do not raise to 100% without direct game-reference comparison.

Latest evidence: 7daca07 Pages deployment passed; actual baked foundation (1,930 triangles), curb (1,171 triangles), 896×832 floor, 128×128 flood and 224×208 minimap were independently checked. 56d842f Test workflow passed. 698cdef full CI and Pages passed. Player-follow correction and e91edcf passed production deployment. Current batch: direct native spot sequence age at first presentation (no double draw), interpolated minimap with fixed mask, finite pixel-aligned rift charge, distant floor texture mipmaps. CI and live visual confirmation pending. Camera remains unchanged.

- Recovered all five e91edcf production screenshots, with exact observed ticks 17, 33, 68, 82 and 97. The black scene background, censer, inner-void rim, transition and Rift visuals are present. The player-follow camera is preserved.
- Directly inspected compiled cache data: model 62739 animation 10772 has 64 alpha-changing frames and 474 affected vertices. Rift burst 4306 and Rift detonation 14898 each have 10 alpha-changing frames and 504 affected vertices. Instanced materials now consider the actual posed alpha arrays, rather than the opaque bind pose alone; the existing non-instanced NPC renderer already supports animated alpha.
- Added outer-void and cleared-floor Chromium captures with stage and player/orb metadata. Latest production validation pending.

- Restored native texture 215 and UVs to attached cache graphics: 4276 (82 triangles), 4306 (86), 4328/4329/4330 (144 each). All three transition effects contain priority-reordered indices (33 material runs), and 432 textured vertices share face colour 4 with the dark central disc. The Ocellus SDK now groups actual index runs and limits core recolouring to untextured faces. Alpha-tested invisible faces no longer write depth; attached graphics avoid bind-pose frustum culling. New compiled asset checks enforce original UV and texture coverage. Production rendering pending.

- Protect cache actor destruction against asynchronous loads and cached redraws; retain attached-graphic offsets and prevent animated NPC/player meshes from disappearing at bind-pose culling bounds. Added actual Chromium transition material and post-reset posed actor probes. All ten visible equipped item meshes have native skin assignments and source identities; enforce this in the cache audit. No player/camera or gameplay input changes.

- Native texture 215 is packed display RGB and has repeating UVs: death crack 4276 contains 255 coordinates outside [0,1], ranging from approximately -1.42 to 2.58. Apply sRGB decoding and repeat wrapping rather than clamping; retain nearest near sampling and mip filtering at a distance. Browser checks now require native repeat and colour-space properties. Actual prior deployed assets: 600 textured triangles across five effects, 13,107 fully skinned equipment vertices across ten items. Current rendered verification pending.

- Recovered seven successful 852c472 Chromium screenshots (all requested and observed ticks match, including outer void 51 and cleared floor 59). The new continuous mature-fragment animation preserves a single native 4310 instance across all loop boundaries rather than reallocating a slot every 32 cycles. Native sound and world-space orientation are preserved; production verification pending.

- Shared 2D/3D reconstructed rim colour and depth; 2D draws the ground, mitered rim, then transient floor marks. Active inner and outer boundaries match the recovered diagonal topology and disappear on phase clear. Pending full CI and browser verification.

- Confirmed c3339f4 full production deployment and inspected its seven exact-tick captures. Browser proof: native ranged tell 4330 uses 144 textured triangles in 33 ordered runs, 5,628 UV vertices, sRGB texture 215 (128px, repeated both axes). Post-reset boss/player pose proof: 14,373/10,200 vertices, sequences 14864/819 active. This establishes runtime asset and pose availability, not a direct real-game visual match.
- Added a local-only browser probe across the outer-void clear (ticks 51–59) requiring the same mature fragment instance and pool slot after multiple 32-cycle animation periods. Native 4310 loop continuity and the new 2D border remain pending production validation.

- Correct actor material runs for reordered triangle indices; update attached graphic offsets even on cached pose renders; reuse unchanged RGB while updating animated alpha. No camera or gameplay changes. Production validation pending.
