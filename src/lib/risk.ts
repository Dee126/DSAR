/**
 * Risk Service — computes risk level for DSAR cases.
 *
 * Risk Levels:
 *   GREEN:  >yellowThreshold days remaining, no critical blockers
 *   YELLOW: redThreshold+1 to yellowThreshold days remaining,
 *           OR one milestone overdue but not legal due yet
 *   RED:    <=redThreshold days remaining OR legal overdue OR
 *           multiple milestone misses
 */

export type RiskLevel = "GREEN" | "YELLOW" | "RED";

export interface RiskConfig {
  yellowThresholdDays: number;  // default 14
  redThresholdDays: number;     // default 7
}

export const DEFAULT_RISK_CONFIG: RiskConfig = {
  yellowThresholdDays: 14,
  redThresholdDays: 7,
};

export interface MilestoneStatus {
  type: string;
  plannedDueAt: Date;
  completedAt: Date | null;
}

export interface RiskInput {
  daysRemaining: number;
  isOverdue: boolean;
  isPaused: boolean;
  extensionPending: boolean;        // extension applied but notification not sent
  milestones: MilestoneStatus[];
  isClosed: boolean;
}

export interface RiskResult {
  level: RiskLevel;
  reasons: string[];
}

/**
 * Compute the risk level and reasons for a case.
 */
export function computeRisk(
  input: RiskInput,
  config: RiskConfig = DEFAULT_RISK_CONFIG,
): RiskResult {
  if (input.isClosed) {
    return { level: "GREEN", reasons: ["Case is closed"] };
  }

  if (input.isPaused) {
    return { level: "GREEN", reasons: ["Clock is paused"] };
  }

  const reasons: string[] = [];
  let level: RiskLevel = "GREEN";

  // Check overdue (always RED)
  if (input.isOverdue) {
    level = "RED";
    reasons.push("Legal deadline overdue");
  }

  // Check days remaining thresholds
  if (!input.isOverdue) {
    if (input.daysRemaining <= config.redThresholdDays) {
      level = "RED";
      reasons.push(`Only ${input.daysRemaining} day(s) remaining (red threshold: ${config.redThresholdDays})`);
    } else if (input.daysRemaining <= config.yellowThresholdDays) {
      if (level !== "RED") level = "YELLOW";
      reasons.push(`${input.daysRemaining} day(s) remaining (yellow threshold: ${config.yellowThresholdDays})`);
    }
  }

  // Check milestones
  const now = new Date();
  const overdueMilestones = input.milestones.filter(
    (m) => !m.completedAt && new Date(m.plannedDueAt) < now,
  );

  if (overdueMilestones.length > 1) {
    level = "RED";
    reasons.push(`${overdueMilestones.length} milestones overdue: ${overdueMilestones.map((m) => m.type).join(", ")}`);
  } else if (overdueMilestones.length === 1) {
    if (level !== "RED") level = "YELLOW";
    reasons.push(`Milestone overdue: ${overdueMilestones[0].type}`);
  }

  // Check extension notification pending
  if (input.extensionPending) {
    if (level !== "RED") level = "YELLOW";
    reasons.push("Extension notification pending");
  }

  if (reasons.length === 0) {
    reasons.push("On track");
  }

  return { level, reasons };
}

/**
 * Determine if an escalation should be created based on risk transition.
 */
export function shouldEscalate(
  previousLevel: RiskLevel,
  currentLevel: RiskLevel,
): boolean {
  if (currentLevel === "GREEN") return false;
  if (previousLevel === currentLevel) return false;
  // Escalate on any transition to YELLOW or RED
  return true;
}

/**
 * Map risk level to escalation severity.
 */
export function riskToEscalationSeverity(
  level: RiskLevel,
  isOverdue: boolean,
): "YELLOW_WARNING" | "RED_ALERT" | "OVERDUE_BREACH" {
  if (isOverdue) return "OVERDUE_BREACH";
  if (level === "RED") return "RED_ALERT";
  return "YELLOW_WARNING";
}
