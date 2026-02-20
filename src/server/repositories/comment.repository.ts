import "server-only";

import { supabaseAdmin } from "./supabase-admin";
import { Tables, CommentRow, CommentInsert } from "@/types/database";

const TABLE = Tables.comments;

const WITH_RELATIONS = `
  *,
  author:users!authorUserId(id, name, email)
`;

export const CommentRepository = {
  async listByCase(
    caseId: string,
    tenantId: string
  ): Promise<CommentRow[]> {
    const { data, error } = await supabaseAdmin()
      .from(TABLE)
      .select(WITH_RELATIONS)
      .eq("caseId", caseId)
      .eq("tenantId", tenantId)
      .order("createdAt", { ascending: true });

    if (error) throw error;
    return (data ?? []) as CommentRow[];
  },

  async create(input: CommentInsert) {
    const { data, error } = await supabaseAdmin()
      .from(TABLE)
      .insert(input)
      .select(WITH_RELATIONS)
      .single();

    if (error) throw error;
    return data;
  },

  async delete(id: string, tenantId: string): Promise<void> {
    const { error } = await supabaseAdmin()
      .from(TABLE)
      .delete()
      .eq("id", id)
      .eq("tenantId", tenantId);

    if (error) throw error;
  },
};
