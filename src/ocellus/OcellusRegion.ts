import * as THREE from "three";
import {
  Region, Player, Mob, Entity, Unit, Model, Settings, MeleeWeapon,
  CacheRenderModel, CacheRenderReferences, InvisibleMovementBlocker, RangedWeapon,
  CollisionType, LineOfSightMask, CardinalDirection, Projectile, Sound, SoundCache, cacheSound, GROUND_OVERLAY_Y,
} from "osrs-sdk";
import type { Loadout, UnitBonuses, IncomingAttackRoll, IncomingAttackRollModifiers } from "osrs-sdk";
import {
  BOARD_WIDTH, BOARD_HEIGHT, FLOOR_TILES, BOSS_ANCHOR, PLAYER_SPAWN,
  inPlatform, inBossFootprint, bossFootprintBlocks, HOLE_TILES, MAX_HP, STARTING_HP, stageAt, bossOverheadSprite, bossVisibleAt, specialStyle,
} from "./Phase4Rules";
import type { Tile, PhaseFrame } from "./Phase4Rules";
import { Phase4Simulation, emptyFightStats } from "./Phase4Simulation";
import { attemptSeed } from "./OcellusAttempt";
import { OCELLUS_ASSETS } from "./Assets";
import { installOcellusDeflection } from "./OcellusDeflection";
import { installOcellusStatGuard, OCELLUS_DEMONBANE_EFFECTIVENESS } from "./OcellusStatGuard";
import { installOcellusExplosionReduction } from "./OcellusExplosionCombat";
import { scriptedHealthProjectile, installOcellusLifeforceRecovery } from "./OcellusHealthHits";
import { OcellusArena, OcellusNativeFixture, OcellusFloorHole } from "./OcellusArena";
import { OCELLUS_CENSER_FIXTURES } from "./OcellusNativeScenery";
import { loadArenaImage, createArtworkReader } from "./OcellusArenaAssets";
import { drawNativeMinimap, minimapNpcCenter, minimapPlayerPosition } from "./OcellusMinimap";
import { reserveHealSlots } from "./OcellusHitsplatSlots";
import type { HitsplatSlot } from "./OcellusHitsplatSlots";
import { OcellusSpotEffect } from "./OcellusSpotEffects";
import { floorLayersAt, drawOcellusFloorMarkers, drawOcellusGround } from "./OcellusStone";
import { drawNativeOverheadIcon, drawRiftChargeBar, drawNativeNpcHealth } from "./OcellusNpcHud";
import { specialTellSpotId } from "./OcellusVisualCues";
import { presentationAt, OCELLUS_DEATH_TICKS, OCELLUS_VICTORY_COUNTDOWN, OCELLUS_DEATH_EFFECTS, RIFT_CHARGE_TICKS, RIFT_DESPAWN_TICKS, RIFT_DETONATE_COUNTDOWN, riftBurstVisual, areaCueVolume } from "./OcellusPresentation";
import type { Effect, FightStats, FrameResult, GamePrayer, Orb, Mark } from "./Phase4Simulation";
import { appendOcellusGameMessage } from "./OcellusGameMessages";
import type { OcellusGameMessage } from "./OcellusGameMessages";

type Result = "won" | "lost" | null;
export type OcellusView = Readonly<{
  frame: PhaseFrame;
  result: Result;
  bossHp: number;
  playerHp: number;
  marks: readonly Mark[];
  /** Render-only record on the explosion impact tick, even if its mark
   * was never drawn due to a skipped browser frame. */
  impactMark?: Mark | null;
  orbs: readonly Orb[];
  departingOrbs?: readonly Orb[];
  rifts: number;
  stats: Readonly<FightStats>;
  tell: string | null;
  lastCause: string | null;
  chat: readonly OcellusGameMessage[];
}>;

const emptyStats = emptyFightStats;
const tilesEqual = (a: Tile, b: Tile) => a.x === b.x && a.y === b.y;
// One shared decoded image for all 84 tile entities in the 2D viewport.
// Both rendering modes use the identical cache-derived surface artwork.
const nativeFloorArtwork=createArtworkReader(()=>loadArenaImage("ocellus-native-floor.png"));
const nativeFloodArtwork=createArtworkReader(()=>loadArenaImage("ocellus-flood.png"));
const nativeMinimapArtwork=createArtworkReader(()=>loadArenaImage("ocellus-native-minimap.png"));
const nativeUpperArtwork=createArtworkReader(()=>loadArenaImage("ocellus-native-upper.png"));
const nativeReliefArtwork=createArtworkReader(()=>loadArenaImage("ocellus-native-relief.png"));

