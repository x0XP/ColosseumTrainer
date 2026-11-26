import {
  Tile, PhaseFrame, PhaseEvent, stageAt, voidFloorHits, isHole, inPlatform,
  orbLocation, outerOrbLocation, inNearSquare, distance, random01, specialStyle, riftLocations,
} from "./Phase4Rules";
import type { AttackStyle } from "./Phase4Rules";
import { RIFT_CHARGE_TICKS } from "./OcellusPresentation";

export type GamePrayer = "melee" | "range" | "magic" | null;
export type Effect =
  | Readonly<{ kind: "damage"; amount: number; reason: string }>
  | Readonly<{ kind: "heal"; amount: number; reason: string }>
  | Readonly<{ kind: "boss-heal"; amount: number; reason: string }>
  | Readonly<{ kind: "message"; text: string }>
  | Readonly<{ kind: "attack-haste"; ticks: number }>
  | Readonly<{ kind: "rift-spawn"; id: number; tile: Tile }>
  | Readonly<{ kind: "rift-detonate"; id: number }>
  | Readonly<{ kind: "orb-spawn"; void: "inner" | "outer"; tile: Tile }>;

export type Orb = {
  void: "inner" | "outer";
  tile: Tile;
  createdAt: number;
  maturesAt: number;
  expiresAt: number;
  amount: number;
  picked: boolean;
  claimAt: number | null;
};
export type RiftState = { id: number; tile: Tile; spawnedAt: number; alive: boolean };
export type Mark = { void: "inner" | "outer"; pulse: number; tile: Tile };
export type FightStats = {
  drained: number;
  returned: number;
  explosionsDodged: number;
  explosionsTotal: number;
  specialsDefended: number;
  specialsTotal: number;
  riftsKilled: number;
  riftsSpawned: number;
  damageTaken: number;
  cycles: number;
  fragmentsSpawned: number;
  fragmentsCollected: number;
  fragmentsExpired: number;
  speedBonusDodges: number;
  voidFloorDamage: number;
  lingeringVoidDamage: number;
  explosionDamage: number;
  protectedSpecialDamage: number;
  unprotectedSpecialDamage: number;
  riftDamage: number;
};

export function emptyFightStats():FightStats {
  return {
    drained:0,returned:0,explosionsDodged:0,explosionsTotal:0,
    specialsDefended:0,specialsTotal:0,riftsKilled:0,riftsSpawned:0,damageTaken:0,cycles:0,
    fragmentsSpawned:0,
    fragmentsCollected:0,
    fragmentsExpired:0,
    speedBonusDodges:0,
    voidFloorDamage:0,
    lingeringVoidDamage:0,
    explosionDamage:0,
    protectedSpecialDamage:0,
    unprotectedSpecialDamage:0,
    riftDamage:0,
  };
}

// All damage categories are exclusive. Drained HP is already recorded by
// the lifeforce event, so do not count it a second time in the breakdown.
export function recordMechanicDamage(stats:FightStats,reason:string,amount:number):void {
  stats.damageTaken+=amount;
  if(reason==="Void floor")stats.voidFloorDamage+=amount;
  else if(reason==="Lingering void")stats.lingeringVoidDamage+=amount;
  else if(reason==="Void explosion")stats.explosionDamage+=amount;
  else if(reason==="Void Rift eruption")stats.riftDamage+=amount;
  else if(reason.startsWith("Protected "))stats.protectedSpecialDamage+=amount;
  else if(reason.startsWith("Unprotected "))stats.unprotectedSpecialDamage+=amount;
}
export type FrameResult = Readonly<{
  frame: PhaseFrame;
  effects: readonly Effect[];
  orbs: readonly Orb[];
  marks: readonly Mark[];
  impactMark: Mark | null;
  departingOrbs: readonly Orb[];
  rifts: readonly RiftState[];
  stats: Readonly<FightStats>;
  tell: string | null;
}>;

const atSame = (a: Tile, b: Tile) => a.x === b.x && a.y === b.y;
const values = (a: number, b: number, seed: number, tick: number): number =>
  a + Math.floor(random01(seed, tick, a + b) * (b - a + 1));

/**
 * Pure, deterministic Phase 4 mechanic simulator; does not import Sol Heredit.
 * The region consumes effects to change real SDK player/boss hitpoints.
 * The mechanics order is local to this trainer and must be validated in-game.
 */
export class Phase4Simulation {
  private readonly orbs: Orb[] = [];
  private readonly marks: Mark[] = [];
  private impactMark: Mark | null = null;
  private departingOrbs: Orb[] = [];
  private readonly rifts: RiftState[] = [];
  private nextRiftId = 0;
  private nextTick = 0;
  private nearSquareEntry: Tile | null = null;
  private pendingSpecial: AttackStyle | null = null;
  private pendingHeal = 0;
  private pendingBossHeal = 0;
  private pendingSpecialHeals: { due: number; amount: number }[] = [];
  private stats: FightStats = emptyFightStats();
  constructor(readonly seed = 12345) {}

