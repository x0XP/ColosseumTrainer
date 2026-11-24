import { Projectile } from "osrs-sdk";
import type { Unit } from "osrs-sdk";

/**
 * Ocellus's server-side HP changes use the SDK's normal hitsplat pipeline:
 * positive amount = red damage splat, negative = green healing splat.
 * The boss event fires before the player's incoming-hit queue in each world
 * tick, so delay 1 resolves on that same tick.
 *
 * No projectile model is drawn: Ocellus's original spell/fragment spotanims
 * handle the visible attack and healing effects separately.
 */
// The marker is consumed synchronously by OcellusPlayer.restoreHitpoints.
// Normal food, potions and all other SDK healing retain their own caps.
const uncappedLifeforceTargets = new WeakSet<Unit>();

export function consumeLifeforceHeal(target: Unit): boolean {
  return uncappedLifeforceTargets.delete(target);
}

/** The Ocellus build uses the newer SDK's restoreHitpoints method, while
 * the shared Jest suite compiles against the older Sol SDK declarations.
 * Install the narrow adapter on this player only, without modifying either
 * SDK prototype or changing any non-lifeforce healing. */
export function installOcellusLifeforceRecovery(player: Unit): boolean {
  const target = player as Unit & { restoreHitpoints?: (amount: number) => void };
  const normal = target.restoreHitpoints;
  if (typeof normal !== "function") return false;
  target.restoreHitpoints = function(amount: number) {
    if (consumeLifeforceHeal(player)) {
      player.currentStats.hitpoint += amount;
    } else {
      normal.call(player, amount);
    }
  };
  return true;
}

export function scriptedHealthProjectile(
  boss: Unit,
  target: Unit,
  signedAmount: number,
  lifeforce = false,
): Projectile {
  if (!Number.isSafeInteger(signedAmount) || signedAmount === 0) {
    throw new RangeError("Ocellus health splat requires a nonzero integer");
  }
  if (lifeforce && signedAmount > 0) throw new RangeError("Lifeforce recovery must be a heal");
  const projectile = new Projectile(null, signedAmount, boss, target, "typeless", {
    setDelay: 1,
    visuals: { hidden: true },
  });
  const original = projectile.beforeHit.bind(projectile);
  projectile.beforeHit = () => {
    original();
    // The constructor sees pre-queue HP. A lifeforce heal earlier in the
    // same queue can change it, so clamp damage at the actual landing.
    projectile.damage = signedAmount > 0
      ? Math.min(signedAmount, Math.max(0, target.currentStats.hitpoint))
      : signedAmount;
    if (lifeforce) uncappedLifeforceTargets.add(target);
  };
  return projectile;
}
