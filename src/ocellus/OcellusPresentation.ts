import type { AttackStyle, PhaseFrame } from "./Phase4Rules";
import { specialStyle } from "./Phase4Rules";

/** Original cache 2746 animation frames and server-triggered sound effects.
 * Delays are fractions of a 600ms RuneScape tick, measured from fight footage.
 * The SDK plays embedded sequence frame sounds separately.
 */
export type GameSound = Readonly<{ id: number; delayMs: number }>;
export type OcellusPresentation = Readonly<{
  bossAnimation: number | null;
  bossSpotAnims: readonly number[];
  playerSpotAnims: readonly number[];
  sounds: readonly GameSound[];
}>;

const cue = (id: number, delayMs = 0): GameSound => ({ id, delayMs });

/** Deterministic visual script, keyed to the simulator's actual fight tick. */
export function presentationAt(frame: PhaseFrame, seed: number): OcellusPresentation {
  const offset = frame.offset;
  const events = frame.events.map(({ kind }) => kind);
  const contains = (kind: string) => events.includes(kind as typeof events[number]);
  const bossSpotAnims: number[] = [];
  const playerSpotAnims: number[] = [];
  const sounds: GameSound[] = [];
  let bossAnimation: number | null = null;

  if (frame.stage === "lead-in" && frame.tick === 5) sounds.push(cue(12490));
  if (contains("inner-start")) bossAnimation = 14863; // 2-tick rise
  if (frame.stage === "inner-void" && offset === 21) bossAnimation = 14865; // land 1 tick before clear
  if (contains("outer-start")) sounds.push(cue(12497));
  if (contains("lifeforce-tell")) {
    bossAnimation = 14855;
    playerSpotAnims.push(4313);
  }
  if (contains("lifeforce-hit") && frame.stage === "inner-void") {
    bossSpotAnims.push(4316);
  }
  if (frame.cycle > 0 && (offset === 6 || offset === 37)) {
    playerSpotAnims.push(4340);
    sounds.push(cue(12638));
  }
  if (contains("explosion-mark")) sounds.push(cue(12537));

  // Sound cues occur at these documented offsets from each special's tell.
  // The melee and ranged impact audio are not played for other styles.
  const transitionTell = offset === 24 ? 24 : offset === 52 ? 52 : null;
  const transitionStart =
    offset >= 24 && offset <= 29 ? 24 :
    offset >= 52 && offset <= 57 ? 52 : null;
  const transitionStyle: AttackStyle | null = transitionStart === null
    ? null : specialStyle(seed, frame.cycle, transitionStart === 24 ? 0 : 1);
  if (transitionTell !== null) {
    bossAnimation = 14844;
    if (transitionStyle === "melee") sounds.push(cue(12572, 60));
  }
  if (transitionStart !== null) {
    const sinceTell = offset - transitionStart;
    if (transitionStyle === "melee" && sinceTell === 5) sounds.push(cue(12567, 60));
    if (transitionStyle === "range" && sinceTell === 4) sounds.push(cue(12555, 240));
    if (transitionStyle === "range" && sinceTell === 5) sounds.push(cue(12556, 60));
    if (transitionStyle === "magic" && sinceTell === 2) sounds.push(cue(12554, 120));
  }

  return { bossAnimation, bossSpotAnims, playerSpotAnims, sounds };
}

/** The boss's real death sequence is 440 client cycles, approximately 15 ticks. */
export const OCELLUS_DEATH_TICKS = 15;
export const OCELLUS_DEATH_EFFECTS = [4274, 4275, 4276] as const;
export const RIFT_BURST_EFFECT = 4306;
export const RIFT_CHARGE_TICKS = 30;

/** A simultaneous group of Rift detonations is one player-wide flare,
 * not one restarted spotanim per dying NPC. */
export function riftBurstVisual(effects: readonly Readonly<{ kind: string }>[]): number | null {
  return effects.some(({ kind }) => kind === "rift-detonate") ? RIFT_BURST_EFFECT : null;
}

/** 28 Oct 2026 increased the pre-bomb warning's volume. The actual server
 * gain is not published; use a conservative 2x trainer-only gain relative
 * to other cues, preserving the native waveform and both audio toggles. */
export function areaCueVolume(id:number):number {return id===12638?0.2:0.1;}
