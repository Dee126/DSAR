import "server-only";

import { supabaseAdmin } from "./supabase-admin";
import {
  Tables,
  UserRow,
  UserInsert,
  UserUpdate,
  UserSummary,
} from "@/types/database";

const TABLE = Tables.users;

/** Fields returned in list/public endpoints (no passwordHash). */
const SAFE_SELECT =
  "id, tenantId, email, name, role, createdAt, updatedAt, lastLoginAt";

/** Minimal user summary for embedding in related objects. */
const SUMMARY_SELECT = "id, name, email";

export const UserRepository = {
  // ── Queries ─────────────────────────────────────────────────────────────

  async findById(id: string, tenantId: string): Promise<UserRow | null> {
    const { data, error } = await supabaseAdmin()
      .from(TABLE)
      .select("*")
      .eq("id", id)
      .eq("tenantId", tenantId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async findByEmail(
    email: string,
    tenantId: string
  ): Promise<UserRow | null> {
    const { data, error } = await supabaseAdmin()
      .from(TABLE)
      .select("*")
      .eq("email", email)
      .eq("tenantId", tenantId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  /** Find by email across all tenants (for auth login). */
  async findByEmailGlobal(email: string): Promise<UserRow | null> {
    const { data, error } = await supabaseAdmin()
      .from(TABLE)
      .select("*")
      .eq("email", email)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async listByTenant(
    tenantId: string
  ): Promise<Omit<UserRow, "passwordHash">[]> {
    const { data, error } = await supabaseAdmin()
      .from(TABLE)
      .select(SAFE_SELECT)
      .eq("tenantId", tenantId)
      .order("name", { ascending: true });

    if (error) throw error;
    return data ?? [];
  },

  // ── Mutations ───────────────────────────────────────────────────────────

  async create(
    input: UserInsert
  ): Promise<Omit<UserRow, "passwordHash">> {
    const { data, error } = await supabaseAdmin()
      .from(TABLE)
      .insert(input)
      .select(SAFE_SELECT)
      .single();

    if (error) throw error;
    return data;
  },

  async update(
    id: string,
    tenantId: string,
    updates: UserUpdate
  ): Promise<Omit<UserRow, "passwordHash">> {
    const { data, error } = await supabaseAdmin()
      .from(TABLE)
      .update(updates)
      .eq("id", id)
      .eq("tenantId", tenantId)
      .select(SAFE_SELECT)
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

  // ── Helpers ─────────────────────────────────────────────────────────────

  /** The PostgREST select expression for embedding a user summary. */
  get summarySelect() {
    return SUMMARY_SELECT;
  },
};
