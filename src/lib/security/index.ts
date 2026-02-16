/**
 * Security module barrel export.
 * Sprint 9.2: Security Hardening
 */

export {
  canPerform,
  canReadCase,
  canWriteCase,
  canDownloadArtifact,
  canManageGovernance,
  canCreateExports,
  enforcePolicy,
  type PolicyActor,
  type PolicyDecision,
} from "./policy-engine";

export {
  assertTenantScoped,
  tenantWhere,
  tenantEntityWhere,
  getTenantIdFromSession,
  assertRelatedEntityTenant,
} from "./tenant-guard";

export {
  checkRateLimit,
  hashIpForRateLimit,
  rateKey,
  applyRateLimitHeaders,
  RATE_LIMITS,
} from "./rate-limiter";
