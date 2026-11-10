import { AttemptRecorder, formatAttemptTime } from "../js/AttemptSummary";

describe("Sol post-attempt statistics", () => {
  test("counts only actual attacks and grapple results", () => {
    const recorder = new AttemptRecorder();
    recorder.beginAtTick(100);
    recorder.beginAtTick(400);
    recorder.recordAttack("spear");
    recorder.recordAttack("triple");
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
    expect(result.attacks).toEqual({ spear: 1, shield: 0, triple: 1, grapple: 1 });
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
    expect(second.grapplesMissed).toBe(0);
  });

  test("reset clears the result and all counts for the next attempt", () => {
    const recorder = new AttemptRecorder();
    recorder.beginAtTick(5);
    recorder.recordAttack("spear");
    recorder.finish({ outcome: "defeat", tick: 8, solHp: 1200, solMaxHp: 1500, phaseId: -1 });
    recorder.reset();
    expect(recorder.summary).toBeNull();
    recorder.beginAtTick(30);
    const second = recorder.finish({
      outcome: "victory", tick: 129, solHp: 0, solMaxHp: 1500, phaseId: 5,
    });
    expect(second.elapsedTicks).toBe(100);
    expect(second.attacks.spear).toBe(0);
    expect(second.phaseReached).toBe(6);
    expect(formatAttemptTime(second.elapsedTicks)).toBe("01:00");
  });
});
