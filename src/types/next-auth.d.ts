import { UserRole } from "@prisma/client";
import "next-auth";

declare module "next-auth" {
  interface User {
    id: string;
    tenantId: string;
    role: UserRole;
    name: string;
    email: string;
  }

  interface Session {
    user: {
      id: string;
      tenantId: string;
      role: UserRole;
      name: string;
      email: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    tenantId: string;
    role: UserRole;
  }
}
