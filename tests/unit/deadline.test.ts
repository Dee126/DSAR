import { describe, it, expect } from "vitest";
import {
  isWeekend,
  isHoliday,
  addCalendarDays,
  addBusinessDays,
  countBusinessDays,
  calculateLegalDueDate,
  computeEffectiveDueDate,
  calculateDaysRemaining,
  calculatePausedDays,
  validateExtension,
  DEFAULT_SLA_CONFIG,
  type HolidayDate,
} from "@/lib/deadline";

/* ── Helpers ───────────────────────────────────────────────────────── */

function date(s: string): Date {
  return new Date(s + "T00:00:00Z");
}

const GERMAN_HOLIDAYS: HolidayDate[] = [
  { date: date("2026-01-01") }, // New Year
  { date: date("2026-04-03") }, // Good Friday
  { date: date("2026-04-06") }, // Easter Monday
  { date: date("2026-05-01") }, // Labour Day
  { date: date("2026-12-25") }, // Christmas
];

/* ── isWeekend ──────────────────────────────────────────────────────── */

describe("isWeekend", () => {
  it("returns true for Saturday", () => {
    // 2026-02-14 is a Saturday
    expect(isWeekend(date("2026-02-14"))).toBe(true);
  });

  it("returns true for Sunday", () => {
    // 2026-02-15 is a Sunday
    expect(isWeekend(date("2026-02-15"))).toBe(true);
  });

  it("returns false for a weekday", () => {
    // 2026-02-16 is a Monday
    expect(isWeekend(date("2026-02-16"))).toBe(false);
  });

  it("returns false for Wednesday", () => {
    // 2026-02-11 is a Wednesday
    expect(isWeekend(date("2026-02-11"))).toBe(false);
  });
});

/* ── isHoliday ──────────────────────────────────────────────────────── */

describe("isHoliday", () => {
  it("detects a holiday", () => {
    expect(isHoliday(date("2026-01-01"), GERMAN_HOLIDAYS)).toBe(true);
  });

  it("returns false for a non-holiday", () => {
    expect(isHoliday(date("2026-01-02"), GERMAN_HOLIDAYS)).toBe(false);
  });

  it("returns false with empty holiday list", () => {
    expect(isHoliday(date("2026-01-01"), [])).toBe(false);
  });
});

/* ── addCalendarDays ────────────────────────────────────────────────── */

describe("addCalendarDays", () => {
  it("adds 30 days correctly", () => {
    const result = addCalendarDays(date("2026-02-01"), 30);
    expect(result.toISOString().split("T")[0]).toBe("2026-03-03");
  });

  it("adds 0 days returns same date", () => {
    const result = addCalendarDays(date("2026-06-15"), 0);
    expect(result.toISOString().split("T")[0]).toBe("2026-06-15");
  });

  it("handles month boundary (January → February)", () => {
    const result = addCalendarDays(date("2026-01-15"), 30);
    expect(result.toISOString().split("T")[0]).toBe("2026-02-14");
  });

  it("handles year boundary", () => {
    const result = addCalendarDays(date("2025-12-20"), 15);
    expect(result.toISOString().split("T")[0]).toBe("2026-01-04");
  });
});

/* ── addBusinessDays ────────────────────────────────────────────────── */

