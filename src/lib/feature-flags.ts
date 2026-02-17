/**
 * Feature Flag Service — Tenant-scoped feature toggles
 *
 * Enables/disables modules per tenant for safe rollout & rollback.
 * Cached in-memory with 60s TTL.
 *
 * Usage:
 *   import { featureFlags } from "@/lib/feature-flags";
 *   const enabled = await featureFlags.isEnabled(tenantId, "intake_portal");
 *   const config = await featureFlags.getConfig(tenantId, "intake_portal");
 */

import { prisma } from "@/lib/prisma";

/* ── Feature Key Registry ─────────────────────────────────────────────── */

export const FEATURE_KEYS = {
  INTAKE_PORTAL: "intake_portal",
  DELIVERY_PORTAL: "delivery_portal",
  IDV: "idv",
  RESPONSE_GENERATOR: "response_generator",
  INCIDENTS_AUTHORITIES: "incidents_authorities",
  VENDORS: "vendors",
  EXECUTIVE_DASHBOARD: "executive_dashboard",
  CONNECTORS_M365: "connectors_m365",
  CONNECTORS_GOOGLE: "connectors_google",
  ADVANCED_REDACTION: "advanced_redaction",
  COPILOT: "copilot",
  EDISCOVERY: "ediscovery",
} as const;

export type FeatureKey = (typeof FEATURE_KEYS)[keyof typeof FEATURE_KEYS];

export interface FeatureFlagDef {
  key: FeatureKey;
  label: string;
  description: string;
  /** Default state for new tenants */
  defaultEnabled: boolean;
  /** Category for UI grouping */
  category: "core" | "portal" | "integration" | "advanced";
}

export const FEATURE_DEFINITIONS: FeatureFlagDef[] = [
  { key: "intake_portal", label: "Intake Portal", description: "Public intake submission portal for data subjects", defaultEnabled: true, category: "portal" },
  { key: "delivery_portal", label: "Delivery Portal", description: "Secure document delivery portal for data subjects", defaultEnabled: true, category: "portal" },
  { key: "idv", label: "Identity Verification", description: "Identity verification workflow with token-based verification", defaultEnabled: true, category: "core" },
  { key: "response_generator", label: "Response Generator", description: "Automated response document generation and templates", defaultEnabled: true, category: "core" },
  { key: "incidents_authorities", label: "Incidents & Authorities", description: "Incident management and authority reporting module", defaultEnabled: true, category: "core" },
  { key: "vendors", label: "Vendor Tracking", description: "Vendor/processor tracking and data collection requests", defaultEnabled: true, category: "core" },
  { key: "executive_dashboard", label: "Executive Dashboard", description: "Executive KPI dashboard with trends and SLA reporting", defaultEnabled: true, category: "advanced" },
  { key: "connectors_m365", label: "Microsoft 365 Connector", description: "Microsoft 365 integration (Exchange, SharePoint, OneDrive)", defaultEnabled: false, category: "integration" },
  { key: "connectors_google", label: "Google Workspace Connector", description: "Google Workspace integration (Gmail, Drive)", defaultEnabled: false, category: "integration" },
  { key: "advanced_redaction", label: "Advanced Redaction", description: "AI-assisted document redaction with PII detection", defaultEnabled: false, category: "advanced" },
  { key: "copilot", label: "Privacy Copilot", description: "AI-powered privacy analysis and data discovery", defaultEnabled: false, category: "advanced" },
  { key: "ediscovery", label: "eDiscovery", description: "Enterprise search and eDiscovery timeline", defaultEnabled: false, category: "advanced" },
];

/* ── Cache ─────────────────────────────────────────────────────────────── */

interface CachedFlag {
  enabled: boolean;
  config: Record<string, unknown> | null;
  cachedAt: number;
}

const CACHE_TTL_MS = 60_000; // 60 seconds
const flagCache = new Map<string, CachedFlag>();

function cacheKey(tenantId: string, key: string): string {
  return `${tenantId}:${key}`;
}

function getCached(tenantId: string, key: string): CachedFlag | null {
  const ck = cacheKey(tenantId, key);
  const entry = flagCache.get(ck);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    flagCache.delete(ck);
    return null;
  }
  return entry;
}

function setCache(tenantId: string, key: string, enabled: boolean, config: Record<string, unknown> | null): void {
  flagCache.set(cacheKey(tenantId, key), { enabled, config, cachedAt: Date.now() });
}

/* ── Service ──────────────────────────────────────────────────────────── */