/** Each tile remains an SDK entity for 2D gameplay, pathing and clicks.
 * The stone's 3D geometry is now rendered once by OcellusArena, so these
 * 84 entities must not allocate 84 additional overlapping plane meshes.
 */
class FloorTileModel implements Model {
  constructor(private readonly tile: Tile) {}
  draw(_scene: THREE.Scene): void { /* Stone is rendered by OcellusArena. */ }
  destroy(_scene: THREE.Scene): void { /* No per-tile 3D resources. */ }
  getWorldPosition(): THREE.Vector3 {
    return new THREE.Vector3(this.tile.x + 0.5, GROUND_OVERLAY_Y - 1 / 128, this.tile.y - 0.5);
  }
  async preload(): Promise<void> {}
}

class FloorTile extends Entity {
  // Collision and 2D artwork remain intact; the arena supplies the 3D mesh.
  readonly omitFromOcellus3d = true;
  constructor(region: OcellusRegion, location: Tile) { super(region, location); }
  override get collisionType() {
    return inBossFootprint(this.location) && (this.region as OcellusRegion).blocksBossTile(this.location)
      ? CollisionType.BLOCK_MOVEMENT : CollisionType.NONE;
  }
  override get lineOfSight() { return LineOfSightMask.NONE; }
  override get drawOutline() { return false; }
  override get color() { return "#4d5849"; }
  override create3dModel() { return new FloorTileModel(this.location); }
  override draw(_tickPercent: number, ctx: OffscreenCanvasRenderingContext2D, _offset = {x: 0,y: 0}, scale = 1) {
    const state=(this.region as OcellusRegion).getSnapshot();
    const marks=state.impactMark&&state.frame.events.some(e=>e.kind==="explosion-hit")?[...state.marks,state.impactMark]:state.marks;
    const visual=floorLayersAt(this.location,state.frame,marks,state.orbs);
    drawOcellusFloorMarkers(ctx,this.location,scale,visual);
  }
}

/** Retain SDK movement and sight blocking but never create a visual actor. */
class OcellusMovementBlocker extends InvisibleMovementBlocker {
  readonly omitFromOcellus3d = true;
}

/** Sprite frames are generated from the pinned cache during the Ocellus build. */
const OCELLUS_OVERHEAD_IMAGES = new Map<number, HTMLImageElement>();
function overheadImage(frame: number): HTMLImageElement {
  const cached = OCELLUS_OVERHEAD_IMAGES.get(frame);
  if (cached) return cached;
  const image = new Image();
  image.src = new URL(`osrs-assets/sprites/440-${frame}.png`, document.baseURI).href;
  OCELLUS_OVERHEAD_IMAGES.set(frame, image);
  return image;
}
/** Begin loading all three game-cache prayer icons immediately at trainer start. */
export function primeOcellusPrayerIcons(): void {
  for (const frame of [11, 15, 16]) overheadImage(frame);
}

/** Independent Ocellus NPC. SolHeredit and its attack scripts are never used. */
export class OcellusBoss extends Mob {
  private healVisuals: { amount: number; until: number; slot?: HitsplatSlot }[] = [];

  /** The native client uses green healsplats on Ocellus, just as on players. */
  addHealVisual(amount: number, tick: number) {
    if (!Number.isInteger(amount) || amount <= 0) return;
    this.healVisuals = [
      ...this.healVisuals.filter((entry) => entry.until >= tick),
      { amount, until: tick + 1 },
    ].slice(-3);
  }

