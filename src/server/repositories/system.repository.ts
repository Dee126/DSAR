import "server-only";

import { supabaseAdmin } from "./supabase-admin";
import {
  Tables,
  SystemRow,
  SystemInsert,
  SystemUpdate,
} from "@/types/database";

const TABLE = Tables.systems;

const WITH_OWNER = `
  *,
  ownerUser:users!ownerUserId(id, name, email)
`;

export const SystemRepository = {
  async findById(id: string, tenantId: string): Promise<SystemRow | null> {
    const { data, error } = await supabaseAdmin()
      .from(TABLE)
      .select(WITH_OWNER)
      .eq("id", id)
      .eq("tenantId", tenantId)
      .maybeSingle();

    if (error) throw error;
    return data as SystemRow | null;
  },

  async listByTenant(tenantId: string): Promise<SystemRow[]> {
    const { data, error } = await supabaseAdmin()
      .from(TABLE)
      .select(WITH_OWNER)
      .eq("tenantId", tenantId)
      .order("name", { ascending: true });

    if (error) throw error;
    return (data ?? []) as SystemRow[];
  },

  async create(input: SystemInsert) {
    const { data, error } = await supabaseAdmin()
      .from(TABLE)
      .insert(input)
      .select(WITH_OWNER)
      .single();

    if (error) throw error;
    return data;
  },

  async update(id: string, tenantId: string, updates: SystemUpdate) {
    const { data, error } = await supabaseAdmin()
      .from(TABLE)
      .update(updates)
      .eq("id", id)
      .eq("tenantId", tenantId)
      .select(WITH_OWNER)
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