  current() { return stageAt(Math.max(0, this.nextTick - 1)); }
  upcoming() { return stageAt(this.nextTick); }
  snapshot() {
    const copyMark = (m: Mark): Mark => ({ ...m, tile: { ...m.tile } });
    return {
      orbs: this.orbs.map(o => ({ ...o, tile: { ...o.tile } })),
      marks: this.marks.map(copyMark),
      impactMark: this.impactMark ? copyMark(this.impactMark) : null,
      departingOrbs: this.departingOrbs.map(o=>({ ...o, tile:{ ...o.tile } })),
      rifts: this.rifts.filter(r => r.alive).map(r => ({ ...r, tile: { ...r.tile } })),
      stats: { ...this.stats },
    };
  }
  removeRift(id: number): boolean {
    const rift = this.rifts.find((one) => one.id === id && one.alive);
    if (!rift) return false;
    rift.alive = false;
    this.stats.riftsKilled++;
    return true;
  }

  step(position: Tile, currentHp: number, prayer: GamePrayer, tickStartTile:Tile=position): FrameResult {
    const t = this.nextTick++;
    const frame = stageAt(t);
    this.impactMark = null;
    this.departingOrbs = [];
    // The last entry into the five-by-five ring determines the OUTER orb's
    // visible spawn tile. Leaving the ring clears the entry for a new approach.
    this.nearSquareEntry = inNearSquare(position)
      ? (this.nearSquareEntry ?? { ...position })
      : null;
    const effects: Effect[] = [];
    let hp = currentHp;
    let tell: string | null = null;
    const damage = (amount: number, reason: string) => {
      const applied = Math.min(Math.max(0, hp), Math.max(0, Math.floor(amount)));
      hp -= applied;
      recordMechanicDamage(this.stats,reason,applied);
      if (applied > 0) effects.push({ kind: "damage", amount: applied, reason });
      return applied;
    };
    const heal = (amount: number, reason: string) => {
      const applied = Math.max(0, Math.floor(amount));
      if (applied > 0) { hp += applied; effects.push({ kind: "heal", amount: applied, reason }); }
    };

    if (this.pendingHeal > 0) {
      heal(this.pendingHeal, "Lifeforce returned");
      this.stats.returned += this.pendingHeal;
      this.pendingHeal = 0;
    }
    if (this.pendingBossHeal > 0) {
      effects.push({ kind: "boss-heal", amount: this.pendingBossHeal, reason: "Unclaimed lifeforce" });
      this.pendingBossHeal = 0;
    }
    // Soul Split restores HP two ticks after a wrong-prayer transition hit,
    // not on the damage tick itself.
    for (const entry of this.pendingSpecialHeals) {
      if (entry.due <= t) {
        effects.push({ kind: "boss-heal", amount: entry.amount, reason: "Soul Split" });
      }
    }
    this.pendingSpecialHeals = this.pendingSpecialHeals.filter((entry) => entry.due > t);

    if (frame.cycle > this.stats.cycles) this.stats.cycles = frame.cycle;
    if (inPlatform(tickStartTile) && voidFloorHits(frame, tickStartTile)) {
      damage(values(9, 11, this.seed, t + 280), "Void floor");
    }
    if (inPlatform(tickStartTile) && isHole(tickStartTile)) {
      damage(values(9, 11, this.seed, t + 390), "Lingering void");
    }

    // A rift that survives 30 world ticks detonates.
    const detonating = this.rifts.filter((rift) => rift.alive && t - rift.spawnedAt >= RIFT_CHARGE_TICKS);
    if (detonating.length) {
      damage(values(28, 41, this.seed, t + 410), "Void Rift eruption");
      for (const rift of detonating) {
        rift.alive = false;
        effects.push({ kind: "rift-detonate", id: rift.id });
      }
    }

    // A previously picked-up orb returns life one world tick later.
    for (const orb of this.orbs) {
      const readyOnStandingTile=t===orb.maturesAt&&atSame(tickStartTile,orb.tile);
      if (!orb.picked && t >= orb.maturesAt && t < orb.expiresAt && (readyOnStandingTile||atSame(position, orb.tile))) {
        orb.picked = true;
        orb.claimAt = t;
        this.departingOrbs.push(orb);
        this.stats.fragmentsCollected++;
        // A player already on the tile when the orb matures regains HP
        // on that same tick; stepping onto a mature orb returns it next tick.
        if (readyOnStandingTile) {
          heal(orb.amount, "Lifeforce returned");
          this.stats.returned += orb.amount;
        } else {
          this.pendingHeal += orb.amount;
        }
      }
    }

    for (const event of frame.events) {
      switch (event.kind) {
        case "lifeforce-tell":
          tell = "Ocellus manipulates your lifeforce!";
          effects.push({ kind: "message", text: tell });
          break;
        case "lifeforce-hit": {
          const voidType = event.void!;
          const half = Math.floor(Math.max(0, hp) / 2);
          const at = voidType === "outer"
            ? outerOrbLocation(this.nearSquareEntry ?? position, this.seed, t)
            : orbLocation(position, "inner", this.seed, t);
          damage(half, "Lifeforce drain");
          this.stats.drained += half;
          const maturity = t + (voidType === "inner" ? 12 : 6);
          const expiry = t + (voidType === "inner" ? 24 : 18);
          this.orbs.push({ void: voidType, tile: at, createdAt: t, maturesAt: maturity, expiresAt: expiry, amount: half, picked: false, claimAt: null });
          this.stats.fragmentsSpawned++;
          effects.push({ kind: "orb-spawn", void: voidType, tile: at });
          break;
        }
        case "orb-expire": {
          const voidType = event.void!;
          // Credit lasts until the documented expiry; unclaimed outer
          // fragments return to the boss after their window.
          const expired = this.orbs.filter((orb) => orb.void === voidType && !orb.picked && t >= orb.expiresAt);
          this.departingOrbs.push(...expired);
          this.stats.fragmentsExpired+=expired.length;
          if (voidType === "outer") for (const orb of expired) {
            this.pendingBossHeal += orb.amount;
          }
          break;
        }
        case "explosion-mark":
          this.marks.push({ void: event.void!, pulse: event.pulse!, tile: { ...tickStartTile } });
          tell = "Move! Void explosion incoming";
          break;
        case "explosion-hit": {
          const i = this.marks.findIndex((m) => m.void === event.void && m.pulse === event.pulse);
          if (i >= 0) {
            const mark = this.marks.splice(i, 1)[0];
            this.impactMark = mark;
            this.stats.explosionsTotal++;
            if (atSame(mark.tile, tickStartTile)) {
              damage(values(14, 16, this.seed, t + 530), "Void explosion");
            } else {
              this.stats.explosionsDodged++;
              // The OSRS encounter rewards an adjacent-tile dodge by cutting
              // three ticks off the next attack. A two-tile run avoids damage
              // but does NOT earn the attack-speed bonus.
              if (distance(mark.tile, tickStartTile) === 1) {
                this.stats.speedBonusDodges++;
                effects.push({ kind: "attack-haste", ticks: 3 });
              }
            }
          }
          break;
        }
        case "special-tell": {
          const nth = frame.offset === 24 ? 0 : 1;
          this.pendingSpecial = specialStyle(this.seed, frame.cycle, nth);
          tell = "Incoming " + this.pendingSpecial + " attack – switch prayers";
          break;
        }
        case "special-hit": {
          const style = this.pendingSpecial;
          if (style) {
            this.stats.specialsTotal++;
            if (prayer === style) {
              this.stats.specialsDefended++;
              damage(values(5, 10, this.seed, t + 610), "Protected " + style + " special");
            } else {
              const amount = values(43, 50, this.seed, t + 710);
              const applied = damage(amount, "Unprotected " + style + " special");
              if (applied > 0) this.pendingSpecialHeals.push({ due: t + 2, amount: applied });
            }
            this.pendingSpecial = null;
          }
          break;
        }
        case "rift-spawn": {
          const nextCycle = frame.cycle + 1;
          const count = Math.min(5, nextCycle);
          for (const at of riftLocations(this.seed, nextCycle, count)) {
            const id = ++this.nextRiftId;
            this.rifts.push({ id, tile: at, spawnedAt: t, alive: true });
            this.stats.riftsSpawned++;
            effects.push({ kind: "rift-spawn", id, tile: at });
          }
          break;
        }
        default:
          break;
      }
    }

    // Keep only the orbs needed for the next few ticks, not an unbounded
    // history of completed cycles.
    for (let i = this.orbs.length - 1; i >= 0; i--) {
      if (t >= this.orbs[i].expiresAt || (this.orbs[i].picked && t >= (this.orbs[i].claimAt ?? t) + 1)) {
        this.orbs.splice(i, 1);
      }
    }
    for (let i = this.rifts.length - 1; i >= 0; i--) {
      if (!this.rifts[i].alive) this.rifts.splice(i, 1);
    }

    return { frame, effects, ...this.snapshot(), tell };
  }
}