  override drawHitsplats(context: OffscreenCanvasRenderingContext2D, scale: number, verticalOffset = 0) {
    super.drawHitsplats(context, scale, verticalOffset);
    const tick = (this.region as OcellusRegion).getSnapshot().frame.tick;
    const occupied:HitsplatSlot[]=this.incomingProjectiles
      .filter(p=>p.remainingDelay<=0).slice(0,4)
      .filter(p=>Number.isFinite(p.offsetX)&&Number.isFinite(p.offsetY))
      .map(p=>[p.offsetX,p.offsetY]);
    this.healVisuals = this.healVisuals.filter((entry) => entry.until >= tick);
    const offsets=reserveHealSlots(this.healVisuals.map(entry=>entry.slot),occupied);
    if(!this.healHitsplatImage.complete||this.healHitsplatImage.naturalWidth===0)return;
    const previous={font:context.font,textAlign:context.textAlign,fillStyle:context.fillStyle};
    for (const [index,visual] of this.healVisuals.entries()) {
      visual.slot=offsets[index];
      if(!visual.slot)continue;
      const [x,y]=visual.slot;
      const text = String(visual.amount);
      context.drawImage(this.healHitsplatImage, x - 11, verticalOffset - y - 1, 24, 23);
      context.font = "16px Stats_11";
      context.textAlign = "center";
      context.fillStyle = "#000000";
      context.fillText(text, x + 1, verticalOffset - y + 15 + 1);
      context.fillStyle = "#FFFFFF";
      context.fillText(text, x, verticalOffset - y + 15);
    }
    context.font=previous.font;
    context.textAlign=previous.textAlign;
    context.fillStyle=previous.fillStyle;
  }

  mobName() { return "Ocellus"; }
  get demonbaneMultiplier() { return OCELLUS_DEMONBANE_EFFECTIVENESS; }
  get combatLevel() { return 1601; }
  get size() { return 3; }
  override get consumesSpace() { return false; }
  get healthScale() { return MAX_HP; }
  override get healthBarWidth() { return 90; }
  override drawHPBar(context:OffscreenCanvasRenderingContext2D,scale:number,verticalOffset=-(this.size/2)*scale) {
    drawNativeNpcHealth(context,this.healthBarWidth,verticalOffset,this.currentStats.hitpoint,this.stats.hitpoint,this.healthScale);
  }
  override visible() {
    return super.visible()
      && bossVisibleAt((this.region as OcellusRegion).getSnapshot().frame);
  }
  override canBeAttacked() {
    return this.dying === -1
      && bossVisibleAt((this.region as OcellusRegion).getSnapshot().frame);
  }
  override get idlePoseId() {
    const stage = (this.region as OcellusRegion).getSnapshot().frame.stage;
    return stage === "inner-void"
      ? OCELLUS_ASSETS.npcs.ocellus.animations.deflectLoop
      : OCELLUS_ASSETS.npcs.ocellus.animations.idle;
  }
  override async preload() {
    // Decode all three original prayer icons before combat starts. The
    // Deflect Melee frame begins immediately at inner-void onset.
    await Promise.all([
      super.preload(),
      ...[11, 15, 16].map((frame) => overheadImage(frame).decode()),
    ]);
  }
  override drawOverheadPrayers(context: OffscreenCanvasRenderingContext2D, scale: number) {
    // Do not leave a live combat curse suspended over the death sequence.
    if(this.dying!==-1||this.currentStats.hitpoint<=0)return;
    const frame = (this.region as OcellusRegion).getSnapshot().frame;
    const spriteFrame = bossOverheadSprite(frame);
    if (spriteFrame === null) return;
    const icon = overheadImage(spriteFrame);
    drawNativeOverheadIcon(context,icon);
  }
  override get walkingPoseId() { return OCELLUS_ASSETS.npcs.ocellus.animations.walk; }
  override get attackAnimationId() { return null; }
  // The SDK ordinarily delays death poses by a world tick. Ocellus's 14872
  // is logged on the kill tick, so onUnitDeath plays it immediately instead.
  override get deathAnimationId(): number | null { return null; }
  override get deathAnimationLength() { return OCELLUS_DEATH_TICKS; }
  get attackSpeed() { return 0; }
  get attackRange() { return 0; }
  get maxHit() { return 0; }
  attackStyleForNewAttack() { return "stab" as const; }
  canMeleeIfClose() { return null; }
  override canMove() { return false; }
  override movementStep() {}
  override attackIfPossible() {}
  // Keep the SDK's NPC death detection, removal countdown and visual pose.
  // Only attackIfPossible is disabled; boss/rifts never auto-attack.
  override attackStep() { super.attackStep(); }
  override create3dModel() {
    return CacheRenderModel.forRenderable(this, CacheRenderReferences.npc(16677));
  }
  override setStats() {
    this.stats = { attack: 325, strength: 250, defence: 250, range: 300, magic: 300, hitpoint: MAX_HP };
    this.currentStats = { ...this.stats, hitpoint: STARTING_HP };
    this.weapons = { stab: new MeleeWeapon() };
    this.attackStyle = "stab";
    this.attackDelay = 0;
  }
  override get bonuses(): UnitBonuses {
    return {
      attack: { stab: 0, slash: 0, crush: 0, magic: 0, range: 0 },
      defence: { stab: 150, slash: 100, crush: 30, magic: 200, range: 250 },
      other: { meleeStrength: 0, rangedStrength: 0, magicDamage: 0, prayer: 0 },
    };
  }
  override addProjectile(projectile: Projectile) {
    // World.tickRegion runs the boss turn before the player's attack turn,
    // so the published frame is the launch-time frame for player attacks.
    // Do not apply boss prayers to non-player or environmental projectiles.
    if (projectile.from instanceof Player) {
      const deflected = installOcellusDeflection(
        projectile, (this.region as OcellusRegion).getSnapshot().frame,
      );
      // Deflects use the prayer at LAUNCH; the explosion reduction uses
      // the combat stage at IMPACT, which may be several ticks later.
      installOcellusExplosionReduction(
        projectile, () => (this.region as OcellusRegion).bossLandingFrame(),
      );
      installOcellusStatGuard(projectile,()=>this.currentStats,()=>this.stats,deflected);
    }
    super.addProjectile(projectile);
  }
  override queueStep() {
    // Incoming projectiles land before this NPC publishes the encounter's
    // next tick. Use that upcoming frame ONLY during the real incoming queue.
    (this.region as OcellusRegion).withBossLandingFrame(()=>super.queueStep());
    if (this.dying === 0 || this.currentStats.hitpoint <= 0 || this.age > 0) return;
    (this.region as OcellusRegion).runEncounterTick();
  }
}

