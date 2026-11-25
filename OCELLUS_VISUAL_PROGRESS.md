# Ocellus Phase 4 — visual fidelity tracker

Primary objective: match the real game's Phase 4 visuals, while retaining the Sol trainer's dark/gold website controls. Scope excludes Phases 1–3 and new gameplay assistance.

**Scores are approximate engineering assessments, not measured pixel similarity or a count of fully completed checklist items.** 0 = absent, 25 = early approximation, 50 = substantial implementation with gaps, 75 = native implementation with some validation, 100 = verified against matched real-game captures at all relevant stages. Round to the nearest five points; keep scores unchanged until there is new evidence. A passing build confirms availability and regressions, not visual equivalence.

| Category | Estimated progress | Change since last report | Remaining evidence/work |
|---|---:|---:|---|
| Arena geometry and scenery | ██████████████████░░ 90% | +5% | Verified production restores two prominent twisted upper structures and 2,436 native faces connected to surviving platform. Exact full-scene fidelity remains unmeasured. |
| Lighting, textures and materials | ████████████████░░░░ 80% | +5% | Production verified native floor/curb, relief and attached alpha passes; new galaxy palette awaits deployment. |
| Ocellus model and animations | ████████████████░░░░ 80% | +5% | Production verifies native 16677 sequence timeline, measured pose bounds and death lifetime; matched reference timing/orientation remain. |
| Void effects and environmental hazards | ████████████████░░░░ 80% | +5% | Production black galaxy palette and sharper native stars reviewed at tick 51; precise UV and reference frame parity remain. |
| Attack graphics and special effects | █████████████████░░░ 85% | +5% | Production verified attached texture/alpha/depth groups, native transitions, marks and multi-channel graphics; matched effect frames remain. |
| Lifeforce fragments | ██████████████████░░ 90% | +0% | Native forming, mature loop, departure and recovery verified; matched game frames remain. |
| Void Rift visuals | ████████████████░░░░ 80% | +5% | Production verifies native kill, detonation, alpha groups and timing; exact game comparison remains. |
| Player visuals and equipment | ███████████████░░░░░ 75% | +5% | Production verifies native posed bow/scythe/blowpipe switches and source skinning; matched combat poses remain. |
| Camera and viewport | █████████████░░░░░░░ 65% | +5% | Production verifies player-follow, exact 50/128 near plane, measured 509px projection scale at 713px height, zoom gestures and DPR alignment. |
| RuneLite interface accuracy | ████████████████░░░░ 80% | +0% | Native overheads and pixel-aligned HUD; exact client layout remains. |
| Website interface | ████████████████░░░░ 80% | +0% | Sol-derived controls and metrics; further polish remains. |
| Rendering quality and smoothness | ██████████████████░░ 90% | +0% | Production confirms warmup roots 12, decoded textures 3, 32 draw calls at measured frame; device performance comparison remains. |
| Visual verification | ███████████████░░░░░ 75% | +15% | Successful full build, Pages deploy and retrieved actual Chromium captures; direct partial real-game screenshot comparison, not full matched footage. |

Overall progress remains an engineering estimate, not measured visual similarity; visual fidelity percentages are held pending matched whole-scene comparison. Revision dbdd163 deployed the first substantial upper scenery reconstruction.

## Walking clip comparison and outstanding work

The opening view uses the flood square and the rear brazier to orient the arena. In the supplied P4 Twisted Bow walking thumbnail, mapping the four corners of the inner five-tile square to the tile grid places the three visible holes within roughly 0.1 tile of (1,5), (1,7) and (1,9). This is a reconstruction of that encounter view. Other game layouts and seeds remain unverified.

