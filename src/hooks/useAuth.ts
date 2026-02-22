"use client";

import { createContext, useContext } from "react";

export interface AuthUser {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: string;
}

export interface AuthContextValue {
  user: AuthUser | null;
  status: "loading" | "authenticated" | "unauthenticated";
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  status: "loading",
  login: async () => ({ ok: false }),
  logout: async () => {},
});

/** Unified auth hook that works for both test and supabase auth modes. */
export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
