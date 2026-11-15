import * as THREE from "three";
import {
  Region, Player, Mob, Entity, Unit, Model, Settings, MeleeWeapon,
  CacheRenderModel, CacheRenderReferences, InvisibleMovementBlocker,
  CollisionType, LineOfSightMask, CardinalDirection,
} from "osrs-sdk";
import type { Loadout, UnitBonuses } from "osrs-sdk";
import {
  BOARD_WIDTH, BOARD_HEIGHT, FLOOR_TILES, BOSS_ANCHOR, PLAYER_SPAWN,
  inPlatform, inNearSquare, isHole, MAX_HP, STARTING_HP, stageAt,
} from "./Phase4Rules";
import type { Tile, PhaseFrame } from "./Phase4Rules";
import { Phase4Simulation } from "./Phase4Simulation";
import { OCELLUS_ASSETS } from "./Assets";
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
  if (snapshot.marks.some((m) => tilesEqual(m.tile, at))) return 0xe5b160;
  if (snapshot.orbs.some((o) => !o.picked && tilesEqual(o.tile, at))) return 0x2e9b9c;
  if (snapshot.frame.stage === "inner-void" && inNearSquare(at)) return 0x40214f;
  if (snapshot.frame.stage === "outer-void" && !inNearSquare(at)) return 0x40214f;
  return (at.x + at.y) % 2 ? 0x777061 : 0x807868;
};

class FloorTileModel implements Model {
  private readonly material = new THREE.MeshBasicMaterial({ color: 0x777061, side: THREE.DoubleSide });
  private readonly mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.material);
  constructor(private readonly region: OcellusRegion, private readonly tile: Tile) {
    this.mesh.rotation.x = -Math.PI / 2;
    // Engine world tiles extend from x..x+1 and y..y-1.
    this.mesh.position.set(tile.x + 0.5, -0.43, tile.y - 0.5);
  }
  draw(scene: THREE.Scene) {
    if (this.mesh.parent !== scene) scene.add(this.mesh);
    this.material.color.setHex(floorColor(this.tile, this.region.getSnapshot()));
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
  override get color() { return "#807868"; }
  override create3dModel() { return new FloorTileModel(this.region as OcellusRegion, this.location); }
  override draw(_tickPercent: number, ctx: OffscreenCanvasRenderingContext2D, _offset = {x: 0,y: 0}, scale = 1) {
    ctx.fillStyle = "#" + floorColor(this.location, (this.region as OcellusRegion).getSnapshot()).toString(16).padStart(6, "0");
    ctx.fillRect(0, 0, scale, scale);
  }
}

/** Independent Ocellus NPC. SolHeredit and its attack scripts are never used. */
export class OcellusBoss extends Mob {
  mobName() { return "Ocellus"; }
  get combatLevel() { return 1601; }
  get size() { return 3; }
  override get consumesSpace() { return false; }
  get healthScale() { return MAX_HP; }
  override get healthBarWidth() { return 90; }
  override get idlePoseId() {
    const stage = (this.region as OcellusRegion).getSnapshot().frame.stage;
    return stage === "inner-void"
      ? OCELLUS_ASSETS.npcs.ocellus.animations.deflectLoop
      : OCELLUS_ASSETS.npcs.ocellus.animations.idle;
  }
  override get walkingPoseId() { return OCELLUS_ASSETS.npcs.ocellus.animations.walk; }
  override get attackAnimationId() { return null; }
  override get deathAnimationId() { return OCELLUS_ASSETS.npcs.ocellus.animations.death; }
  override get deathAnimationLength() { return 15; }
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
  override queueStep() {
    super.queueStep(); // preserve SDK incoming hits and death detection
    if (this.dying === 0 || this.currentStats.hitpoint <= 0 || this.age > 0) return;
    (this.region as OcellusRegion).runEncounterTick();
  }
}

export class OcellusRift extends Mob {
  constructor(region: Region, at: Tile, readonly riftId: number) { super(region, at); }
  mobName() { return "Void Rift"; }
  get combatLevel() { return 138; }
  override get consumesSpace() { return false; }
  get size() { return 1; }
  override get idlePoseId() { return OCELLUS_ASSETS.npcs.voidRift.animations.idle; }
  override get walkingPoseId() { return OCELLUS_ASSETS.npcs.voidRift.animations.idle; }
  override get deathAnimationId() { return OCELLUS_ASSETS.npcs.voidRift.animations.death; }
  override get attackAnimationId() { return null; }
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
    const player = new Player(this, PLAYER_SPAWN);
    this.player = player;
    this.addPlayer(player);
    player.freeze(this.world.getReadyTimer + 1);

    for (let y = 0; y < BOARD_HEIGHT; y++) for (let x = 0; x < BOARD_WIDTH; x++) {
      const at = { x, y };
      if (inPlatform(at)) this.addEntity(new FloorTile(this, at));
      else this.addEntity(new InvisibleMovementBlocker(this, at));
    }
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
    if (frame.frame.events.some((event) => event.kind === "lifeforce-tell")) {
      this.boss.playAnimation(OCELLUS_ASSETS.npcs.ocellus.animations.lifeforceCast);
    } else if (frame.frame.events.some((event) => event.kind === "special-tell")) {
      this.boss.playAnimation(OCELLUS_ASSETS.npcs.ocellus.animations.transitionCast);
    }
    if (frame.tell) this.boss.setOverheadText(frame.tell);
    this.updateView(frame);
    if (this.player.currentStats.hitpoint <= 0) this.player.detectDeath();
  }

  private applyEffect(effect: Effect) {
    if (!this.player || !this.boss) return;
    switch (effect.kind) {
      case "damage":
        this.player.currentStats.hitpoint = Math.max(0, this.player.currentStats.hitpoint - effect.amount);
        this.lastCause = effect.reason;
        break;
      case "heal":
        this.player.currentStats.hitpoint += effect.amount;
        break;
      case "boss-heal":
        this.boss.currentStats.hitpoint = Math.min(MAX_HP, this.boss.currentStats.hitpoint + effect.amount);
        break;
      case "rift-spawn": {
        const rift = new OcellusRift(this, effect.tile, effect.id);
        this.riftMobs.set(effect.id, rift);
        this.addMob(rift);
        break;
      }
      case "rift-detonate": {
        const rift = this.riftMobs.get(effect.id);
        if (rift) {
          this.riftMobs.delete(effect.id);
          rift.dying = 0;
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
    if (unit instanceof Player) this.finish("lost");
    else if (unit instanceof OcellusBoss) this.finish("won");
    else if (unit instanceof OcellusRift) {
      this.sim.removeRift(unit.riftId);
      this.riftMobs.delete(unit.riftId);
      this.updateView();
    }
  }
  override onGameOver() { this.finish("lost"); }
}
