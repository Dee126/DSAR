import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});

export const createCaseSchema = z.object({
  type: z.enum(["ACCESS", "ERASURE", "RECTIFICATION", "RESTRICTION", "PORTABILITY", "OBJECTION"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional().default("MEDIUM"),
  channel: z.string().optional(),
  requesterType: z.string().optional(),
  description: z.string().optional(),
  lawfulBasis: z.string().optional(),
  receivedAt: z.string().datetime().optional(),
  dataSubject: z.object({
    id: z.string().uuid().optional(),
    fullName: z.string().min(1, "Subject name is required"),
    email: z.string().email().optional().or(z.literal("")),
    phone: z.string().optional(),
    address: z.string().optional(),
  }),
});

export const updateCaseSchema = z.object({
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  assignedToUserId: z.string().uuid().nullable().optional(),
  description: z.string().optional(),
  lawfulBasis: z.string().optional(),
});

export const transitionSchema = z.object({
  toStatus: z.enum([
    "NEW", "IDENTITY_VERIFICATION", "INTAKE_TRIAGE", "DATA_COLLECTION",
    "REVIEW_LEGAL", "RESPONSE_PREPARATION", "RESPONSE_SENT", "CLOSED", "REJECTED",
  ]),
  reason: z.string().min(1, "Reason is required for status transitions"),
});

export const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  assigneeUserId: z.string().uuid().optional(),
  dueDate: z.string().datetime().optional(),
  systemId: z.string().uuid().optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(["OPEN", "IN_PROGRESS", "BLOCKED", "DONE"]).optional(),
  assigneeUserId: z.string().uuid().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
});

export const createCommentSchema = z.object({
  body: z.string().min(1, "Comment body is required"),
});

export const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1, "Name is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["TENANT_ADMIN", "DPO", "CASE_MANAGER", "CONTRIBUTOR", "READ_ONLY"]),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(["TENANT_ADMIN", "DPO", "CASE_MANAGER", "CONTRIBUTOR", "READ_ONLY"]).optional(),
});

export const createSystemSchema = z.object({
  name: z.string().min(1, "System name is required"),
  description: z.string().optional(),
  owner: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  tags: z.array(z.string()).optional(),
});

export const updateSystemSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  owner: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  tags: z.array(z.string()).optional(),
});
