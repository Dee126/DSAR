import "server-only";

import { supabaseAdmin } from "./supabase-admin";
import {
  Tables,
  DSARCaseRow,
  DSARCaseInsert,
  DSARCaseUpdate,
  CaseStatus,
  DSARType,
  PaginationParams,
  PaginatedResult,
} from "@/types/database";

const TABLE = Tables.dsarCases;

export interface CaseListFilters {
  status?: CaseStatus;
  type?: DSARType;
  assignee?: string;
  search?: string;
}

/**
 * PostgREST select expression for a case list item, including the most
 * commonly needed relations.
 */
const LIST_SELECT = `
  *,
  dataSubject:data_subjects!dataSubjectId(*),
  assignedTo:users!assignedToUserId(id, name, email),
  createdBy:users!createdByUserId(id, name, email)
`;

/**
 * PostgREST select expression for a full case detail view with nested
 * relations (state transitions, tasks, documents, comments, etc.).
 */
const DETAIL_SELECT = `
  *,
  dataSubject:data_subjects!dataSubjectId(*),
  assignedTo:users!assignedToUserId(id, name, email),
  createdBy:users!createdByUserId(id, name, email),
  stateTransitions:dsar_state_transitions(
    *, changedBy:users!changedByUserId(id, name, email)
  ),
  tasks(
    *, assignee:users!assigneeUserId(id, name, email)
  ),
  documents(
    *, uploadedBy:users!uploadedByUserId(id, name, email)
  ),
  comments(
    *, author:users!authorUserId(id, name, email)
  ),
  communicationLogs:communication_logs(*),
  dataCollectionItems:data_collection_items(
    *, system:systems!systemId(id, name, description, owner)
  ),
  legalReviews:legal_reviews(
    *, reviewer:users!reviewerUserId(id, name, email)
  )
`;

export const CaseRepository = {
  // ── Queries ─────────────────────────────────────────────────────────────

  async findById(id: string, tenantId: string) {
    const { data, error } = await supabaseAdmin()
      .from(TABLE)
      .select(DETAIL_SELECT)
      .eq("id", id)
      .eq("tenantId", tenantId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async list(
    tenantId: string,
    filters: CaseListFilters = {},
    pagination: PaginationParams = { page: 1, limit: 20 }
  ): Promise<PaginatedResult<Record<string, unknown>>> {
    const { page, limit } = pagination;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabaseAdmin()
      .from(TABLE)
      .select(LIST_SELECT, { count: "exact" })
      .eq("tenantId", tenantId)
      .order("createdAt", { ascending: false })
      .range(from, to);

    if (filters.status) {
      query = query.eq("status", filters.status);
    }
    if (filters.type) {
      query = query.eq("type", filters.type);
    }
    if (filters.assignee) {
      query = query.eq("assignedToUserId", filters.assignee);
    }
    if (filters.search) {
      // PostgREST OR filter for case number and data subject fields.
      // Note: cross-table ilike in PostgREST requires the foreign table
      // to be joined. For simplicity we filter on caseNumber here;
      // for data subject search, consider an RPC or a DB view.
      query = query.ilike("caseNumber", `%${filters.search}%`);
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

  /** Count cases grouped by status for a tenant (dashboard stats). */
  async countByStatus(
    tenantId: string
  ): Promise<Record<string, number>> {
    const { data, error } = await supabaseAdmin()
      .from(TABLE)
      .select("status")
      .eq("tenantId", tenantId);

    if (error) throw error;

    const counts: Record<string, number> = {};
    for (const row of data ?? []) {
      counts[row.status] = (counts[row.status] ?? 0) + 1;
    }
    return counts;
  },

  // ── Mutations ───────────────────────────────────────────────────────────

  async create(input: DSARCaseInsert) {
    const { data, error } = await supabaseAdmin()
      .from(TABLE)
      .insert(input)
      .select(
        `*, dataSubject:data_subjects!dataSubjectId(*),
         createdBy:users!createdByUserId(id, name, email)`
      )
      .single();

    if (error) throw error;
    return data;
  },

  async update(id: string, tenantId: string, updates: DSARCaseUpdate) {
    const { data, error } = await supabaseAdmin()
      .from(TABLE)
      .update(updates)
      .eq("id", id)
      .eq("tenantId", tenantId)
      .select(
        `*, dataSubject:data_subjects!dataSubjectId(*),
         createdBy:users!createdByUserId(id, name, email),
         assignedTo:users!assignedToUserId(id, name, email)`
      )
      .single();

    if (error) throw error;
    return data;
  },

  async softDelete(id: string, tenantId: string): Promise<void> {
    const { error } = await supabaseAdmin()
      .from(TABLE)
      .update({ deletedAt: new Date().toISOString() })
      .eq("id", id)
      .eq("tenantId", tenantId);

    if (error) throw error;
  },
};
