/**
 * Barrel export for all Supabase-backed repositories.
 *
 * Usage in API routes:
 *   import { CaseRepository, AuditLogRepository } from "@/server/repositories";
 */

export { supabaseAdmin } from "./supabase-admin";

export { TenantRepository } from "./tenant.repository";
export { UserRepository } from "./user.repository";
export { DataSubjectRepository } from "./data-subject.repository";
export { CaseRepository } from "./case.repository";
export { StateTransitionRepository } from "./state-transition.repository";
export { TaskRepository } from "./task.repository";
export { DocumentRepository } from "./document.repository";
export { CommentRepository } from "./comment.repository";
export { AuditLogRepository } from "./audit-log.repository";
export { SystemRepository } from "./system.repository";
