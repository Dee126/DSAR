import { describe, it, expect } from "vitest";
import {
  computeRisk,
  shouldEscalate,
  riskToEscalationSeverity,
  DEFAULT_RISK_CONFIG,
  type RiskInput,
  type MilestoneStatus,
} from "@/lib/risk";

/* ── Helpers ───────────────────────────────────────────────────────── */

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function baseInput(overrides: Partial<RiskInput> = {}): RiskInput {
  return {
    daysRemaining: 20,
    isOverdue: false,
    isPaused: false,
    extensionPending: false,
    milestones: [],
    isClosed: false,
    ...overrides,
  };
}

function milestone(type: string, plannedDaysFromNow: number, completed: boolean): MilestoneStatus {
  return {
    type,
    plannedDueAt: plannedDaysFromNow >= 0 ? daysFromNow(plannedDaysFromNow) : daysAgo(-plannedDaysFromNow),
    completedAt: completed ? daysAgo(1) : null,
  };
}

/* ── computeRisk ────────────────────────────────────────────────────── */

describe("computeRisk", () => {
  describe("GREEN risk", () => {
    it("returns GREEN for closed case", () => {
      const result = computeRisk(baseInput({ isClosed: true, daysRemaining: -5, isOverdue: true }));
      expect(result.level).toBe("GREEN");
      expect(result.reasons).toContain("Case is closed");
    });

    it("returns GREEN for paused case", () => {
      const result = computeRisk(baseInput({ isPaused: true, daysRemaining: 3 }));
      expect(result.level).toBe("GREEN");
      expect(result.reasons).toContain("Clock is paused");
    });

    it("returns GREEN when plenty of time remaining", () => {
      const result = computeRisk(baseInput({ daysRemaining: 25 }));
      expect(result.level).toBe("GREEN");
      expect(result.reasons).toContain("On track");
    });

    it("returns GREEN at exactly yellowThreshold + 1", () => {
      const result = computeRisk(baseInput({ daysRemaining: 15 }));
      expect(result.level).toBe("GREEN");
    });
  });

  describe("YELLOW risk", () => {
    it("returns YELLOW when within yellow threshold", () => {
      const result = computeRisk(baseInput({ daysRemaining: 14 }));
      expect(result.level).toBe("YELLOW");
      expect(result.reasons[0]).toContain("14 day(s) remaining");
    });

    it("returns YELLOW at redThreshold + 1", () => {
      const result = computeRisk(baseInput({ daysRemaining: 8 }));
      expect(result.level).toBe("YELLOW");
    });

    it("returns YELLOW for one overdue milestone", () => {
      const result = computeRisk(
        baseInput({
          daysRemaining: 20,
          milestones: [
            milestone("IDV_COMPLETE", -2, false), // overdue by 2 days
            milestone("COLLECTION_COMPLETE", 5, false),
          ],
        }),
      );
      expect(result.level).toBe("YELLOW");
      expect(result.reasons.some((r) => r.includes("Milestone overdue"))).toBe(true);
    });

    it("returns YELLOW for extension notification pending", () => {
      const result = computeRisk(baseInput({ daysRemaining: 20, extensionPending: true }));
      expect(result.level).toBe("YELLOW");
      expect(result.reasons).toContain("Extension notification pending");
    });
  });

  describe("RED risk", () => {
    it("returns RED when overdue", () => {
      const result = computeRisk(baseInput({ daysRemaining: -5, isOverdue: true }));
      expect(result.level).toBe("RED");
      expect(result.reasons).toContain("Legal deadline overdue");
    });

    it("returns RED at exactly red threshold", () => {
      const result = computeRisk(baseInput({ daysRemaining: 7 }));
      expect(result.level).toBe("RED");
    });

    it("returns RED below red threshold", () => {
      const result = computeRisk(baseInput({ daysRemaining: 3 }));
      expect(result.level).toBe("RED");
    });

    it("returns RED for multiple overdue milestones", () => {
      const result = computeRisk(
        baseInput({
          daysRemaining: 20,
          milestones: [
            milestone("IDV_COMPLETE", -5, false),
            milestone("COLLECTION_COMPLETE", -1, false),
          ],
        }),
      );
      expect(result.level).toBe("RED");
      expect(result.reasons.some((r) => r.includes("milestones overdue"))).toBe(true);
    });

    it("returns RED at 0 days remaining", () => {
      const result = computeRisk(baseInput({ daysRemaining: 0 }));
      expect(result.level).toBe("RED");
    });
  });

  describe("custom thresholds", () => {
    it("respects custom yellow/red thresholds", () => {
      const config = { yellowThresholdDays: 21, redThresholdDays: 10 };
      const result = computeRisk(baseInput({ daysRemaining: 15 }), config);
      expect(result.level).toBe("YELLOW");
    });

    it("uses custom red threshold", () => {
      const config = { yellowThresholdDays: 21, redThresholdDays: 14 };
      const result = computeRisk(baseInput({ daysRemaining: 14 }), config);
      expect(result.level).toBe("RED");
    });
  });

  describe("precedence", () => {
    it("closed case overrides everything", () => {
      const result = computeRisk(
        baseInput({
          isClosed: true,
          isOverdue: true,
          daysRemaining: -10,
          milestones: [milestone("IDV_COMPLETE", -5, false), milestone("COLLECTION_COMPLETE", -3, false)],
        }),
      );
      expect(result.level).toBe("GREEN");
    });

    it("paused case overrides time-based risk", () => {
      const result = computeRisk(baseInput({ isPaused: true, daysRemaining: 2 }));
      expect(result.level).toBe("GREEN");
    });

    it("overdue does not override closed", () => {
      const result = computeRisk(baseInput({ isClosed: true, isOverdue: true }));
      expect(result.level).toBe("GREEN");
    });
  });
});