| Area | Implemented in this pass | Still outstanding |
|---|---|---|
| Layout and cliff | Spaced the three hole models and matching damage tiles. The inset cliff backing now samples rock colour at its own depth. | Match the broken outer corners and underside at a second game-camera angle. |
| Camera | Estimated opening pitch of 52 degrees and bearing about 21 degrees off south. Player follow, manual orbit and cardinal snaps remain available. | Measure the projection and tile size at matched player positions on desktop and phone. |
| Lighting and scenery | Warm reflection on the native brazier curb, subtle flame halo and lift-dependent boss contact shadow. | Verify branch placement, flame height and rear wall silhouette in a reverse view. |
| Flood | Preserve star clusters across the texture-resolution levels used when zooming out. | Compare the moving inner and outer rims and their exact transition frames. |
| Boss, player and equipment | Kept the native animated models. | Compare the boss turn and landing, bow release, scythe swing and blowpipe weapon poses at matched ticks. |
| Combat effects and NPCs | Kept the native effect lifetimes. | Compare ranged, magic and melee impacts, fragment pickup and Void Rift detonation against close-up moving footage. |
| HUD, website and rendering | Portrait controls open over the arena. The opening phone view collapses the native prayer panel after the first three-stage capture showed it covering the player. Added live portrait captures during three fight stages. | Check iPhone Safari frame pacing, HUD overlap during inventory use and client pixel scale. |

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

- Present frame zero of native actor poses before their first client cycle, retaining active spawn/attack sequences and avoiding bind-pose flashes. Targeted regression tests preserve clock and generation guards.

- Boss/Rift health raster aligned with charge bar; stale cold instance submissions discarded. Targeted checks passed; production validation pending.

- Separate native floor sampling texture eliminates transparent-black mipmap edge contamination without changing any of the 344,064 original opaque texels, the 84-tile mesh, or the 2D mask. Browser pixel parity proof added; rendered quality pending.

- Instanced texture assignment now follows the actual index buffer. Native frame pools reuse static UV/RGB conversion, omit unused normal buffers and shrink submitted slot counts when actors leave a frame. Added native fixture checks and browser draw-count proof. Production verification pending.

- Stable native hitsplat reservation prevents new damage/healing indicators from overlapping existing ones. Four original positions and visible cap retained. Prior 2f718f2 Test workflow passed; new implementation requires full production browser verification.

- Confirmed 2f718f2 full production build, Chromium and Pages deployment; de9b6a6 CI passed. Prepared native effect pools now claim their first frame synchronously, with bundle isolation, failure retry and destroyed-actor guards. Added browser warm-claim proof. No score increase until the newly combined visual revision is tested.

- Correct responsive sidebar flex sizing, add decorative tracks for existing attempt counters, group existing recovery statistics and prevent narrow chat from covering the native HUD. Ratios distinguish zero attempts from zero success and are clamped. Browser/compact visual validation pending; no fidelity-score increase yet.

- Native transition core: verified all three actual deployed assets contain 888 already-dark untextured vertices per effect in three native shades. Removed the obsolete flat #020203 recolour. Added compiled colour distribution and browser vertex colour parity checks. No camera or gameplay changes. Full production validation pending.

- de9b6a6 deployed successfully: all seven exact-tick screenshots reviewed, native floor sampling and continuous fragment checks passed. Native overheads now use integer client projection and surviving heals retain position unless damage occupies it. Targeted regressions cover simultaneous healing, expiry, collision and canvas state. No camera change.

- Correct inherited model scale on attached-graphic placement: Ocellus 83/128 and Rift 96/128 were confirmed from actual deployed cache payloads. Existing world offsets and heights now survive scaling. Tests cover 12 rotation/scale combinations, plus a browser placement proof. Exact real-game comparison pending.

- Completed-attempt screen now reserves its header and reset footer, with the actual statistics independently scrollable. Added real result layout proof and screenshot, plus read-only player-follow camera metrics/capture after the normal-input dodge. No camera or mechanic changes. Latest visual changes await deployment; all scores unchanged.

- Correct native animation loop boundaries in client cycles, preserving subcycle blending and one-shot ending poses. 10,000 fragment loop boundaries plus 3,200 integral frame samples checked. Production validation pending; no camera or mechanic changes.

- Tightened native rock clipping to -0.00783, preserving original upper edge faces. Build proof and runtime validator enforce the same plane. Synthetic geometry tests passed; actual cache extraction/render pending.

- Confirmed cf58fa4 full production deployment and inspected nine screenshots, including seven exact-tick encounters, player-follow and scrollable result panel. The native foundation extraction emits 1,915 triangles at -0.00783. Player-follow proof is within one interpolated client step of the player. Native sound/pose cycle synchronisation added; exact sound boundary tests passed. No score increase until rendered reference evidence.

