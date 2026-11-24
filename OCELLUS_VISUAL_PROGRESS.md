# Ocellus Phase 4 — visual fidelity tracker

Primary objective: match the real game's Phase 4 visuals, while retaining the Sol trainer's dark/gold website controls. Scope excludes Phases 1–3 and new gameplay assistance.

**Scores are approximate engineering assessments, not measured pixel similarity or a count of fully completed checklist items.** 0 = absent, 25 = early approximation, 50 = substantial implementation with gaps, 75 = native implementation with some validation, 100 = verified against matched real-game captures at all relevant stages. Round to the nearest five points; keep scores unchanged until there is new evidence. A passing build confirms availability and regressions, not visual equivalence.

| Category | Estimated progress | Change since last report | Remaining evidence/work |
|---|---:|---:|---|
| Arena geometry and scenery | ███████████████░░░░░ 75% | +0% | Native floor, curb, joined backing and visible censer; matched cliff silhouette and full-angle comparison remain. |
| Lighting, textures and materials | ████████████░░░░░░░░ 60% | +0% | Cache-lit floor/curb; fixture object lighting applied, production and final client lighting comparison pending. |
| Ocellus model and animations | ██████████████░░░░░░ 70% | +0% | Native 16677; exact pose timing, hover height, orientation, death and overhead comparison remain. |
| Void effects and environmental hazards | ██████████████░░░░░░ 70% | +0% | Native star source, calibrated flood, matching 2D diagonal halves; exact UV, rim and formation/clear remain. |
| Attack graphics and special effects | ██████████████░░░░░░ 70% | +0% | Native transition and mark graphics; logical-clock mark playback, exact positions and deflection effects pending. |
| Lifeforce fragments | ████████████████░░░░ 80% | +0% | Native formation, mature, departure, drain/recovery; logical-clock timing, visual scale and game-frame comparison pending. |
| Void Rift visuals | ██████████████░░░░░░ 70% | +0% | Native 16678, spawn/idle/death/detonation and bars; exact scale, charge bar and simultaneous burst comparison remain. |
| Player visuals and equipment | ████████████░░░░░░░░ 60% | +0% | SDK native equipment/animations; audit loadouts, clip/interpolation and hitsplats against client. |
| Camera and viewport | ███████████░░░░░░░░░ 55% | +0% | Native SDK player-follow restored; starting pitch retained; matched zoom/perspective and production camera capture pending. |
| RuneLite interface accuracy | █████████████░░░░░░░ 65% | +0% | Native overheads and rotated minimap; bar repositioned and non-overlapping healsplats; exact interface layout pending. |
| Website interface | ████████████████░░░░ 80% | +0% | Sol-derived controls and attempt metrics; chat newest lines, keyboard focus, narrow-layout handling; browser checks pending. |
| Rendering quality and smoothness | ███████████████░░░░░ 75% | +0% | Batched floor and cached validated assets, idempotent GPU teardown and effect rewind; device profiling pending. |
| Visual verification | ████████░░░░░░░░░░░░ 40% | +0% | Successful production captures reviewed and generated mesh/image bounds independently validated; matched real-game captures remain. |

Overall (rounded unweighted mean): **67% (+0%)**. Baseline is the last reported 67%. Camera retest pending. Changes are percentage points and remain provisional until matched real-game verification.

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

Latest evidence: 7daca07 Pages deployment passed; actual baked foundation (1,930 triangles), curb (1,171 triangles), 896×832 floor, 128×128 flood and 224×208 minimap were independently checked. 56d842f Test workflow passed. 698cdef full CI and Pages passed. Player-follow correction awaits CI and deployment. Next: compare the new fixture lighting and boss framing against captured frames, then prioritise real-game camera, lighting, void and animation comparisons.