async function loadFlag(tenantId: string, key: string): Promise<{ enabled: boolean; config: Record<string, unknown> | null }> {
  try {
    const flag = await prisma.featureFlag.findUnique({
      where: { tenantId_key: { tenantId, key } },
    });

    if (!flag) {
      // Use default from definition
      const def = FEATURE_DEFINITIONS.find((d) => d.key === key);
      const enabled = def?.defaultEnabled ?? false;
      setCache(tenantId, key, enabled, null);
      return { enabled, config: null };
    }

    const config = flag.configJson as Record<string, unknown> | null;
    setCache(tenantId, key, flag.enabled, config);
    return { enabled: flag.enabled, config };
  } catch {
    // If DB is unavailable, fall back to defaults
    const def = FEATURE_DEFINITIONS.find((d) => d.key === key);
    return { enabled: def?.defaultEnabled ?? false, config: null };
  }
}

export const featureFlags = {
  /**
   * Check if a feature is enabled for a tenant.
   */
  async isEnabled(tenantId: string, key: FeatureKey): Promise<boolean> {
    const cached = getCached(tenantId, key);
    if (cached) return cached.enabled;
    const { enabled } = await loadFlag(tenantId, key);
    return enabled;
  },

  /**
   * Get feature config JSON for a tenant.
   */
  async getConfig(tenantId: string, key: FeatureKey): Promise<Record<string, unknown> | null> {
    const cached = getCached(tenantId, key);
    if (cached) return cached.config;
    const { config } = await loadFlag(tenantId, key);
    return config;
  },

  /**
   * Get all flags for a tenant (for admin UI).
   */
  async getAllForTenant(tenantId: string): Promise<Array<{
    key: string;
    enabled: boolean;
    config: Record<string, unknown> | null;
    label: string;
    description: string;
    category: string;
  }>> {
    try {
      const dbFlags = await prisma.featureFlag.findMany({
        where: { tenantId },
      });

      const flagMap = new Map<string, { enabled: boolean; configJson: unknown }>();
      dbFlags.forEach((f) => flagMap.set(f.key, f));

      return FEATURE_DEFINITIONS.map((def) => {
        const dbFlag = flagMap.get(def.key);
        return {
          key: def.key,
          enabled: dbFlag?.enabled ?? def.defaultEnabled,
          config: (dbFlag?.configJson as Record<string, unknown>) ?? null,
          label: def.label,
          description: def.description,
          category: def.category,
        };
      });
    } catch {
      return FEATURE_DEFINITIONS.map((def) => ({
        key: def.key,
        enabled: def.defaultEnabled,
        config: null,
        label: def.label,
        description: def.description,
        category: def.category,
      }));
    }
  },

  /**
   * Set a feature flag for a tenant. Records audit log.
   */
  async setFlag(
    tenantId: string,
    key: FeatureKey,
    enabled: boolean,
    changedByUserId: string,
    config?: Record<string, unknown>,
  ): Promise<void> {
    const existing = await prisma.featureFlag.findUnique({
      where: { tenantId_key: { tenantId, key } },
    });

    const previousEnabled = existing?.enabled ?? FEATURE_DEFINITIONS.find((d) => d.key === key)?.defaultEnabled ?? false;

    await prisma.featureFlag.upsert({
      where: { tenantId_key: { tenantId, key } },
      create: {
        tenantId,
        key,
        enabled,
        configJson: config ?? null,
      },
      update: {
        enabled,
        configJson: config !== undefined ? config : undefined,
        updatedAt: new Date(),
      },
    });

    // Audit log
    await prisma.featureFlagAudit.create({
      data: {
        tenantId,
        key,
        previousEnabled,
        newEnabled: enabled,
        changedByUserId,
      },
    });

    // Invalidate cache
    flagCache.delete(cacheKey(tenantId, key));
  },

  /**
   * Invalidate all cached flags for a tenant.
   */
  invalidateTenant(tenantId: string): void {
    const prefix = `${tenantId}:`;
    flagCache.forEach((_value, key) => {
      if (key.startsWith(prefix)) {
        flagCache.delete(key);
      }
    });
  },

  /** Reset cache (for testing) */
  _resetCache(): void {
    flagCache.clear();
  },
};

/**
 * Middleware helper: check feature flag and return 404 if disabled.
 * Use in route handlers for feature-gated endpoints.
 */
export async function requireFeature(tenantId: string, key: FeatureKey): Promise<boolean> {
  return featureFlags.isEnabled(tenantId, key);
}
