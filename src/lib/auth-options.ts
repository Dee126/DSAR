import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "./prisma";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === "development",
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 hours
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          console.warn("[auth] Missing email or password in credentials");
          return null;
        }

        const email = credentials.email.trim().toLowerCase();

        // Surface env-var diagnostics on every login attempt so
        // misconfigured deployments are easy to spot in Vercel logs.
        console.log("[auth] Attempting login for:", email);
        console.log("[auth] DATABASE_URL set:", !!process.env.DATABASE_URL);
        console.log("[auth] POSTGRES_PRISMA_URL set:", !!process.env.POSTGRES_PRISMA_URL);
        console.log("[auth] NEXTAUTH_SECRET set:", !!process.env.NEXTAUTH_SECRET);
        console.log("[auth] NEXTAUTH_URL:", process.env.NEXTAUTH_URL ?? "(not set)");

        try {
          // Quick connectivity check — fails fast with a clear message
          // instead of a cryptic Prisma timeout.
          await prisma.$queryRaw`SELECT 1`;

          const user = await prisma.user.findFirst({
            where: {
              email: { equals: email, mode: "insensitive" },
            },
          });

          if (!user) {
            console.warn("[auth] No user found for email:", email);
            return null;
          }

          const valid = await compare(credentials.password, user.passwordHash);
          if (!valid) {
            console.warn("[auth] Invalid password for:", email);
            return null;
          }

          await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          });

          console.log("[auth] Login OK:", email, "role:", user.role);

          return {
            id: user.id,
            tenantId: user.tenantId,
            email: user.email,
            name: user.name,
            role: user.role,
          };
        } catch (error) {
          // Log the real error so DB/connection issues are visible in
          // Vercel Function Logs — without this, they get swallowed as
          // a generic "CredentialsSignin" and the user just sees
          // "Invalid email or password" with no way to diagnose.
          console.error(
            "[auth] Error during login for",
            email,
            "—",
            error instanceof Error ? `${error.name}: ${error.message}` : error
          );
          throw error;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.tenantId = user.tenantId;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id as string;
      session.user.tenantId = token.tenantId as string;
      session.user.role = token.role as any;
      return session;
    },
  },
};