/* ── shouldEscalate ─────────────────────────────────────────────────── */

describe("shouldEscalate", () => {
  it("returns true for GREEN → YELLOW transition", () => {
    expect(shouldEscalate("GREEN", "YELLOW")).toBe(true);
  });

  it("returns true for GREEN → RED transition", () => {
    expect(shouldEscalate("GREEN", "RED")).toBe(true);
  });

  it("returns true for YELLOW → RED transition", () => {
    expect(shouldEscalate("YELLOW", "RED")).toBe(true);
  });

  it("returns false when staying at same level", () => {
    expect(shouldEscalate("YELLOW", "YELLOW")).toBe(false);
    expect(shouldEscalate("RED", "RED")).toBe(false);
    expect(shouldEscalate("GREEN", "GREEN")).toBe(false);
  });

  it("returns false when transitioning to GREEN", () => {
    expect(shouldEscalate("YELLOW", "GREEN")).toBe(false);
    expect(shouldEscalate("RED", "GREEN")).toBe(false);
  });

  it("returns true for RED → YELLOW (de-escalation still triggers)", () => {
    // De-escalation to YELLOW from RED triggers since level changed and current != GREEN
    expect(shouldEscalate("RED", "YELLOW")).toBe(true);
  });
});

/* ── riskToEscalationSeverity ───────────────────────────────────────── */

describe("riskToEscalationSeverity", () => {
  it("returns OVERDUE_BREACH when overdue", () => {
    expect(riskToEscalationSeverity("RED", true)).toBe("OVERDUE_BREACH");
  });

  it("returns OVERDUE_BREACH for YELLOW + overdue", () => {
    // Overdue flag takes precedence
    expect(riskToEscalationSeverity("YELLOW", true)).toBe("OVERDUE_BREACH");
  });

  it("returns RED_ALERT for RED without overdue", () => {
    expect(riskToEscalationSeverity("RED", false)).toBe("RED_ALERT");
  });

  it("returns YELLOW_WARNING for YELLOW without overdue", () => {
    expect(riskToEscalationSeverity("YELLOW", false)).toBe("YELLOW_WARNING");
  });

  it("returns YELLOW_WARNING for GREEN (edge case)", () => {
    expect(riskToEscalationSeverity("GREEN", false)).toBe("YELLOW_WARNING");
  });
});
