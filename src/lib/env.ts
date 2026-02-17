/**
 * Environment Validation & Typed Accessors
 *
 * Validates required environment variables at startup (fail fast).
 * Provides typed, centralized access to all configuration.
 *
 * Usage:
 *   import { env, validateEnv } from "@/lib/env";
 *   validateEnv(); // call once at startup
 *   const dbUrl = env.DATABASE_URL;
 */

interface EnvVarDef {
  key: string;
  required: boolean;
  /** Only required when this condition fn returns true */
  requiredWhen?: () => boolean;
  description: string;
  sensitive?: boolean;
}

const ENV_VARS: EnvVarDef[] = [
  { key: "DATABASE_URL", required: true, description: "PostgreSQL connection string" },
  { key: "NEXTAUTH_SECRET", required: true, description: "NextAuth JWT signing secret" },
  { key: "NEXTAUTH_URL", required: false, description: "App base URL for NextAuth" },
  { key: "PRIVACYPILOT_SECRET", required: false, description: "Encryption key for secrets (32 bytes, base64). Required in production.", sensitive: true },
  {
    key: "STORAGE_TYPE",
    required: false,
    description: "Storage backend: 'local' or 's3' (default: local)",
  },
  {
    key: "S3_BUCKET",
    required: false,
    requiredWhen: () => process.env.STORAGE_TYPE === "s3",
    description: "S3 bucket name (required when STORAGE_TYPE=s3)",
  },
  {
    key: "S3_REGION",
    required: false,
    requiredWhen: () => process.env.STORAGE_TYPE === "s3",
    description: "S3 region (required when STORAGE_TYPE=s3)",
  },
  {
    key: "S3_ACCESS_KEY_ID",
    required: false,
    requiredWhen: () => process.env.STORAGE_TYPE === "s3",
    description: "S3 access key (required when STORAGE_TYPE=s3)",
    sensitive: true,
  },
  {
    key: "S3_SECRET_ACCESS_KEY",
    required: false,
    requiredWhen: () => process.env.STORAGE_TYPE === "s3",
    description: "S3 secret key (required when STORAGE_TYPE=s3)",
    sensitive: true,
  },
  { key: "DEFAULT_SLA_DAYS", required: false, description: "Default SLA deadline in days (default: 30)" },
  { key: "ENABLE_QUERY_PROFILING", required: false, description: "Enable query profiling in non-dev (default: false)" },
];

export interface EnvValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate all required environment variables.
 * Returns validation result. Call at server startup.
 */
export function validateEnv(): EnvValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const def of ENV_VARS) {
    const value = process.env[def.key];
    const isRequired = def.required || (def.requiredWhen?.() ?? false);

    if (isRequired && !value) {
      errors.push(`Missing required env var: ${def.key} — ${def.description}`);
    }
  }

  // Production-specific checks
  if (process.env.NODE_ENV === "production") {
    if (!process.env.PRIVACYPILOT_SECRET) {
      errors.push("PRIVACYPILOT_SECRET is required in production for encryption.");
    }
    if (!process.env.NEXTAUTH_URL) {
      warnings.push("NEXTAUTH_URL not set — may cause auth redirect issues.");
    }
    if (process.env.NEXTAUTH_SECRET === "change-me-to-a-random-secret-in-production") {
      errors.push("NEXTAUTH_SECRET still set to default value. Generate a secure secret.");
    }
  }

  // Warn about missing optional but recommended vars
  if (!process.env.PRIVACYPILOT_SECRET && process.env.NODE_ENV !== "production") {
    warnings.push("PRIVACYPILOT_SECRET not set — using insecure dev default. Not suitable for production.");
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validate and fail fast if required vars are missing.
 * Logs warnings for optional vars. Throws on missing required vars.
 */
export function ensureEnv(): void {
  const result = validateEnv();

  for (const warning of result.warnings) {
    console.warn(`[ENV] ⚠ ${warning}`);
  }

  if (!result.valid) {
    const msg = [
      "═══ Environment Validation Failed ═══",
      "",
      ...result.errors.map((e) => `  ✗ ${e}`),
      "",
      "Fix the above errors and restart the server.",
      "See .env.example for required configuration.",
      "═════════════════════════════════════",
    ].join("\n");

    console.error(msg);
    throw new Error(`Environment validation failed: ${result.errors.join("; ")}`);
  }
}

/**
 * Typed environment variable accessors.
 * Access env vars with proper defaults and types.
 */
export const env = {
  get NODE_ENV() {
    return process.env.NODE_ENV ?? "development";
  },
  get isProduction() {
    return process.env.NODE_ENV === "production";
  },
  get isDevelopment() {
    return process.env.NODE_ENV === "development";
  },
  get isTest() {
    return process.env.NODE_ENV === "test";
  },

  // Database
  get DATABASE_URL() {
    return process.env.DATABASE_URL ?? "";
  },

  // Auth
  get NEXTAUTH_SECRET() {
    return process.env.NEXTAUTH_SECRET ?? "";
  },
  get NEXTAUTH_URL() {
    return process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  },

  // Encryption
  get PRIVACYPILOT_SECRET() {
    return process.env.PRIVACYPILOT_SECRET ?? "";
  },
  get hasEncryptionKey() {
    return !!process.env.PRIVACYPILOT_SECRET;
  },

  // Storage
  get STORAGE_TYPE(): "local" | "s3" {
    return (process.env.STORAGE_TYPE as "local" | "s3") ?? "local";
  },
  get STORAGE_LOCAL_PATH() {
    return process.env.STORAGE_LOCAL_PATH ?? "./uploads";
  },
  get S3_BUCKET() {
    return process.env.S3_BUCKET ?? "";
  },
  get S3_REGION() {
    return process.env.S3_REGION ?? "";
  },
  get S3_ACCESS_KEY_ID() {
    return process.env.S3_ACCESS_KEY_ID ?? "";
  },
  get S3_SECRET_ACCESS_KEY() {
    return process.env.S3_SECRET_ACCESS_KEY ?? "";
  },
  get S3_ENDPOINT() {
    return process.env.S3_ENDPOINT ?? "";
  },

  // App config
  get DEFAULT_SLA_DAYS() {
    return parseInt(process.env.DEFAULT_SLA_DAYS ?? "30", 10);
  },
  get PUBLIC_BASE_URL() {
    return process.env.PUBLIC_BASE_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  },
};
