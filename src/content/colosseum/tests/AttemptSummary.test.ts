import { AttemptRecorder, defenceRatePercent, formatAttemptTime } from "../js/AttemptSummary";

describe("Sol post-attempt statistics", () => {
  test("defence percentage is rounded, clamped and undefined for 0 / 0", () => {
    expect(defenceRatePercent(5, 6)).toBe(83);
    expect(defenceRatePercent(2, 3)).toBe(67);
    expect(defenceRatePercent(0, 4)).toBe(0);
    expect(defenceRatePercent(8, 4)).toBe(100);
    expect(defenceRatePercent(-1, 4)).toBe(0);
    expect(defenceRatePercent(0, 0)).toBeNull();
    expect(defenceRatePercent(0, -1)).toBeNull();
    expect(defenceRatePercent(NaN, 3)).toBeNull();
  });

  test("counts only actual attacks and grapple results", () => {
    const recorder = new AttemptRecorder();
    recorder.beginAtTick(100);
    recorder.beginAtTick(400);
    recorder.recordAttack("spear");
    recorder.recordDodge("spear", true);
    recorder.recordAttack("shield");
    recorder.recordDodge("shield", false);
    recorder.recordAttack("triple");
    recorder.recordParryHit(true);
    recorder.recordParryHit(false);
    recorder.recordParryHit(true);
    recorder.recordAttack("grapple");
    recorder.recordGrappleDefence(true);
    recorder.recordGrappleDefence(false);

    const result = recorder.finish({
      outcome: "defeat", tick: 150, solHp: 428, solMaxHp: 1500, phaseId: 3,
    });
    expect(result.outcome).toBe("defeat");
    expect(result.elapsedTicks).toBe(51);
    expect(result.solHpRemaining).toBe(428);
    expect(result.phaseReached).toBe(4);
    expect(result.attacks).toEqual({ spear: 1, shield: 1, triple: 1, grapple: 1 });
    expect(result.dodges).toEqual({ spear: 1, shield: 0 });
    expect(result.parriesDefended).toBe(2);
    expect(result.parriesAttempted).toBe(3);
    expect(result.grapplesDefended).toBe(1);
    expect(result.grapplesMissed).toBe(1);
    expect(formatAttemptTime(result.elapsedTicks)).toBe("00:30");
  });

  test("final result is frozen and ignores later callbacks", () => {
    const recorder = new AttemptRecorder();
    recorder.recordAttack("shield");
    const first = recorder.finish({
      outcome: "victory", tick: 2, solHp: -15, solMaxHp: 1500, phaseId: 5,
    });
    recorder.recordAttack("spear");
    recorder.recordDodge("shield", true);
    recorder.recordParryHit(true);
    recorder.recordGrappleDefence(false);
    const second = recorder.finish({
      outcome: "defeat", tick: 50, solHp: 100, solMaxHp: 1500, phaseId: 1,
    });
    expect(second).toBe(first);
    expect(second.outcome).toBe("victory");
    expect(second.solHpRemaining).toBe(0);
    expect(second.elapsedTicks).toBe(0);
    expect(second.phaseReached).toBe(6);
    expect(second.attacks.spear).toBe(0);
    expect(second.dodges.shield).toBe(0);
    expect(second.parriesAttempted).toBe(0);
    expect(second.grapplesMissed).toBe(0);
  });

  test("dodges are capped by the number of attacks and misses are not counted", () => {
    const recorder = new AttemptRecorder();
    recorder.recordDodge("spear", true);
    recorder.recordAttack("spear");
    recorder.recordDodge("spear", false);
    recorder.recordDodge("spear", true);
    recorder.recordDodge("spear", true);
    recorder.recordAttack("shield");
    recorder.recordDodge("shield", false);
    const result = recorder.finish({
      outcome: "defeat", tick: 100, solHp: 900, solMaxHp: 1500, phaseId: 1,
    });
    expect(result.attacks.spear).toBe(1);
    expect(result.dodges.spear).toBe(1);
    expect(result.attacks.shield).toBe(1);
    expect(result.dodges.shield).toBe(0);
  });

  test("reset clears the result and all counts for the next attempt", () => {
    const recorder = new AttemptRecorder();
    recorder.beginAtTick(5);
    recorder.recordAttack("spear");
    recorder.recordDodge("spear", true);
    recorder.recordParryHit(true);
    recorder.finish({ outcome: "defeat", tick: 8, solHp: 1200, solMaxHp: 1500, phaseId: -1 });
    recorder.reset();
    expect(recorder.summary).toBeNull();
    recorder.beginAtTick(30);
    const second = recorder.finish({
      outcome: "victory", tick: 129, solHp: 0, solMaxHp: 1500, phaseId: 5,
    });
    expect(second.elapsedTicks).toBe(100);
    expect(second.attacks.spear).toBe(0);
    expect(second.dodges.spear).toBe(0);
    expect(second.parriesDefended).toBe(0);
    expect(second.parriesAttempted).toBe(0);
    expect(second.phaseReached).toBe(6);
    expect(formatAttemptTime(second.elapsedTicks)).toBe("01:00");
  });
});