export class OcellusRift extends Mob {
  constructor(region: Region, at: Tile, readonly riftId: number, readonly spawnedAt: number) {
    super(region, at);
  }
  mobName() { return "Void Rift"; }
  get combatLevel() { return 138; }
  override get consumesSpace() { return false; }
  get size() { return 1; }
  override get idlePoseId() { return OCELLUS_ASSETS.npcs.voidRift.animations.idle; }
  override get walkingPoseId() { return OCELLUS_ASSETS.npcs.voidRift.animations.idle; }
  // Match the boss: start the native despawn at death detection, not a
  // delayed action that leaves a defeated Rift in its idle animation.
  override get deathAnimationId(): number|null { return null; }
  override get attackAnimationId() { return null; }
  /** RuneScape Void Rifts take guaranteed max hits from ordinary melee
   * and ranged attacks. Specials and magic keep the SDK's normal rolls. */
  override incomingAttackRollModifiers(attack: IncomingAttackRoll): IncomingAttackRollModifiers {
    const standardMeleeOrRange =
      attack.weapon instanceof MeleeWeapon || attack.weapon instanceof RangedWeapon;
    if (standardMeleeOrRange && attack.bonuses.isSpecialAttack !== true) {
      return { guaranteedHit: true, maxDamage: true };
    }
    return super.incomingAttackRollModifiers(attack);
  }
  override canBeAttacked() { return this.dying === -1; }
  override drawHPBar(
    context: OffscreenCanvasRenderingContext2D,
    scale: number,
    verticalOffset = -(this.size / 2) * scale,
  ) {
    drawNativeNpcHealth(context,this.healthBarWidth,verticalOffset,this.currentStats.hitpoint,this.stats.hitpoint,this.healthScale);
    // Game rift charge bar: dark olive backing, yellow charge below green HP.
    const width = this.healthBarWidth;
    const elapsed = (this.region as OcellusRegion).getSnapshot().frame.tick - this.spawnedAt;
    if(this.dying===-1&&this.currentStats.hitpoint>0)
      drawRiftChargeBar(context,width,verticalOffset,elapsed,RIFT_CHARGE_TICKS);
  }
  override get deathAnimationLength() { return RIFT_DESPAWN_TICKS; }
  get attackSpeed() { return 0; }
  get attackRange() { return 0; }
  get maxHit() { return 0; }
  attackStyleForNewAttack() { return "stab" as const; }
  override canMove() { return false; }
  override movementStep() {}
  override attackIfPossible() {}
  // Keep the SDK's NPC death detection, removal countdown and visual pose.
  // Only attackIfPossible is disabled; boss/rifts never auto-attack.
  override attackStep() { super.attackStep(); }
  override create3dModel() { return CacheRenderModel.forRenderable(this, CacheRenderReferences.npc(16678)); }
  override setStats() {
    this.stats = { attack: 1, strength: 1, defence: 175, range: 1, magic: 300, hitpoint: 44 };
    this.currentStats = { ...this.stats };
    this.weapons = { stab: new MeleeWeapon() };
    this.attackStyle = "stab";
  }
  override get bonuses(): UnitBonuses {
    return {
      attack: { stab: 0, slash: 0, crush: 0, magic: 0, range: 0 },
      defence: { stab: 0, slash: 0, crush: 0, magic: 0, range: 0 },
      other: { meleeStrength: 0, rangedStrength: 0, magicDamage: 0, prayer: 0 },
    };
  }
}