describe("addBusinessDays", () => {
  it("adds 5 business days from Monday", () => {
    // 2026-02-16 is Monday → day+1: Tue(1), Wed(2), Thu(3), Fri(4), Mon Feb 23(5)
    const result = addBusinessDays(date("2026-02-16"), 5);
    expect(result.toISOString().split("T")[0]).toBe("2026-02-23");
  });

  it("skips weekends", () => {
    // 2026-02-13 is Friday → 1 biz day = Monday 2026-02-16
    const result = addBusinessDays(date("2026-02-13"), 1);
    expect(result.toISOString().split("T")[0]).toBe("2026-02-16");
  });

  it("skips holidays", () => {
    // 2026-04-30 is Thursday, May 1 is Labour Day (Friday) → 1 biz day = Monday May 4
    const result = addBusinessDays(date("2026-04-30"), 1, GERMAN_HOLIDAYS);
    expect(result.toISOString().split("T")[0]).toBe("2026-05-04");
  });

  it("handles multiple holidays and weekends", () => {
    // 2026-04-02 is Thursday, Apr 3 is Good Friday, Apr 4-5 weekend, Apr 6 Easter Monday
    // → 1 biz day from Apr 2 = Tuesday Apr 7
    const result = addBusinessDays(date("2026-04-02"), 1, GERMAN_HOLIDAYS);
    expect(result.toISOString().split("T")[0]).toBe("2026-04-07");
  });

  it("adds 10 business days from Monday", () => {
    // 2026-02-16 Mon → Tue(1)..Mon(5), Tue(6)..Mon(10) → Mon 2026-03-02
    const result = addBusinessDays(date("2026-02-16"), 10);
    expect(result.toISOString().split("T")[0]).toBe("2026-03-02");
  });
});

/* ── countBusinessDays ──────────────────────────────────────────────── */

describe("countBusinessDays", () => {
  it("counts 5 business days in a standard work week", () => {
    // Mon Feb 16 to Fri Feb 20 → 4 biz days (Tue, Wed, Thu, Fri counted)
    // Actually: Mon to Fri → count from start+1 to end → Tue,Wed,Thu,Fri = 4
    const count = countBusinessDays(date("2026-02-16"), date("2026-02-20"));
    expect(count).toBe(4);
  });

  it("counts 0 for same date", () => {
    expect(countBusinessDays(date("2026-02-16"), date("2026-02-16"))).toBe(0);
  });

  it("excludes weekends", () => {
    // Fri Feb 13 to Mon Feb 16 → spans weekend, count = 1 (Mon only)
    const count = countBusinessDays(date("2026-02-13"), date("2026-02-16"));
    expect(count).toBe(1);
  });

  it("excludes holidays", () => {
    // Thu Apr 2 to Tue Apr 7 → Apr 3 Good Friday, Apr 4-5 weekend, Apr 6 Easter Monday
    // Only Apr 7 (Tue) is a business day → count = 1
    const count = countBusinessDays(date("2026-04-02"), date("2026-04-07"), GERMAN_HOLIDAYS);
    expect(count).toBe(1);
  });
});

/* ── calculateLegalDueDate ──────────────────────────────────────────── */

describe("calculateLegalDueDate", () => {
  it("returns received + 30 calendar days with default config", () => {
    const received = date("2026-02-01");
    const due = calculateLegalDueDate(received, DEFAULT_SLA_CONFIG);
    expect(due.toISOString().split("T")[0]).toBe("2026-03-03");
  });

  it("returns received + 30 business days when useBusinessDays is true", () => {
    const config = { ...DEFAULT_SLA_CONFIG, useBusinessDays: true };
    const received = date("2026-02-16"); // Monday
    const due = calculateLegalDueDate(received, config);
    // 30 biz days counting from day after Mon Feb 16 → Mon Mar 30
    expect(due.toISOString().split("T")[0]).toBe("2026-03-30");
  });

  it("uses custom deadline days", () => {
    const config = { ...DEFAULT_SLA_CONFIG, initialDeadlineDays: 45 };
    const received = date("2026-01-01");
    const due = calculateLegalDueDate(received, config);
    expect(due.toISOString().split("T")[0]).toBe("2026-02-15");
  });
});

/* ── computeEffectiveDueDate ────────────────────────────────────────── */