- Correct cache actor HUD origin from the logical tile to the actual rendered root. The previous origin was displaced vertically by 0.49 tiles. Native HP bars, overheads and hitsplats share the same origin; fallback projection, picking and camera are unchanged. Synthetic projection checks passed; new screenshots pending.

- Decoded actual native boss alpha: 4,645 opaque and 146 translucent triangles, three index runs. Split static untextured boss surfaces into opaque/depth-writing and translucent/non-depth-writing materials without changing the mesh or animation. Runtime and compiled payload proofs added; latest rendering pending. Camera untouched.

- Native shared player sequence audit identifies 11 alpha-transform groups and the original weapon vertices they can affect. Guaranteed-opaque untextured equipment now uses the opaque queue; potentially animated and static alpha retain the previous dynamic depth behavior. Exact per-item cache counts audited; browser proof added. Local Chromium navigation blocked by environment, so weapon switching is not claimed verified. All scores unchanged pending rendered comparison.

- Previous c9842bf and 8ffd86f browser artifacts confirm native boss 4,645 opaque/146 alpha triangles and player 2,984 opaque/416 alpha triangles. Default camera proof focus and target both (5.5,0.5). Preserve old visible actor height during equipment mesh replacement and retry failed cold draws without clearing newer generations. Added post-encounter SDK inventory switch checks and captures for scythe/blowpipe/bow. New browser proof pending; no gameplay or camera changes.

- Native effect/scenery cold allocation coalesces repeated requests and retains the latest render. Failed allocations retry after cooldown; destroy and warm takeover discard obsolete pending presentations. 100-request and failure-path checks passed. No change to geometry, timing, camera or visual fidelity score.

- d6e4224 full deployment passed, including all three SDK weapon switches: scythe 11,424 vertices, blowpipe 9,495, bow 10,200; opaque/alpha counts and pose mappings matched. Reviewed 12 production captures. New full-resolution native 2D surface preserves raised lips and partial curb at 64px/tile, with cooldown recovery for artwork requests. New production bake pending.

- Camera controls no longer rotate the scene while editing settings or using browser shortcuts; blur/tab hide and cancelled touches clear held state. Resize guards and context restoration diagnostics added. New Chromium DPR 1/2 alignment checks and screenshots follow all deterministic fight tests. No changes to default camera, zoom or targeting. Production pending.

- Production tick-17 screenshot verified flood background #1e2529; additive rim contains clipped pixels #ff9eff/#fa84ff. Use constant documented #9f48bd and opacity fade with unchanged geometry, avoiding additive overshoot. New live rim material proof and topology tests added; rendered comparison pending.

- Score updates are limited to equipment (+5) and verification (+5) based on successful d6e4224 Chromium proof. New full-resolution surface, control/resize and void-rim changes are not scored until the combined deployment is confirmed. Previous screenshots are not direct game-reference comparisons.

- 155c8a0 deployed successfully. Reviewed 14 captures; inner/outer rim vertices 240/684 with #9f48bd RGBA and normal blend; HUD and WebGL aligned at DPR1/2 (782×720 and 878×760 CSS backing). New attached effect alpha classification uses actual cache geometry for seven graphics, preserving indices and UVs. New production validation pending; extra material runs may increase GPU overhead.

- Camera gestures now clamp at the original zoom limits, normalise wheel units and preserve the remaining touch anchor across pinch/drag transitions. Native player-follow, start pitch and zoom unchanged. Targeted gesture tests passed; live zoom proof pending.

- Matched tick-17 captures show the corrected rim without the prior clipped purple highlights in the sampled central scene; this is a comparison of two trainer builds, not a direct OSRS frame comparison. The viewport retains player-follow and the original 2–20 orbit limits.