/**
 * The recorded final phase makes Ocellus unreachable by melee while he
 * levitates over the inner void (ticks 8–29 each cycle). The attack target
 * stays selected so an adjacent melee player automatically resumes on the
 * landing tick; ranged and magic attacks are unaffected. This is isolated
 * to the Ocellus player rather than changing the shared SDK or Sol.
 */
export class OcellusPlayer extends Player {
  override movementStep(): void {
    // The pinned Ocellus SDK resolves movement before the NPC turn. Sample
    // the upcoming stage here, but leave click-time queries on the live stage.
    (this.region as OcellusRegion).withMovementFrame(()=>super.movementStep());
  }
  override attackIfPossible(): void {
    if (this.aggro instanceof OcellusBoss
      && this.attackRange <= 1
      && (this.region as OcellusRegion).getSnapshot().frame.stage === "inner-void") {
      return;
    }
    super.attackIfPossible();
  }
}

export class OcellusRegion extends Region {
  readonly ocellusMovementBeforeHazards = true;
  private sim = new Phase4Simulation(42);
  private movementFrame:PhaseFrame|null = null;
  private landingFrame:PhaseFrame|null = null;

  bossLandingFrame():PhaseFrame {
    return this.landingFrame??this.view.frame;
  }
  withBossLandingFrame(resolve:()=>void):void {
    const previous=this.landingFrame;
    this.landingFrame=this.view.result?this.view.frame:this.sim.upcoming();
    try { resolve(); } finally { this.landingFrame=previous; }
  }

  withMovementFrame(move:()=>void):void {
    const previous=this.movementFrame;
    this.movementFrame=this.world?.getReadyTimer===0&&!this.view.result?this.sim.upcoming():null;
    try { move(); } finally { this.movementFrame=previous; }
  }
  blocksBossTile(tile:Tile):boolean {
    if(!this.player||!this.boss)return false;
    return bossFootprintBlocks((this.movementFrame??this.view.frame).stage,tile,this.player.location,
      this.boss.dying===-1&&this.boss.currentStats.hitpoint>0&&!this.view.result);
  }
  private readonly listeners = new Set<() => void>();
  private player: Player | null = null;
  private boss: OcellusBoss | null = null;
  private riftMobs = new Map<number, OcellusRift>();
  private view: OcellusView = Object.freeze({
    frame: stageAt(0), result: null, bossHp: STARTING_HP, playerHp: 99,
    marks: [], orbs: [], rifts: 0, stats: emptyStats(), tell: null, lastCause: null, chat: [],
  });
  private lastCause: string | null = null;
  private chat: readonly OcellusGameMessage[] = [];
  private victoryTicksLeft: number | null = null;


