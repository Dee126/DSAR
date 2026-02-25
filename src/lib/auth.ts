import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { authOptions } from "./auth-options";
import { ApiError } from "./errors";
import { UserRole } from "@prisma/client";
import { verifyToken, isTestAuth, COOKIE_NAME, type AuthUser } from "./test-auth";

export async function getAuthSession() {
  return getServerSession(authOptions);
}

let devBypassLogged = false;

export async function requireAuth(): Promise<AuthUser & { role: UserRole }> {
  if (process.env.DEV_AUTH_BYPASS === "true") {
    if (!devBypassLogged) {
      console.log("[auth] DEV_AUTH_BYPASS enabled");
      devBypassLogged = true;
    }
    return {
      id: "demo-user",
      email: "daniel.schormann@gmail.com",
      name: "Daniel",
      role: "TENANT_ADMIN" as UserRole,
      tenantId: process.env.DEMO_TENANT_ID ?? "83053683-0fff-4dee-8437-c5e90147bc36",
    };
  }

  if (isTestAuth()) {
    const secret = process.env.AUTH_SECRET;
    if (!secret) throw new ApiError(401, "AUTH_SECRET not configured");

    const token = cookies().get(COOKIE_NAME)?.value;
    if (!token) throw new ApiError(401, "Authentication required");

    const user = await verifyToken(token, secret);
    if (!user) throw new ApiError(401, "Invalid or expired token");

    return user as AuthUser & { role: UserRole };
  }

  // Supabase / NextAuth mode
  const session = await getAuthSession();
  if (!session?.user) {
    throw new ApiError(401, "Authentication required");
  }
  return session.user;
}

export async function requireRole(...roles: UserRole[]) {
  const user = await requireAuth();
  if (!roles.includes(user.role)) {
    throw new ApiError(403, "Insufficient permissions");
  }
  return user;
}
