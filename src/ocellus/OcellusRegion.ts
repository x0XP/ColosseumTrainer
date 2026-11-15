import * as THREE from "three";
import {
  Region, Player, Mob, Entity, Unit, Model, Settings, MeleeWeapon,
  CacheRenderModel, CacheRenderReferences, InvisibleMovementBlocker,
  CollisionType, LineOfSightMask, CardinalDirection, Projectile, Sound, SoundCache, cacheSound, GROUND_OVERLAY_Y,
} from "osrs-sdk";
import type { Loadout, UnitBonuses } from "osrs-sdk";
import {
  BOARD_WIDTH, BOARD_HEIGHT, FLOOR_TILES, BOSS_ANCHOR, PLAYER_SPAWN,
  inPlatform, inNearSquare, isHole, HOLE_TILES, MAX_HP, STARTING_HP, stageAt, bossOverheadSprite, bossVisibleAt, specialStyle,
} from "./Phase4Rules";
import type { Tile, PhaseFrame } from "./Phase4Rules";
import { Phase4Simulation } from "./Phase4Simulation";
import { OCELLUS_ASSETS } from "./Assets";
import { installOcellusDeflection } from "./OcellusDeflection";
import { OcellusArena, OcellusBrazier, OcellusFloorHole, BRAZIER_TILES } from "./OcellusArena";
import { OcellusSpotEffect } from "./OcellusSpotEffects";
import { specialTellSpotId } from "./OcellusVisualCues";
import { presentationAt, OCELLUS_DEATH_TICKS, OCELLUS_DEATH_EFFECTS, RIFT_BURST_EFFECT, RIFT_CHARGE_TICKS } from "./OcellusPresentation";
import type { Effect, FightStats, FrameResult, GamePrayer, Orb, Mark } from "./Phase4Simulation";

type Result = "won" | "lost" | null;
export type OcellusView = Readonly<{
  frame: PhaseFrame;
  result: Result;
  bossHp: number;
  playerHp: number;
  marks: readonly Mark[];
  orbs: readonly Orb[];
  rifts: number;
  stats: Readonly<FightStats>;
  tell: string | null;
  lastCause: string | null;
}>;

const emptyStats = (): FightStats => ({
  drained: 0, returned: 0, explosionsDodged: 0, explosionsTotal: 0,
  specialsDefended: 0, specialsTotal: 0, riftsKilled: 0,
  riftsSpawned: 0, damageTaken: 0, cycles: 0,
});
const tilesEqual = (a: Tile, b: Tile) => a.x === b.x && a.y === b.y;
const floorColor = (at: Tile, snapshot: OcellusView): number => {
  if (isHole(at)) return 0x150c25;
  if (snapshot.marks.some((m) => tilesEqual(m.tile, at))) return 0x64347b;
  if (snapshot.orbs.some((o) => !o.picked && tilesEqual(o.tile, at))) return 0x2e9b9c;
  if (snapshot.frame.stage === "inner-void" && inNearSquare(at)) return 0x1e2529;
  if (snapshot.frame.stage === "outer-void" && !inNearSquare(at)) return 0x1e2529;
  return (at.x + at.y) % 2 ? 0x3f392f : 0x4a4339;
};

class FloorTileModel implements Model {
  private readonly material = new THREE.MeshBasicMaterial({ color: 0x4a4339, side: THREE.DoubleSide });
  private readonly mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.material);
  constructor(private readonly region: OcellusRegion, private readonly tile: Tile) {
    this.mesh.rotation.x = -Math.PI / 2;
    // Engine world tiles extend from x..x+1 and y..y-1.
    this.mesh.position.set(tile.x + 0.5, GROUND_OVERLAY_Y - 0.005, tile.y - 0.5);
  }
  draw(scene: THREE.Scene) {
    if (this.mesh.parent !== scene) scene.add(this.mesh);
    // Keep the stone base visible under the animated starfield and effects.
    this.material.color.setHex((this.tile.x + this.tile.y) % 2 ? 0x3f392f : 0x4a4339);
  }
  destroy(scene: THREE.Scene) {
    if (this.mesh.parent === scene) scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
  getWorldPosition() { return this.mesh.getWorldPosition(new THREE.Vector3()); }
  async preload() {}
}

class FloorTile extends Entity {
  constructor(region: OcellusRegion, location: Tile) { super(region, location); }
  override get collisionType() { return CollisionType.NONE; }
  override get lineOfSight() { return LineOfSightMask.NONE; }
  override get drawOutline() { return false; }
  override get color() { return "#4a4339"; }
  override create3dModel() { return new FloorTileModel(this.region as OcellusRegion, this.location); }
  override draw(_tickPercent: number, ctx: OffscreenCanvasRenderingContext2D, _offset = {x: 0,y: 0}, scale = 1) {
    ctx.fillStyle = "#" + floorColor(this.location, (this.region as OcellusRegion).getSnapshot()).toString(16).padStart(6, "0");
    ctx.fillRect(0, 0, scale, scale);
  }
}

