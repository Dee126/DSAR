"use client";

import { SessionProvider } from "next-auth/react";
import TestAuthProvider from "./TestAuthProvider";
import NextAuthBridge from "./NextAuthBridge";

const AUTH_MODE = process.env.NEXT_PUBLIC_AUTH_MODE || "test";

export default function Providers({ children }: { children: React.ReactNode }) {
  if (AUTH_MODE === "test") {
    return <TestAuthProvider>{children}</TestAuthProvider>;
  }

  // Supabase / NextAuth mode
  return (
    <SessionProvider>
      <NextAuthBridge>{children}</NextAuthBridge>
    </SessionProvider>
  );
}
