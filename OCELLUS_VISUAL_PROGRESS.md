# Ocellus Phase 4 — visual fidelity tracker

Primary objective: match the real game's Phase 4 visuals, while retaining the Sol trainer's dark/gold website controls. Scope excludes Phases 1–3 and new gameplay assistance.

**Scores are approximate engineering assessments, not measured pixel similarity or a count of fully completed checklist items.** 0 = absent, 25 = early approximation, 50 = substantial implementation with gaps, 75 = native implementation with some validation, 100 = verified against matched real-game captures at all relevant stages. Round to the nearest five points; keep scores unchanged until there is new evidence. A passing build confirms availability and regressions, not visual equivalence.

| Category | Estimated progress | Remaining evidence/work |
|---|---:|---|
| Arena geometry and scenery | █████████████░░░░░░░ 65% | Native floor, curb and 3 rock models; remaining backing, depth, dynamic censer and all-angle comparison. |
| Lighting, textures and materials | ███████████░░░░░░░░░ 55% | Cache object lighting and native floor; final client lighting, shadows, filtering, colour matching. |
| Ocellus model and animations | ██████████████░░░░░░ 70% | Native 16677 and sequences; match pose timing, hover height, orientation, death and overheads. |
| Void effects and environmental hazards | █████████████░░░░░░░ 65% | Native star source, calibrated flood, native pools; exact UV, rim, material and formation/clear still unverified. |
| Attack graphics and special effects | █████████████░░░░░░░ 65% | Native transition and mark effects; exact positions, colours, Soul Split/deflection effects and weapons need comparison. |
| Lifeforce fragments | ███████████████░░░░░ 75% | Native formation, mature, departure, drain and recovery sequence timing; confirm final visual scale and frames. |
| Void Rift visuals | ██████████████░░░░░░ 70% | Native 16678, spawn/idle/death/detonation and bars; compare scale, charge bar and simultaneous bursts. |
| Player visuals and equipment | ████████████░░░░░░░░ 60% | SDK native equipment/animations; audit loadouts, clip/interpolation and hitsplats against client. |
| Camera and viewport | ██████████░░░░░░░░░░ 50% | Working 3D camera and calibrated pitch; match zoom/perspective, full angle ranges and anti-aliasing; 2D coordinate fix pending. |
| RuneLite interface accuracy | ███████████░░░░░░░░░ 55% | SDK UI and native head icons; minimap implementation pending validation; compare native UI sprites, tooltips and health bars. |
| Website interface | ███████████████░░░░░ 75% | Sol-derived dark/gold controls and live/result metrics; consistency, loadout, settings, responsive and reset polish. |
| Rendering quality and smoothness | ██████████████░░░░░░ 70% | Batched floor, excluded 182 no-op entities, cached assets and tick-driven effects; frame-time profiling, low-FPS and repeated resets. |
| Visual verification | ███████░░░░░░░░░░░░░ 35% | Build captures and cache metadata checks; systematic matched game frames and camera/lighting comparisons remain. |

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
- Camera keeps the existing spawn calibration but smoothly biases toward the boss from every side; camera patch tests cover 25 positions.
- Native orb and mark playback use logical fight time at any trainer speed; reset/rewind clears old effect instances.
- Native mesh metadata, coordinates, colours and source order are validated before caching. GPU destruction is idempotent and named scene layers support diagnostics.
- Boss green healsplats avoid native damage slots; game chat scrolls to the latest message, result keyboard focus and narrow-screen overflow improved.
- Pages checks out the exact triggering SHA and embeds source revision markers for both trainers.
- Remaining artificial cliff backing retained pending a rendered comparison; geometric coverage alone does not prove a hole-free result.
- Progress scores reflect implementation plus available evidence; do not raise to 100% without direct game-reference comparison.

Next: validate screenshots from the latest production build, prioritise remaining cliff silhouette and hanging censer, then compare boss/void sequence frames and camera against actual footage.
