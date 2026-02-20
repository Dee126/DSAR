import "server-only";

import { supabaseAdmin } from "./supabase-admin";
import {
  Tables,
  DocumentRow,
  DocumentInsert,
  DocumentUpdate,
} from "@/types/database";

const TABLE = Tables.documents;

const WITH_RELATIONS = `
  *,
  uploadedBy:users!uploadedByUserId(id, name, email),
  case:dsar_cases!caseId(caseNumber)
`;

export const DocumentRepository = {
  async findById(id: string, tenantId: string) {
    const { data, error } = await supabaseAdmin()
      .from(TABLE)
      .select(WITH_RELATIONS)
      .eq("id", id)
      .eq("tenantId", tenantId)
      .is("deletedAt", null)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  /** Find by id without the deletedAt filter (needed for delete operations). */
  async findByIdIncludingDeleted(id: string, tenantId: string) {
    const { data, error } = await supabaseAdmin()
      .from(TABLE)
      .select(WITH_RELATIONS)
      .eq("id", id)
      .eq("tenantId", tenantId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async listByCase(
    caseId: string,
    tenantId: string
  ): Promise<DocumentRow[]> {
    const { data, error } = await supabaseAdmin()
      .from(TABLE)
      .select(WITH_RELATIONS)
      .eq("caseId", caseId)
      .eq("tenantId", tenantId)
      .is("deletedAt", null)
      .order("uploadedAt", { ascending: false });

    if (error) throw error;
    return (data ?? []) as DocumentRow[];
  },

  async listByTenant(tenantId: string): Promise<DocumentRow[]> {
    const { data, error } = await supabaseAdmin()
      .from(TABLE)
      .select(WITH_RELATIONS)
      .eq("tenantId", tenantId)
      .is("deletedAt", null)
      .order("uploadedAt", { ascending: false });

    if (error) throw error;
    return (data ?? []) as DocumentRow[];
  },

  async create(input: DocumentInsert) {
    const { data, error } = await supabaseAdmin()
      .from(TABLE)
      .insert(input)
      .select(WITH_RELATIONS)
      .single();

    if (error) throw error;
    return data;
  },

  async update(
    id: string,
    tenantId: string,
    updates: DocumentUpdate
  ) {
    const { data, error } = await supabaseAdmin()
      .from(TABLE)
      .update(updates)
      .eq("id", id)
      .eq("tenantId", tenantId)
      .select(WITH_RELATIONS)
      .single();

    if (error) throw error;
    return data;
  },

  async hardDelete(id: string, tenantId: string): Promise<void> {
    const { error } = await supabaseAdmin()
      .from(TABLE)
      .delete()
      .eq("id", id)
      .eq("tenantId", tenantId);

    if (error) throw error;
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
