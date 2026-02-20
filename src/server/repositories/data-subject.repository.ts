import "server-only";

import { supabaseAdmin } from "./supabase-admin";
import {
  Tables,
  DataSubjectRow,
  DataSubjectInsert,
  DataSubjectUpdate,
} from "@/types/database";

const TABLE = Tables.dataSubjects;

export const DataSubjectRepository = {
  async findById(
    id: string,
    tenantId: string
  ): Promise<DataSubjectRow | null> {
    const { data, error } = await supabaseAdmin()
      .from(TABLE)
      .select("*")
      .eq("id", id)
      .eq("tenantId", tenantId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async search(
    tenantId: string,
    query: string
  ): Promise<DataSubjectRow[]> {
    const { data, error } = await supabaseAdmin()
      .from(TABLE)
      .select("*")
      .eq("tenantId", tenantId)
      .or(
        `fullName.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`
      )
      .order("fullName", { ascending: true })
      .limit(50);

    if (error) throw error;
    return data ?? [];
  },

  async create(input: DataSubjectInsert): Promise<DataSubjectRow> {
    const { data, error } = await supabaseAdmin()
      .from(TABLE)
      .insert(input)
      .select("*")
      .single();

    if (error) throw error;
    return data;
  },

  async update(
    id: string,
    tenantId: string,
    updates: DataSubjectUpdate
  ): Promise<DataSubjectRow> {
    const { data, error } = await supabaseAdmin()
      .from(TABLE)
      .update(updates)
      .eq("id", id)
      .eq("tenantId", tenantId)
      .select("*")
      .single();

    if (error) throw error;
    return data;
  },
};
