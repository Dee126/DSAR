import "server-only";

import { supabaseAdmin } from "./supabase-admin";
import {
  Tables,
  TaskRow,
  TaskInsert,
  TaskUpdate,
} from "@/types/database";

const TABLE = Tables.tasks;

const WITH_RELATIONS = `
  *,
  assignee:users!assigneeUserId(id, name, email),
  system:systems!systemId(id, name),
  case:dsar_cases!caseId(caseNumber)
`;

export const TaskRepository = {
  async findById(id: string, tenantId: string) {
    const { data, error } = await supabaseAdmin()
      .from(TABLE)
      .select(WITH_RELATIONS)
      .eq("id", id)
      .eq("tenantId", tenantId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async listByCase(caseId: string, tenantId: string): Promise<TaskRow[]> {
    const { data, error } = await supabaseAdmin()
      .from(TABLE)
      .select(WITH_RELATIONS)
      .eq("caseId", caseId)
      .eq("tenantId", tenantId)
      .order("createdAt", { ascending: false });

    if (error) throw error;
    return (data ?? []) as TaskRow[];
  },

  async listByTenant(tenantId: string): Promise<TaskRow[]> {
    const { data, error } = await supabaseAdmin()
      .from(TABLE)
      .select(WITH_RELATIONS)
      .eq("tenantId", tenantId)
      .order("createdAt", { ascending: false });

    if (error) throw error;
    return (data ?? []) as TaskRow[];
  },

  async listByAssignee(
    assigneeUserId: string,
    tenantId: string
  ): Promise<TaskRow[]> {
    const { data, error } = await supabaseAdmin()
      .from(TABLE)
      .select(WITH_RELATIONS)
      .eq("assigneeUserId", assigneeUserId)
      .eq("tenantId", tenantId)
      .order("createdAt", { ascending: false });

    if (error) throw error;
    return (data ?? []) as TaskRow[];
  },

  async create(input: TaskInsert) {
    const { data, error } = await supabaseAdmin()
      .from(TABLE)
      .insert(input)
      .select(WITH_RELATIONS)
      .single();

    if (error) throw error;
    return data;
  },

  async update(id: string, tenantId: string, updates: TaskUpdate) {
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

  async delete(id: string, tenantId: string): Promise<void> {
    const { error } = await supabaseAdmin()
      .from(TABLE)
      .delete()
      .eq("id", id)
      .eq("tenantId", tenantId);

    if (error) throw error;
  },
};
