import { getServerSession } from "next-auth";
import { authOptions } from "./auth-options";
import { ApiError } from "./errors";
import { UserRole } from "@prisma/client";

export async function getAuthSession() {
  return getServerSession(authOptions);
}

export async function requireAuth() {
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