/** Sprite frames are generated from the pinned cache during the Ocellus build. */
const OCELLUS_OVERHEAD_IMAGES = new Map<number, HTMLImageElement>();

/** Independent Ocellus NPC. SolHeredit and its attack scripts are never used. */
export class OcellusBoss extends Mob {
  mobName() { return "Ocellus"; }
  get combatLevel() { return 1601; }
  get size() { return 3; }
  override get consumesSpace() { return false; }
  get healthScale() { return MAX_HP; }
  override get healthBarWidth() { return 90; }
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
  override drawOverheadPrayers(context: OffscreenCanvasRenderingContext2D, scale: number) {
    const frame = (this.region as OcellusRegion).getSnapshot().frame;
    const spriteFrame = bossOverheadSprite(frame);
    if (spriteFrame === null) return;
    let icon = OCELLUS_OVERHEAD_IMAGES.get(spriteFrame);
    if (!icon) {
      icon = new Image();
      icon.src = new URL(`osrs-assets/sprites/440-${spriteFrame}.png`, document.baseURI).href;
      OCELLUS_OVERHEAD_IMAGES.set(spriteFrame, icon);
    }
    if (icon.complete && icon.naturalWidth > 0) {
      // In the reference the icon sits immediately below the boss's HP bar.
      context.drawImage(icon, -scale / 2, 7, scale, scale);
    }
  }
  override get walkingPoseId() { return OCELLUS_ASSETS.npcs.ocellus.animations.walk; }
  override get attackAnimationId() { return null; }
  override get deathAnimationId() { return OCELLUS_ASSETS.npcs.ocellus.animations.death; }
  override get deathAnimationLength() { return OCELLUS_DEATH_TICKS; }
  get attackSpeed() { return 0; }
  get attackRange() { return 0; }
  get maxHit() { return 0; }
  attackStyleForNewAttack() { return "stab" as const; }
  canMeleeIfClose() { return null; }
  override canMove() { return false; }
  override movementStep() {}
  override attackIfPossible() {}
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
      installOcellusDeflection(
        projectile, (this.region as OcellusRegion).getSnapshot().frame,
      );
    }
    super.addProjectile(projectile);
  }
  override queueStep() {
    super.queueStep(); // preserve SDK incoming hits and death detection
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
  override get deathAnimationId() { return OCELLUS_ASSETS.npcs.voidRift.animations.death; }
  override get attackAnimationId() { return null; }
  override canBeAttacked() { return this.dying === -1; }
  override drawHPBar(
    context: OffscreenCanvasRenderingContext2D,
    scale: number,
    verticalOffset = -(this.size / 2) * scale,
  ) {
    super.drawHPBar(context, scale, verticalOffset);
    // Game rift charge bar: dark olive backing, yellow charge below green HP.
    const width = this.healthBarWidth;
    const elapsed = (this.region as OcellusRegion).getSnapshot().frame.tick - this.spawnedAt;
    const fraction = Math.max(0, Math.min(1, elapsed / RIFT_CHARGE_TICKS));
    context.fillStyle = "#1e1e0c";
    context.fillRect(-width / 2, verticalOffset + 5, width, 5);
    context.fillStyle = "#e0c020";
    context.fillRect(-width / 2, verticalOffset + 5, width * fraction, 5);
  }
  override get deathAnimationLength() { return 2; }
  get attackSpeed() { return 0; }
  get attackRange() { return 0; }
  get maxHit() { return 0; }
  attackStyleForNewAttack() { return "stab" as const; }
  override canMove() { return false; }
  override movementStep() {}
  override attackIfPossible() {}
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

export class OcellusRegion extends Region {
  private sim = new Phase4Simulation(42);
  private readonly listeners = new Set<() => void>();
  private player: Player | null = null;
  private boss: OcellusBoss | null = null;
  private riftMobs = new Map<number, OcellusRift>();
  private view: OcellusView = Object.freeze({
    frame: stageAt(0), result: null, bossHp: STARTING_HP, playerHp: 99,
    marks: [], orbs: [], rifts: 0, stats: emptyStats(), tell: null, lastCause: null,
  });
  private lastCause: string | null = null;
  private victoryTicksLeft: number | null = null;

  constructor(loadouts: Loadout[]) { super(loadouts); }
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
    ctx.fillStyle = "#05070b";
    ctx.fillRect(0, 0, this.width * scale, this.height * scale);
  }

  override initialiseRegion() {
    this.sim = new Phase4Simulation(42);
    this.riftMobs.clear();
    this.lastCause = null;
    this.victoryTicksLeft = null;
    const player = new Player(this, PLAYER_SPAWN);
    this.player = player;
    this.addPlayer(player);
    player.freeze(this.world.getReadyTimer + 1);

    for (let y = 0; y < BOARD_HEIGHT; y++) for (let x = 0; x < BOARD_WIDTH; x++) {
      const at = { x, y };
      if (inPlatform(at)) this.addEntity(new FloorTile(this, at));
      else this.addEntity(new InvisibleMovementBlocker(this, at));
    }
    // Overlay scenery never changes collision/pathing or boss mechanics.
    this.addEntity(new OcellusArena(this, () => this.getSnapshot()));
    this.addEntity(new OcellusSpotEffect(this, "inner-orb", () => this.getSnapshot()));
    this.addEntity(new OcellusSpotEffect(this, "outer-orb", () => this.getSnapshot()));
    this.addEntity(new OcellusSpotEffect(this, "explosion", () => this.getSnapshot()));
    for (const at of BRAZIER_TILES) this.addEntity(new OcellusBrazier(this, at));
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
      rifts: 0, stats: emptyStats(), tell: null, lastCause: null,
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
      // The pinned SDK now supports cache-textured spotanim faces. Do not apply
      // the reference's fallback recolor: it darkens the actual starfield
      // texture (ID 215) on melee/ranged/magic transition discs.
      this.boss.addSpotAnim({
        id: specialTellSpotId(style), channel: "ocellus-transition-tell",
      });
    }
    for (const sound of presentation.sounds) this.playAreaSound(sound.id, sound.delayMs);
    if (frame.frame.tick === 5) this.boss.setOverheadText("End...");
    if (frame.frame.tick === 8 && this.boss.overheadText === "End...") {
      this.boss.overheadText = null;
      this.boss.overheadTextTimer = 0;
    }
    if (frame.tell) this.boss.setOverheadText(frame.tell);
    this.updateView(frame);
    if (this.player.currentStats.hitpoint <= 0) this.player.detectDeath();
  }

  private playAreaSound(id: number, delayMs = 0) {
    if (!this.player) return;
    SoundCache.play(new Sound(cacheSound(id), 0.1, delayMs, {
      location: this.player.location, range: 31, retain: 31,
    }));
  }

  private applyEffect(effect: Effect) {
    if (!this.player || !this.boss) return;
    switch (effect.kind) {
      case "damage":
        // World.tickRegion resolves NPC actions before the player hit queue.
        // This lands in the *same* world tick, preserving the simulator's
        // damage timing while drawing real OSRS damage hitsplats and hit sounds.
        this.player.addProjectile(new Projectile(
          null, effect.amount, this.boss, this.player, "typeless", {
            setDelay: 1, visuals: { hidden: true },
          },
        ));
        this.lastCause = effect.reason;
        break;
      case "heal":
        this.player.currentStats.hitpoint += effect.amount;
        if (effect.reason === "Lifeforce returned") {
          this.player.addSpotAnim({ id: 4314, channel: "ocellus-lifeforce-return" });
        }
        break;
      case "boss-heal":
        this.boss.currentStats.hitpoint = Math.min(MAX_HP, this.boss.currentStats.hitpoint + effect.amount);
        break;
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
          rift.dying = 3;
          this.player.addSpotAnim({ id: RIFT_BURST_EFFECT, channel: "ocellus-rift-burst" });
        }
        break;
      }
      default:
        break;
    }
  }

  private updateView(result?: FrameResult) {
    const state = result ?? {
      frame: this.sim.current(), marks: this.sim.snapshot().marks,
      orbs: this.sim.snapshot().orbs, rifts: this.sim.snapshot().rifts, stats: this.sim.snapshot().stats,
      tell: null,
    };
    this.notify({
      frame: state.frame, result: this.view.result,
      bossHp: this.boss?.currentStats.hitpoint ?? 0, playerHp: this.player?.currentStats.hitpoint ?? 0,
      marks: state.marks, orbs: state.orbs, rifts: state.rifts.length,
      stats: state.stats, tell: state.tell, lastCause: this.lastCause,
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
      // The SDK schedules the real 14872 death animation on the next tick.
      // Stopping the world immediately here would prevent it from ever playing.
      for (const id of OCELLUS_DEATH_EFFECTS) {
        unit.addSpotAnim({ id, channel: `ocellus-death-${id}` });
      }
      this.victoryTicksLeft = OCELLUS_DEATH_TICKS;
      this.updateView();
    } else if (unit instanceof OcellusRift) {
      this.sim.removeRift(unit.riftId);
      this.riftMobs.delete(unit.riftId);
      this.updateView();
    }
  }
  override postTick() {
    // Player hits now settle after the boss's mechanic turn: update the HP
    // readout after those hits, retaining the mechanic's tell and counters.
    if (this.player && this.view.playerHp !== this.player.currentStats.hitpoint) {
      this.notify({ ...this.view, playerHp: this.player.currentStats.hitpoint });
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