- Reconstructed recessed cliff backing now samples nearby shallow original native rock vertices (deduplicated, four nearest within bounded distance). The native rock maintains its original lip colours and fades into the existing #05070b abyss; the lower backing ends at that abyss colour. This remains a reconstruction, not proof of exact original cliff silhouette. Six targeted sampling/gradient checks passed.
- Added a native raised-surface mask at 64px/tile from the original highest sampled face above the .003-tile flood plane. The top-down renderer composites those original texels above the flood/rim and below entity markers; cleared floor remains unchanged. Build requires the new 896×832 mask and validates its coverage. Targeted extraction and compositing checks passed; actual cache bake pending.
- Ground floor and flood textures request 4x anisotropy. Confirmed the pinned Three.js r163 WebGLTextures source skips anisotropy with NearestFilter magnification, so both now use LinearFilter magnification; this trades slight close-up softness for potentially less grazing-angle shimmer. The browser proof checks the applied renderer property when supported, texture sizes, filters and colour space. No claim of measured visual improvement until Chromium capture review.
- Player-follow camera, encounter collision/timing and native NPC poses unchanged this batch. All new visual changes remain unverified in production. Scores unchanged pending rendered evidence.


- Extended the native curb extraction into all 84 playable cells for genuine original raised stone above the flat floor plane (-1/128 + .0001). The old 29 curb cells remain unchanged in footprint; generated relief triangle count is recorded and validated at load. This removes the mismatch between the new 2D raised-surface mask and the 3D omission of protruding native lips, without changing pathing or collision. Eleven geometry fixtures passed, actual cache extraction pending.
- Native instanced floor graphics 4309/4310/4311/4312/4339 and scenery 62440/62357/62739/62508 use separate stable opaque and potential-alpha index passes. A triangle is opaque only if all posed alpha values are zero and texture pixels prove opacity; variable-alpha materials no longer write depth, and player projectiles are excluded. Seventeen instancer fixtures passed; full actual pinned SDK patch chain applied. Browser probe checks material passes on the native outer fragment and scenery, and compares every relief pixel to the native upper image. The renderer change may alter transparency overlap and needs rendered comparison.
- Browser proof hooks tested with fixtures only; deployment and exact OSRS appearance remain unconfirmed. Camera and mechanics unchanged. Visual estimates held pending new captures.


- Rift native NPC 16678 uses a guarded dynamic opaque/translucent partition for untextured assets, based on the current posed opacity, preserving original triangle index ranges and updating group membership only when changed. Translucent Rift faces and verified attached boss effect passes no longer write depth; opaque passes retain depth writes. Textured/unknown Rift data preserves original behavior. Six actor alpha and seven attached texture fixtures passed.
- Cache 2746 verifies 14897 at 30 client cycles and 14898 at 60 cycles. Rift death now immediately starts its despawn on the kill-detection tick and uses one elapsed tick before removal rather than one idle tick plus one delayed pose. Detonation retains the existing three-count (two elapsed ticks). Boss and Rift terminal native sequences hold their final non-looping pose until NPC removal; no return to alive idle in the final fraction. Eight actor presentation fixtures passed.
- Fixed the stale Chromium placement fixture: the new channel-aware renderer requires spotAnimPlacements and a channel on each effect, not activeSpotAnims alone. The corrected fixture passed with the exact original placement math. This is a potential CI blocker corrected, not confirmation of a completed deployment.
- Chromium proof now records actual boss posed vertex height bounds/scale, native Rift opacity groups, same-tick kill animation, and attached transition depth passes. Fixture checks passed, actual cache-render browser run not available. All changes in colosseum, no boss-follow camera or combat-rule changes; defeated Rift removal timing is the sole visual-lifetime change.
- Live revision and push workflow state could not be retrieved from this environment (direct DNS unavailable, connector workflow listing restricted to PR-triggered runs). Retain prior 76% visual estimate until fresh production capture comparison; do not represent source checks as measured visual parity.

## 24 November — verified production and scenery refinement

