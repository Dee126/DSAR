/**
 * Common types for all integration connectors.
 */

export interface HealthCheckResult {
  healthy: boolean;
  message: string;
  details?: Record<string, unknown>;
  checkedAt: Date;
}

export interface CollectionResult {
  success: boolean;
  recordsFound: number;
  findingsSummary: string;
  resultMetadata: Record<string, unknown>;
  error?: string;
}

export interface ConnectorConfig {
  [key: string]: unknown;
}

export interface Connector {
  /** Provider identifier */
  provider: string;

  /** Check if the integration is reachable and functional */
  healthCheck(config: ConnectorConfig, secretRef: string | null): Promise<HealthCheckResult>;

  /** Collect data based on a query specification */
  collectData(
    config: ConnectorConfig,
    secretRef: string | null,
    querySpec: Record<string, unknown>
  ): Promise<CollectionResult>;

  /** Get the configuration fields for UI rendering */
  getConfigFields(): ConfigField[];

  /** Get query template options for data collection */
  getQueryTemplates(): QueryTemplate[];
}

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

export interface QueryTemplate {
  id: string;
  name: string;
  description: string;
  fields: ConfigField[];
}

export interface ProviderInfo {
  provider: string;
  name: string;
  description: string;
  icon: string;
  available: boolean;
  comingSoon?: boolean;
}
