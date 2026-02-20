import "server-only";

import { supabaseAdmin } from "./supabase-admin";
import {
  Tables,
  AuditLogRow,
  AuditLogInsert,
  PaginationParams,
  PaginatedResult,
} from "@/types/database";

const TABLE = Tables.auditLogs;

export interface AuditLogFilters {
  entityType?: string;
  entityId?: string;
  actorUserId?: string;
}

export const AuditLogRepository = {
  async create(input: AuditLogInsert): Promise<void> {
    const { error } = await supabaseAdmin().from(TABLE).insert(input);

    if (error) {
      // Audit logging should not crash the caller.
      console.error("Failed to write audit log:", error);
    }
  },

  async list(
    tenantId: string,
    filters: AuditLogFilters = {},
    pagination: PaginationParams = { page: 1, limit: 20 }
  ): Promise<PaginatedResult<AuditLogRow & { actor: { id: string; name: string; email: string } | null }>> {
    const { page, limit } = pagination;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabaseAdmin()
      .from(TABLE)
      .select(
        "*, actor:users!actorUserId(id, name, email)",
        { count: "exact" }
      )
      .eq("tenantId", tenantId)
      .order("createdAt", { ascending: false })
      .range(from, to);

    if (filters.entityType) {
      query = query.eq("entityType", filters.entityType);
    }
    if (filters.entityId) {
      query = query.eq("entityId", filters.entityId);
    }
    if (filters.actorUserId) {
      query = query.eq("actorUserId", filters.actorUserId);
    }

    const { data, count, error } = await query;
    if (error) throw error;

    const total = count ?? 0;
    return {
      data: data ?? [],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },
};
