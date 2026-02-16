// ─── Module 8.4: Internal Event Bus (Stub for future SIEM integration) ──────
//
// Emits domain events for audit, access, deletion, and other compliance events.
// In production, this would forward to a message queue or SIEM system.

export interface DomainEvent {
  type: string;
  tenantId: string;
  timestamp: Date;
  payload: Record<string, unknown>;
  correlationId?: string;
}

type EventHandler = (event: DomainEvent) => void | Promise<void>;

class EventBus {
  private handlers: Map<string, EventHandler[]> = new Map();
  private globalHandlers: EventHandler[] = [];

  on(type: string, handler: EventHandler): void {
    const existing = this.handlers.get(type) || [];
    existing.push(handler);
    this.handlers.set(type, existing);
  }

  onAll(handler: EventHandler): void {
    this.globalHandlers.push(handler);
  }

  async emit(type: string, tenantId: string, payload: Record<string, unknown>, correlationId?: string): Promise<void> {
    const event: DomainEvent = {
      type,
      tenantId,
      timestamp: new Date(),
      payload,
      correlationId,
    };

    // Fire type-specific handlers
    const handlers = this.handlers.get(type) || [];
    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (err) {
        console.error(`[EventBus] handler error for ${type}:`, err);
      }
    }

    // Fire global handlers
    for (const handler of this.globalHandlers) {
      try {
        await handler(event);
      } catch (err) {
        console.error(`[EventBus] global handler error for ${type}:`, err);
      }
    }
  }

  off(type: string, handler: EventHandler): void {
    const existing = this.handlers.get(type) || [];
    this.handlers.set(type, existing.filter(h => h !== handler));
  }

  clear(): void {
    this.handlers.clear();
    this.globalHandlers = [];
  }
}

// Singleton
export const eventBus = new EventBus();

// Event type constants
export const EventTypes = {
  // Audit
  AUDIT_LOG_CREATED: "audit.log.created",
  AUDIT_INTEGRITY_VIOLATION: "audit.integrity.violation",
  // Access
  ACCESS_ALLOWED: "access.allowed",
  ACCESS_DENIED: "access.denied",
  // SoD
  SOD_VIOLATION_BLOCKED: "sod.violation.blocked",
  SOD_APPROVAL_REQUESTED: "sod.approval.requested",
  SOD_APPROVAL_DECIDED: "sod.approval.decided",
  // Retention & Deletion
  RETENTION_JOB_STARTED: "retention.job.started",
  RETENTION_JOB_COMPLETED: "retention.job.completed",
  RETENTION_JOB_FAILED: "retention.job.failed",
  DELETION_EVENT_CREATED: "deletion.event.created",
  DELETION_BLOCKED_LEGAL_HOLD: "deletion.blocked.legal_hold",
  // Job
  JOB_STARTED: "job.started",
  JOB_COMPLETED: "job.completed",
  JOB_FAILED: "job.failed",
} as const;
