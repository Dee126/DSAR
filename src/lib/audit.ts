import { AuditLogRepository } from "@/server/repositories";

interface AuditEntry {
  tenantId?: string | null;
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  details?: Record<string, unknown> | null;
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  await AuditLogRepository.create({
    tenantId: entry.tenantId ?? null,
    actorUserId: entry.actorUserId ?? null,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    ip: entry.ip ?? null,
    userAgent: entry.userAgent ?? null,
    details: entry.details ?? null,
  });
}

export function getClientInfo(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  const userAgent = request.headers.get("user-agent") ?? "unknown";
  return { ip, userAgent };
}