  drawOcellusMinimap(ctx:OffscreenCanvasRenderingContext2D,rotation=0,interpolate=false):void {
    if(!this.player)return;
    const artwork=nativeMinimapArtwork()??nativeUpperArtwork();
    const npcs:Tile[]=[];
    if(this.boss&&this.boss.dying===-1&&this.boss.currentStats.hitpoint>0&&bossVisibleAt(this.view.frame))
      npcs.push(minimapNpcCenter(this.boss.location,this.boss.size));
    for(const rift of this.riftMobs.values())if(rift.dying===-1&&rift.currentStats.hitpoint>0)npcs.push(minimapNpcCenter(rift.location,rift.size));
    const player=minimapPlayerPosition(this.player.location,interpolate?this.player.getPerceivedLocation(0):undefined);
    drawNativeMinimap(ctx,artwork,player,npcs,BOARD_WIDTH,BOARD_HEIGHT,rotation);
  }

  constructor(loadouts: Loadout[], private readonly fixedSeed?: number) { super(loadouts); }
  readonly subscribe = (callback: () => void) => { this.listeners.add(callback); return () => { this.listeners.delete(callback); }; };
  readonly getSnapshot = () => this.view;
  private notify(next: OcellusView) {
    this.view = Object.freeze(next);
    for (const callback of Array.from(this.listeners)) callback();
  }

  override getName() { return "The Fractured Archive – Ocellus"; }
  override get initialFacing() { return CardinalDirection.SOUTH; }
  override get width() { return BOARD_WIDTH; }
  override get height() { return BOARD_HEIGHT; }
  override rightClickActions() { return []; }
  override drawDefaultFloor() { return !Settings.use3dView; }
  override drawWorldBackground(ctx: OffscreenCanvasRenderingContext2D, scale: number) {
    drawOcellusGround(ctx,scale,this.view.frame.stage,nativeUpperArtwork(),nativeMinimapArtwork(),
      nativeFloorArtwork(),nativeFloodArtwork(),nativeReliefArtwork());
  }

  override initialiseRegion() {
    this.sim = new Phase4Simulation(attemptSeed(this.fixedSeed));
    this.movementFrame=null;
    this.landingFrame=null;
    // Start immutable artwork loads early. Draws retry failures with a cooldown.
    nativeMinimapArtwork();nativeFloodArtwork();nativeUpperArtwork();nativeFloorArtwork();nativeReliefArtwork();
    this.riftMobs.clear();
    this.chat = [];
    this.lastCause = null;
    this.victoryTicksLeft = null;
    const player = new OcellusPlayer(this, PLAYER_SPAWN);
    installOcellusLifeforceRecovery(player);
    this.player = player;
    this.addPlayer(player);
    player.freeze(this.world.getReadyTimer + 1);

    for (let y = 0; y < BOARD_HEIGHT; y++) for (let x = 0; x < BOARD_WIDTH; x++) {
      const at = { x, y };
      if (inPlatform(at)) this.addEntity(new FloorTile(this, at));
      else this.addEntity(new OcellusMovementBlocker(this, at));
    }
    // Overlay scenery never changes collision/pathing or boss mechanics.
    this.addEntity(new OcellusArena(this, () => this.getSnapshot(),()=>player.getPerceivedLocation(0)));
    this.addEntity(new OcellusSpotEffect(this, "inner-orb", () => this.getSnapshot()));
    this.addEntity(new OcellusSpotEffect(this, "outer-orb", () => this.getSnapshot()));
    this.addEntity(new OcellusSpotEffect(this, "explosion", () => this.getSnapshot()));
    // The recovered native map places both fixtures at the censer tile.
    for (const fixture of OCELLUS_CENSER_FIXTURES) this.addEntity(new OcellusNativeFixture(this, fixture));
    for (const at of HOLE_TILES) this.addEntity(new OcellusFloorHole(this, at, () => this.getSnapshot().frame.stage));
    const boss = new OcellusBoss(this, BOSS_ANCHOR, { aggro: player });
    // Unit's constructor resets currentStats.hitpoint to the max after
    // setStats(). P4 begins at roughly one quarter of the full fight pool.
    boss.currentStats.hitpoint = STARTING_HP;
    this.boss = boss;
    this.addMob(boss);
    this.setBoss(boss);
    this.notify({
      frame: stageAt(0), result: null, bossHp: boss.currentStats.hitpoint,
      playerHp: player.currentStats.hitpoint, marks: [], orbs: [],
      rifts: 0, stats: emptyStats(), tell: null, lastCause: null, chat: [],
    });
    return { player };
  }

