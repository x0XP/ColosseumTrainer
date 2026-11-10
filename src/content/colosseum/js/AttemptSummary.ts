/**
 * Session-only encounter statistics. All counters correspond to actual engine
 * events; we deliberately do not infer damage dealt from Sol's HP, since users
 * can manually jump to a phase and alter his HP directly.
 */
export type AttemptAttack = "spear" | "shield" | "triple" | "grapple";
export type AttemptOutcome = "defeat" | "victory";
export type AttemptSummary = Readonly<{
  outcome: AttemptOutcome;
  elapsedTicks: number;
  solHpRemaining: number | null;
  solMaxHp: number | null;
  phaseReached: number | null;
  attacks: Readonly<Record<AttemptAttack, number>>;
  grapplesDefended: number;
  grapplesMissed: number;
}>;

const emptyCounts = (): Record<AttemptAttack, number> => ({
  spear: 0,
  shield: 0,
  triple: 0,
  grapple: 0,
});

export class AttemptRecorder {
  private startedAtTick: number | null = null;
  private attackCounts = emptyCounts();
  private defended = 0;
  private missed = 0;
  private finished: AttemptSummary | null = null;

  get summary(): AttemptSummary | null {
    return this.finished;
  }

  reset() {
    this.startedAtTick = null;
    this.attackCounts = emptyCounts();
    this.defended = 0;
    this.missed = 0;
    this.finished = null;
  }

  beginAtTick(tick: number) {
    if (this.startedAtTick === null && !this.finished && Number.isFinite(tick)) {
      this.startedAtTick = tick;
    }
  }

  recordAttack(kind: AttemptAttack) {
    if (!this.finished) this.attackCounts[kind]++;
  }

  recordGrappleDefence(defended: boolean) {
    if (this.finished) return;
    if (defended) this.defended++;
    else this.missed++;
  }

  finish(input: {
    outcome: AttemptOutcome;
    tick: number;
    solHp: number | null;
    solMaxHp: number | null;
    phaseId: number | null;
  }): AttemptSummary {
    if (this.finished) return this.finished;

    const maxHp = input.solMaxHp === null ? null : Math.max(0, Math.trunc(input.solMaxHp));
    const remaining = input.solHp === null || maxHp === null
      ? null : Math.max(0, Math.min(maxHp, Math.trunc(input.solHp)));
    const elapsed = this.startedAtTick === null ? 0
      : Math.max(0, Math.trunc(input.tick - this.startedAtTick + 1));

    this.finished = Object.freeze({
      outcome: input.outcome,
      elapsedTicks: elapsed,
      solHpRemaining: remaining,
      solMaxHp: maxHp,
      // phaseId -1 is the initial stage; 0..5 are the scripted phases.
      phaseReached: input.phaseId === null ? null : Math.max(1, Math.min(6, input.phaseId + 1)),
      attacks: Object.freeze({ ...this.attackCounts }),
      grapplesDefended: this.defended,
      grapplesMissed: this.missed,
    });
    return this.finished;
  }
}

/** OSRS game time, not wall-clock time (speed settings can be altered). */
export function formatAttemptTime(ticks: number): string {
  const seconds = Math.max(0, Math.floor(ticks * 0.6));
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
