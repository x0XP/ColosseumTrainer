/** 21 October 2026 Fractured Archive Defence reduction hotfix.
 * The combat form's base Defence is 250, hence a floor of 150.
 * https://oldschool.runescape.wiki/w/Update:The_Fractured_Archive_-_Out_Today
 * No unsupported phase-transition stat reset is introduced.
 */
export const OCELLUS_DEFENCE_FLOOR_FRACTION = 0.6;
// 28 October 2026: Ocellus offensive stats cannot be reduced by more than 50%.
export const OCELLUS_OFFENCE_FLOOR_FRACTION = 0.5;
// The OSRS Wiki's Demon attribute table lists Ocellus at 80% effectiveness.
export const OCELLUS_DEMONBANE_EFFECTIVENESS = 0.8;
const COMBAT_STATS = ["attack","strength","defence","range","magic"] as const;
type CombatStats = Record<typeof COMBAT_STATS[number],number>;
type LandingHit = { beforeHit():void; damage:number };

export function minimumOcellusDefence(base:number):number {
  return Math.ceil(base*OCELLUS_DEFENCE_FLOOR_FRACTION);
}

/** Guard each weapon-specific landing, not an entire tick: the next hit
 * can calculate from the capped defence even within a multi-hit special.
 * Deflection blocks stat effects as well as damage. Valid unblocked
 * zero-damage weapon effects are retained (e.g. successful Weaken rolls).
 */
export function installOcellusStatGuard(hit:LandingHit,readStats:()=>CombatStats,
  baseStats:()=>CombatStats,deflected:boolean):void {
  const original=hit.beforeHit.bind(hit);
  hit.beforeHit=()=>{
    const stats=readStats();
    const before=COMBAT_STATS.map(key=>stats[key]);
    original();
    const current=readStats();
    if(deflected){
      COMBAT_STATS.forEach((key,i)=>{current[key]=before[i];});
      hit.damage=0;
    }
    const base=baseStats();
    current.defence=Math.max(minimumOcellusDefence(base.defence),current.defence);
    for(const stat of ["attack","strength","range","magic"] as const){
      current[stat]=Math.max(Math.ceil(base[stat]*OCELLUS_OFFENCE_FLOOR_FRACTION),current[stat]);
    }
  };
}
