/**
 * Common types for all integration connectors.
 *
 * Connectors use the standardised QuerySpec / ResultMetadata types
 * defined in src/lib/query-spec.ts and src/lib/result-metadata.ts.
 */

import type { QuerySpec } from "@/lib/query-spec";
import type { ResultMetadata } from "@/lib/result-metadata";

/* ── Health check ─────────────────────────────────────────────────────── */

export interface HealthCheckResult {
  healthy: boolean;
  message: string;
  details?: Record<string, unknown>;
  checkedAt: Date;
}

/* ── Collection result ────────────────────────────────────────────────── */

export interface CollectionResult {
  success: boolean;
  recordsFound: number;
  findingsSummary: string;
  resultMetadata: ResultMetadata;
  error?: string;
}

/* ── Connector config ─────────────────────────────────────────────────── */

export interface ConnectorConfig {
  [key: string]: unknown;
}

/* ── Connector interface ──────────────────────────────────────────────── */

export interface Connector {
  /** Provider identifier (matches IntegrationProvider enum) */
  provider: string;

  /** Check if the integration is reachable and functional */
  healthCheck(config: ConnectorConfig, secretRef: string | null): Promise<HealthCheckResult>;

  /**
   * Collect data based on a standardised QuerySpec.
   * Returns structured ResultMetadata for audit and export.
   */
  collectData(
    config: ConnectorConfig,
    secretRef: string | null,
    querySpec: QuerySpec
  ): Promise<CollectionResult>;

  /** Get the configuration fields for UI rendering */
  getConfigFields(): ConfigField[];

  /** Get query template options for data collection */
  getQueryTemplates(): QueryTemplate[];
}

/* ── Config field (for UI form generation) ────────────────────────────── */

export interface ConfigField {
  key: string;
  label: string;
  type: "text" | "password" | "textarea" | "select";
  required: boolean;
  placeholder?: string;
  description?: string;
  options?: { label: string; value: string }[];
  isSecret?: boolean;
}

/* ── Query template ───────────────────────────────────────────────────── */

export interface QueryTemplate {
  id: string;
  name: string;
  description: string;
  /** Fields specific to this template's providerScope */
  scopeFields: ConfigField[];
  /** Default providerScope values when this template is selected */
  defaultScope: Record<string, unknown>;
}

/* ── Provider info (with phase) ───────────────────────────────────────── */

export type ProviderPhase = 1 | 2 | 3 | 4;

export interface ProviderInfo {
  provider: string;
  name: string;
  description: string;
  icon: string;
  phase: ProviderPhase;
  available: boolean;
  comingSoon?: boolean;
}
