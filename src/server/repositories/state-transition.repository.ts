import "server-only";

import { supabaseAdmin } from "./supabase-admin";
import {
  Tables,
  DSARStateTransitionRow,
  DSARStateTransitionInsert,
} from "@/types/database";

const TABLE = Tables.dsarStateTransitions;

const WITH_RELATIONS = `
  *,
  changedBy:users!changedByUserId(id, name, email)
`;

export const StateTransitionRepository = {
  async listByCase(
    caseId: string,
    tenantId: string
  ): Promise<DSARStateTransitionRow[]> {
    const { data, error } = await supabaseAdmin()
      .from(TABLE)
      .select(WITH_RELATIONS)
      .eq("caseId", caseId)
      .eq("tenantId", tenantId)
      .order("changedAt", { ascending: true });

    if (error) throw error;
    return (data ?? []) as DSARStateTransitionRow[];
  },

  async create(input: DSARStateTransitionInsert) {
    const { data, error } = await supabaseAdmin()
      .from(TABLE)
      .insert(input)
      .select(WITH_RELATIONS)
      .single();

    if (error) throw error;
    return data;
  },
};
