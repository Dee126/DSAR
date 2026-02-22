"use client";

import { useCallback, type ReactNode } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { AuthContext } from "@/hooks/useAuth";

/**
 * Bridges NextAuth's useSession into the unified AuthContext
 * so that useAuth() works in supabase mode too.
 */
export default function NextAuthBridge({ children }: { children: ReactNode }) {
  const { data: session, status: naStatus } = useSession();

  const status = naStatus === "loading"
    ? "loading" as const
    : session?.user
      ? "authenticated" as const
      : "unauthenticated" as const;

  const user = session?.user
    ? {
        id: session.user.id,
        tenantId: session.user.tenantId,
        email: session.user.email ?? "",
        name: session.user.name ?? "",
        role: session.user.role as string,
      }
    : null;

  const login = useCallback(async (email: string, password: string) => {
    const result = await signIn("credentials", {
      email: email.trim(),
      password,
      redirect: false,
    });
    if (result?.error) {
      return { ok: false, error: result.error === "CredentialsSignin" ? "Invalid email or password" : "Login failed" };
    }
    return { ok: true };
  }, []);

  const logout = useCallback(async () => {
    await signOut({ callbackUrl: "/login" });
  }, []);

  return (
    <AuthContext.Provider value={{ user, status, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