- Revision b15877a: unified build and Pages deployment successful (run 45477258743, artifacts 14959717950 and 14960162568). Actual Chromium captures reviewed, including cleared floor and outer void. Runtime geometry: 6,323 native foundation triangles (9,963 submitted vertices deeper than -1.69), 1,488 curb triangles (230 raised-floor faces), 252 original flat-floor triangles, 168 fallback tiles and 800 backing triangles. 84/84 playable tiles have full native surface coverage, zero repaired flat-floor texels. All actual browser checks passed.
- Real-game reference close-ups: https://www.osrsguide.com/wp-content/uploads/2026/10/void-bombs.webp and https://www.osrsguide.com/wp-content/uploads/2026/10/ranged-atk.webp . Compared visually to the production captures: native floor/checkerboard and curb recognisably correspond; the deployed slate-grey galaxy background and low-contrast stars do not. Original texture 215 has 16,192 of 16,384 pixels at RGB (0,0,1); only the separate flood derived texture changed. New palette #030308 / #f6f5ff and sharper sampling are approximate display-space calibration, not an exact screenshot colour measurement. New palette and tapered fallback wall pending production build. Local Chromium navigation blocked by environment; no local rendered preview claimed.
- Synthetic backing now recedes from .20 to .45 tiles and fades faster than original rock to avoid conspicuous rectangular slabs. Native rock geometry is unchanged in this batch; profile fixture passed. No movement, boss camera target or combat changes.

- Production revision bad23e0 (workflow 45480058341) passed build and Pages deployment. Downloaded actual captures: outer void tick 51 shows black galaxy surface with bright native stars; previous slate-grey surface is superseded. Tapered backing revision 6d4ce7c not yet confirmed deployed.
- Map evidence: objects 4451/7261 and 50843–50847 correspond to invisible collision markers; model preview audit found no visible geometry. Do not fabricate visible walls. Added native raised curb overhang extraction within .18 tile of original exterior curb, excluding ambiguous cells and floor-level faces; all 14 terrain fixtures passed. Actual recovered overhang count awaits native cache build.
- Deployed native flat floor analysis: all 252 triangle normals point upward; sum of projected double-area is exactly 168, i.e. 84 tiles. Native foundation, curb and original flat-floor now use FrontSide (source winding), with reconstructed fallback surfaces unchanged; smoke checks actual material side and floor area. Eight viewport fixtures passed. Face culling and extended curb source revision a05c9bb not production verified. No mechanical, camera tracking or collision change.

## 24 November — restored upper scenery and composition
- Production revision dbdd163, run 45488210009, passed unified build/browser/Pages. Actual browser screenshots reviewed: the two large twisted structures previously clipped off the arena now appear. Original curb 2,740 faces plus 2,436 upper faces; 5,176 total. 64 connected upper components, 40 discarded, maximum height 6.734375 tiles. The clipping/root-selection is still reconstructed; not verified against the precise live object state. No gameplay or collision changes.
- Updated portrait focal offset from 8% to 2% of height and horizontal projection scale from 1.02 to .78 of CSS width. This is a usability decision for narrow phones, not a claimed exact client projection. Desktop and fixed layout remain 70-degree FOV. Six camera fixtures passed; full browser verification pending.
- New purple halo uses continuous mitered inner/outside/vertical opacity bands, .18 tile inner and .12 outer reach; #b660dc is a visual estimate from reference images, not an exact sampled value. Hazard topology unchanged. Targeted geometry fixture passed; full browser tests pending. 2D gradient assertions updated.

## 25 November — shadow projection and animation continuity
- Padded the shared baked scenery shadow map by two tiles on every edge, with matching caster/receiver projection constants. This targets stretched edge texels on exterior curb geometry; exact rendered improvement awaits browser review.
- Align Ocellus contact shadow with native two-tick rise and one-tick landing; use absolute fight tick for brazier flicker; prioritise and fade the explosion reflection during its impact tick. No combat, camera, collision or source geometry changes.
- Added focused regression cases for the projection, shadow timing and reflection. Visual progress estimates held until rendered verification.

## 25 November — mobile screenshot calibration
- User mobile screenshot shows washed-out stone, strong tree silhouettes, uniform bright flood stars and insufficient skull-wall relief. Reduced global stone/cliff exposure, applied luminance-preserving saturation correction to stone, added bounded native face-normal modulation and darker recessed backing. Increased near backdrop exposure while retaining distant fade. These are presentation estimates, not sampled game-reference calibration.
- Lowered and softened shadow-mask passes, faded receiver at map bounds, narrowed and softened cliff shelf tint; preserved native mesh positions, collision and UV mapping. Reduced intermediate flood intensities and mip peak amplification; original cache texture and brightest stars retained.
- Added regression assertions for grading, face orientation, backdrop distance/depth, mip response and intermediate star intensity. No camera, mechanics, or Sol changes. Hold visual scores until actual deployed screenshot comparison.