describe("computeEffectiveDueDate", () => {
  it("returns legal due date when no extensions or pauses", () => {
    const legal = date("2026-03-15");
    const effective = computeEffectiveDueDate({
      legalDueAt: legal,
      useBusinessDays: false,
    });
    expect(effective.toISOString().split("T")[0]).toBe("2026-03-15");
  });

  it("adds extension days", () => {
    const legal = date("2026-03-15");
    const effective = computeEffectiveDueDate({
      legalDueAt: legal,
      extensionDays: 30,
      useBusinessDays: false,
    });
    expect(effective.toISOString().split("T")[0]).toBe("2026-04-14");
  });

  it("adds paused days", () => {
    const legal = date("2026-03-15");
    const effective = computeEffectiveDueDate({
      legalDueAt: legal,
      totalPausedDays: 5,
      useBusinessDays: false,
    });
    expect(effective.toISOString().split("T")[0]).toBe("2026-03-20");
  });

  it("adds both extension and paused days", () => {
    const legal = date("2026-03-15");
    const effective = computeEffectiveDueDate({
      legalDueAt: legal,
      extensionDays: 10,
      totalPausedDays: 3,
      useBusinessDays: false,
    });
    expect(effective.toISOString().split("T")[0]).toBe("2026-03-28");
  });

  it("handles business days mode for extensions", () => {
    const legal = date("2026-02-20"); // Friday
    const effective = computeEffectiveDueDate({
      legalDueAt: legal,
      extensionDays: 5,
      useBusinessDays: true,
    });
    // 5 biz days from Friday = next Friday
    expect(effective.toISOString().split("T")[0]).toBe("2026-02-27");
  });
});

/* ── calculateDaysRemaining ─────────────────────────────────────────── */

describe("calculateDaysRemaining", () => {
  it("returns positive days when due date is in the future", () => {
    const due = new Date();
    due.setDate(due.getDate() + 10);
    const remaining = calculateDaysRemaining(due);
    expect(remaining).toBe(10);
  });

  it("returns 0 when due date is today", () => {
    const now = new Date();
    // Remove time component for cleaner test
    const due = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const remaining = calculateDaysRemaining(due, due);
    expect(remaining).toBe(0);
  });

  it("returns negative when overdue", () => {
    const now = date("2026-03-15");
    const due = date("2026-03-10");
    const remaining = calculateDaysRemaining(due, now);
    expect(remaining).toBe(-5);
  });
});

/* ── calculatePausedDays ────────────────────────────────────────────── */

describe("calculatePausedDays", () => {
  it("calculates days between pause and resume", () => {
    const paused = date("2026-02-10");
    const resumed = date("2026-02-15");
    expect(calculatePausedDays(paused, resumed)).toBe(5);
  });

  it("returns 0 when paused and resumed same day", () => {
    const d = date("2026-02-10");
    expect(calculatePausedDays(d, d)).toBe(0);
  });

  it("uses current date when no resume date", () => {
    const paused = new Date();
    paused.setDate(paused.getDate() - 3);
    const days = calculatePausedDays(paused);
    expect(days).toBeGreaterThanOrEqual(3);
  });
});

/* ── validateExtension ──────────────────────────────────────────────── */

describe("validateExtension", () => {
  it("validates a valid first extension", () => {
    const result = validateExtension(30, 0, 60);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("validates a valid incremental extension", () => {
    const result = validateExtension(15, 30, 60);
    expect(result.valid).toBe(true);
  });

  it("rejects extension exceeding max", () => {
    const result = validateExtension(31, 30, 60);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("exceed maximum");
  });

  it("rejects zero days", () => {
    const result = validateExtension(0, 0, 60);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("positive");
  });

  it("rejects negative days", () => {
    const result = validateExtension(-5, 0, 60);
    expect(result.valid).toBe(false);
  });

  it("handles null existing extension", () => {
    const result = validateExtension(60, null, 60);
    expect(result.valid).toBe(true);
  });

  it("handles undefined existing extension", () => {
    const result = validateExtension(60, undefined, 60);
    expect(result.valid).toBe(true);
  });

  it("rejects when exactly at max with new request", () => {
    const result = validateExtension(1, 60, 60);
    expect(result.valid).toBe(false);
  });
});