  override reset(startWorld = true) {
    const result = super.reset(startWorld);
    result.player.stats.prayer = 99;
    result.player.currentStats.prayer = 99;
    result.player.stats.hitpoint = 99;
    result.player.currentStats.hitpoint = 99;
    this.updateView();
    return result;
  }

  private activePrayer(): GamePrayer {
    const ctrl = this.player?.prayerController;
    if (!ctrl) return null;
    if (ctrl.isPrayerActiveByName("Protect from Melee")) return "melee";
    if (ctrl.isPrayerActiveByName("Protect from Range")) return "range";
    if (ctrl.isPrayerActiveByName("Protect from Magic")) return "magic";
    return null;
  }

  runEncounterTick() {
    if (!this.player || !this.boss || this.view.result !== null) return;
    const frame = this.sim.step(this.player.location, this.player.currentStats.hitpoint, this.activePrayer());
    for (const e of frame.effects) this.applyEffect(e);
    const burst = riftBurstVisual(frame.effects);
    if (burst !== null) {
      this.player.addSpotAnim({ id: burst, channel: "ocellus-rift-burst" });
    }
    const presentation = presentationAt(frame.frame, this.sim.seed);
    if (presentation.bossAnimation !== null) this.boss.playAnimation(presentation.bossAnimation);
    for (const id of presentation.bossSpotAnims) {
      this.boss.addSpotAnim({ id, channel: `ocellus-boss-effect-${id}` });
    }
    for (const id of presentation.playerSpotAnims) {
      this.player.addSpotAnim({ id, channel: `ocellus-player-effect-${id}` });
    }
    if (frame.frame.events.some((event) => event.kind === "special-tell")) {
      const nth = frame.frame.offset === 24 ? 0 : 1;
      const style = specialStyle(this.sim.seed, frame.frame.cycle, nth);
      // Native texture 215 is now rendered. The original untextured core
      // already contains three dark shades; no synthetic recolour is needed.
      this.boss.addSpotAnim({
        id: specialTellSpotId(style), channel: "ocellus-transition-tell",
      });
    }
    for (const sound of presentation.sounds) this.playAreaSound(sound.id, sound.delayMs, areaCueVolume(sound.id));
    if (frame.frame.tick === 5) this.boss.setOverheadText("End...");
    if (frame.frame.tick === 8 && this.boss.overheadText === "End...") {
      this.boss.overheadText = null;
      this.boss.overheadTextTimer = 0;
    }
    // frame.tell is a training prompt in the sidebar, NOT native boss speech.
    // Keep only the recorded "End..." line as NPC overhead text.
    this.updateView(frame);
    if (this.player.currentStats.hitpoint <= 0) this.player.detectDeath();
  }

  private playAreaSound(id: number, delayMs = 0, volume = 0.1) {
    if (!this.player) return;
    SoundCache.play(new Sound(cacheSound(id), volume, delayMs, {
      location: this.player.location, range: 31, retain: 31,
    }));
  }

  private addChat(text: string): void {
    this.chat = appendOcellusGameMessage(this.chat, this.sim.current().tick, text);
  }

