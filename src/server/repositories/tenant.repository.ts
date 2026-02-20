import "server-only";

import { supabaseAdmin } from "./supabase-admin";
import {
  Tables,
  TenantRow,
  TenantUpdate,
} from "@/types/database";

const TABLE = Tables.tenants;

export const TenantRepository = {
  async findById(id: string): Promise<TenantRow | null> {
    const { data, error } = await supabaseAdmin()
      .from(TABLE)
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async findByIdOrThrow(id: string): Promise<TenantRow> {
    const tenant = await this.findById(id);
    if (!tenant) throw new Error(`Tenant not found: ${id}`);
    return tenant;
  },

  async update(id: string, updates: TenantUpdate): Promise<TenantRow> {
    const { data, error } = await supabaseAdmin()
      .from(TABLE)
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;
    return data;
  },
};
