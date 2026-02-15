/**
 * Deadline Service — computes legal due dates, handles extensions and pauses.
 *
 * GDPR Art. 12: respond within 1 calendar month of receipt;
 * extension up to 2 additional months if complex/numerous.
 *
 * Supports:
 * - Calendar days (default) and business days
 * - Holiday exclusion (business days mode)
 * - Timezone-aware computation
 * - Extension with justification
 * - Pause/resume with approved-by tracking
 */

export interface SlaConfig {
  initialDeadlineDays: number;
  extensionMaxDays: number;
  useBusinessDays: boolean;
  timezone: string;
  yellowThresholdDays: number;
  redThresholdDays: number;
  milestoneIdvDays: number;
  milestoneCollectionDays: number;
  milestoneDraftDays: number;
  milestoneLegalDays: number;
}

export const DEFAULT_SLA_CONFIG: SlaConfig = {
  initialDeadlineDays: 30,
  extensionMaxDays: 60,
  useBusinessDays: false,
  timezone: "Europe/Berlin",
  yellowThresholdDays: 14,
  redThresholdDays: 7,
  milestoneIdvDays: 7,
  milestoneCollectionDays: 14,
  milestoneDraftDays: 21,
  milestoneLegalDays: 25,
};

export interface HolidayDate {
  date: Date;
}

/**
 * Check if a date is a weekend (Saturday or Sunday).
 */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/**
 * Check if a date is a holiday.
 */
export function isHoliday(date: Date, holidays: HolidayDate[]): boolean {
  const dateStr = date.toISOString().split("T")[0];
  return holidays.some((h) => {
    const hStr = new Date(h.date).toISOString().split("T")[0];
    return hStr === dateStr;
  });
}

/**
 * Add calendar days to a date.
 */
export function addCalendarDays(start: Date, days: number): Date {
  const result = new Date(start);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Add business days to a date, skipping weekends and holidays.
 */
export function addBusinessDays(
  start: Date,
  days: number,
  holidays: HolidayDate[] = [],
): Date {
  const result = new Date(start);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    if (!isWeekend(result) && !isHoliday(result, holidays)) {
      added++;
    }
  }
  return result;
}

/**
 * Count business days between two dates.
 */
export function countBusinessDays(
  start: Date,
  end: Date,
  holidays: HolidayDate[] = [],
): number {
  let count = 0;
  const current = new Date(start);
  while (current < end) {
    current.setDate(current.getDate() + 1);
    if (!isWeekend(current) && !isHoliday(current, holidays)) {
      count++;
    }
  }
  return count;
}

/**
 * Calculate the legal due date from the received date.
 */
export function calculateLegalDueDate(
  receivedAt: Date,
  config: SlaConfig,
  holidays: HolidayDate[] = [],
): Date {
  if (config.useBusinessDays) {
    return addBusinessDays(receivedAt, config.initialDeadlineDays, holidays);
  }
  return addCalendarDays(receivedAt, config.initialDeadlineDays);
}

/**
 * Compute the effective due date considering extensions and pauses.
 */
export function computeEffectiveDueDate(params: {
  legalDueAt: Date;
  extensionDays?: number | null;
  totalPausedDays?: number;
  useBusinessDays: boolean;
  holidays?: HolidayDate[];
}): Date {
  const { legalDueAt, extensionDays, totalPausedDays = 0, useBusinessDays, holidays = [] } = params;

  let effective = new Date(legalDueAt);

  // Add extension days
  if (extensionDays && extensionDays > 0) {
    if (useBusinessDays) {
      effective = addBusinessDays(effective, extensionDays, holidays);
    } else {
      effective = addCalendarDays(effective, extensionDays);
    }
  }

  // Add paused days
  if (totalPausedDays > 0) {
    if (useBusinessDays) {
      effective = addBusinessDays(effective, totalPausedDays, holidays);
    } else {
      effective = addCalendarDays(effective, totalPausedDays);
    }
  }

  return effective;
}

/**
 * Calculate days remaining from now to the effective due date.
 */
export function calculateDaysRemaining(effectiveDueAt: Date, now?: Date): number {
  const current = now ?? new Date();
  const diffMs = effectiveDueAt.getTime() - current.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Calculate the number of paused days between pause start and resume/now.
 */
export function calculatePausedDays(
  pausedAt: Date,
  resumedAt?: Date | null,
): number {
  const end = resumedAt ?? new Date();
  const diffMs = end.getTime() - pausedAt.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

/**
 * Validate an extension request.
 */
export function validateExtension(
  requestedDays: number,
  existingExtensionDays: number | null | undefined,
  maxExtensionDays: number,
): { valid: boolean; error?: string } {
  const currentExtension = existingExtensionDays ?? 0;
  const totalAfter = currentExtension + requestedDays;

  if (requestedDays <= 0) {
    return { valid: false, error: "Extension days must be positive" };
  }

  if (totalAfter > maxExtensionDays) {
    return {
      valid: false,
      error: `Extension would exceed maximum of ${maxExtensionDays} days (current: ${currentExtension}, requested: ${requestedDays})`,
    };
  }

  return { valid: true };
}