  private applyEffect(effect: Effect) {
    if (!this.player || !this.boss) return;
    switch (effect.kind) {
      case "message":
        this.addChat(effect.text);
        break;
      case "attack-haste":
        this.player.attackDelay = Math.max(0, this.player.attackDelay - effect.ticks);
        break;
      case "damage":
        // World.tickRegion resolves NPC actions before the player hit queue.
        // This lands in the *same* world tick, preserving the simulator's
        // damage timing while drawing real OSRS damage hitsplats and hit sounds.
        this.player.addProjectile(scriptedHealthProjectile(
          this.boss, this.player, effect.amount,
        ));
        this.lastCause = effect.reason;
        break;
      case "heal":
        // A native green hitsplat returns the full lifeforce amount.
        // Only that recovery bypasses the ordinary SDK healing cap.
        this.player.addProjectile(scriptedHealthProjectile(
          this.boss, this.player, -effect.amount, effect.reason === "Lifeforce returned",
        ));
        if (effect.reason === "Lifeforce returned") {
          this.player.addSpotAnim({ id: 4314, channel: "ocellus-lifeforce-return" });
        }
        break;
      case "boss-heal": {
        const before = this.boss.currentStats.hitpoint;
        const after = Math.min(MAX_HP, before + effect.amount);
        this.boss.currentStats.hitpoint = after;
        // Match the game's 1-tick green heal splats for Soul Split and
        // expired lifeforce, rather than silently changing the HP bar.
        this.boss.addHealVisual(after - before, this.sim.current().tick);
        break;
      }
      case "rift-spawn": {
        const rift = new OcellusRift(this, effect.tile, effect.id, this.sim.current().tick);
        this.riftMobs.set(effect.id, rift);
        this.addMob(rift);
        rift.playAnimation(OCELLUS_ASSETS.npcs.voidRift.animations.spawn);
        break;
      }
      case "rift-detonate": {
        const rift = this.riftMobs.get(effect.id);
        if (rift) {
          this.riftMobs.delete(effect.id);
          // Detonate animation is two ticks: don't remove the NPC before it renders.
          rift.playAnimation(OCELLUS_ASSETS.npcs.voidRift.animations.detonate);
          // attackStep decrements this on the burst tick; three countdown
          // steps leave the original two-tick detonation visible.
          rift.dying = RIFT_DETONATE_COUNTDOWN;
        }
        break;
      }
      default:
        break;
    }
  }

  private updateView(result?: FrameResult) {
    const current = this.sim.current();
    const state = result ?? {
      frame: current, ...this.sim.snapshot(),
      tell: this.view.frame.tick === current.tick ? this.view.tell : null,
    };
    this.notify({
      frame: state.frame, result: this.view.result,
      bossHp: this.boss?.currentStats.hitpoint ?? 0, playerHp: this.player?.currentStats.hitpoint ?? 0,
      marks: state.marks,
      impactMark: state.impactMark,
      orbs: state.orbs, departingOrbs:state.departingOrbs, rifts: state.rifts.length,
      stats: state.stats, tell: state.tell, lastCause: this.lastCause,
      chat: this.chat,
    });
  }

  private finish(result: "won" | "lost") {
    if (this.view.result) return;
    this.updateView();
    this.notify({ ...this.view, result });
    this.world.stopTicking();
  }
  override onUnitDeath(unit: Unit) {
    if (unit instanceof Player) {
      if (this.victoryTicksLeft === null) this.finish("lost");
    } else if (unit instanceof OcellusBoss) {
      // Fight logs record the death pose and all three spotanims on the
      // exact killing hit tick. Avoid the SDK's one-tick delayed replay.
      unit.playAnimation(OCELLUS_ASSETS.npcs.ocellus.animations.death);
      for (const id of OCELLUS_DEATH_EFFECTS) {
        unit.addSpotAnim({ id, channel: `ocellus-death-${id}` });
      }
      this.victoryTicksLeft = OCELLUS_VICTORY_COUNTDOWN;
      this.updateView();
    } else if (unit instanceof OcellusRift) {
      const destroyed = this.sim.removeRift(unit.riftId);
      if (destroyed) unit.playAnimation(OCELLUS_ASSETS.npcs.voidRift.animations.death);
      this.riftMobs.delete(unit.riftId);
      // Destroying a living Void Rift empowers its killer with an immediate
      // next attack. Detonation never awards this benefit.
      if (destroyed && this.player) {
        this.player.attackDelay = 0;
        this.addChat("Destroying the void rift empowers you!");
      }
      this.updateView();
    }
  }
  override postTick() {
    // Player hits now settle after the boss's mechanic turn: update the HP
    // readout after those hits, retaining the mechanic's tell and counters.
    const playerHp = this.player?.currentStats.hitpoint ?? 0;
    const bossHp = this.boss?.currentStats.hitpoint ?? 0;
    if (this.view.playerHp !== playerHp || this.view.bossHp !== bossHp) {
      this.notify({ ...this.view, playerHp, bossHp });
    }
    if (this.victoryTicksLeft === null) return;
    this.victoryTicksLeft--;
    if (this.victoryTicksLeft <= 0) {
      this.victoryTicksLeft = null;
      this.finish("won");
    }
  }
  override onGameOver() {
    if (this.victoryTicksLeft === null) this.finish("lost");
  }
}
