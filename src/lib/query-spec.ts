/**
 * Standardized QuerySpec for DataCollectionItems.
 *
 * Every data-collection request (regardless of provider) uses this schema so
 * that the system can validate, audit, and later export a consistent
 * "Index of Disclosed Data".
 */

import { z } from "zod";

/* ── Subject Identifiers ──────────────────────────────────────────────── */

export const identifierTypeEnum = z.enum([
  "email",
  "upn",
  "objectId",
  "name",
  "employeeId",
  "phone",
  "custom",
]);

export type IdentifierType = z.infer<typeof identifierTypeEnum>;

const identifierSchema = z.object({
  type: identifierTypeEnum,
  value: z.string().min(1, "Identifier value is required"),
});

const subjectIdentifiersSchema = z.object({
  primary: identifierSchema,
  alternatives: z.array(identifierSchema).optional().default([]),
});

/* ── Time Range ───────────────────────────────────────────────────────── */

const timeRangeSchema = z
  .object({
    from: z.string().datetime({ offset: true }).optional(),
    to: z.string().datetime({ offset: true }).optional(),
  })
  .refine(
    (data) => {
      if (data.from && data.to) {
        return new Date(data.from) <= new Date(data.to);
      }
      return true;
    },
    { message: "Time range 'from' must be before or equal to 'to'" }
  )
  .optional();

/* ── Search Terms ─────────────────────────────────────────────────────── */

const searchTermsSchema = z
  .object({
    terms: z.array(z.string().min(1)).min(1, "At least one search term required"),
    matchType: z.enum(["exact", "fuzzy", "contains"]).default("contains"),
  })
  .optional();

/* ── Provider-Specific Scope ──────────────────────────────────────────── */
/* Each provider registers its own scope shape; we validate the outer
   envelope and let the connector validate provider specifics.              */

// M365 / Entra ID scope
export const m365EntraScopeSchema = z.object({
  lookupType: z.enum(["user_profile", "group_memberships", "sign_in_logs", "all"]),
});

// Exchange Online scope
export const exchangeOnlineScopeSchema = z.object({
  mailboxes: z.array(z.string().min(1)).min(1, "At least one mailbox required"),
  folderScope: z.enum(["inbox", "sent", "drafts", "all"]).default("all"),
  includeAttachments: z.boolean().default(false),
});

// SharePoint Online scope
export const sharepointScopeSchema = z.object({
  siteIds: z.array(z.string().min(1)).min(1, "At least one site ID required"),
  drivePath: z.string().optional(),
  fileTypes: z.array(z.string()).optional(),
});

// OneDrive scope
export const onedriveScopeSchema = z.object({
  userDrive: z.boolean().default(true),
  folderPath: z.string().optional(),
});

// Google Workspace scope (Phase 2 stub)
export const googleWorkspaceScopeSchema = z.object({
  services: z.array(z.enum(["gmail", "drive", "calendar", "directory"])).min(1),
  labels: z.array(z.string()).optional(),
  folders: z.array(z.string()).optional(),
});

// Salesforce scope (Phase 2 stub)
export const salesforceScopeSchema = z.object({
  objects: z.array(z.string()).min(1, "At least one Salesforce object required"),
  fields: z.array(z.string()).optional(),
  includeAttachments: z.boolean().default(false),
});

// ServiceNow scope (Phase 2 stub)
export const servicenowScopeSchema = z.object({
  tables: z.array(z.string()).min(1, "At least one table required"),
  includeAttachments: z.boolean().default(false),
  includeNotes: z.boolean().default(true),
});

// Atlassian scope (Phase 3 stub)
export const atlassianScopeSchema = z.object({
  products: z.array(z.enum(["jira", "confluence"])).min(1),
  projectKeys: z.array(z.string()).optional(),
  spaceKeys: z.array(z.string()).optional(),
});

// Generic / Cloud scope (Phase 3-4 fallback)
export const genericScopeSchema = z.record(z.unknown());

/* ── Provider scope registry ──────────────────────────────────────────── */

export const PROVIDER_SCOPE_SCHEMAS: Record<string, z.ZodTypeAny> = {
  M365: m365EntraScopeSchema,
  EXCHANGE_ONLINE: exchangeOnlineScopeSchema,
  SHAREPOINT: sharepointScopeSchema,
  ONEDRIVE: onedriveScopeSchema,
  GOOGLE_WORKSPACE: googleWorkspaceScopeSchema,
  SALESFORCE: salesforceScopeSchema,
  SERVICENOW: servicenowScopeSchema,
  ATLASSIAN_JIRA: atlassianScopeSchema,
  ATLASSIAN_CONFLUENCE: atlassianScopeSchema,
  WORKDAY: genericScopeSchema,
  SAP_SUCCESSFACTORS: genericScopeSchema,
  OKTA: genericScopeSchema,
  AWS: genericScopeSchema,
  AZURE: genericScopeSchema,
  GCP: genericScopeSchema,
};

/* ── Output Options ───────────────────────────────────────────────────── */

const outputOptionsSchema = z.object({
  mode: z.enum(["metadata_only", "include_content"]).default("metadata_only"),
  maxItems: z.number().int().positive().max(10000).default(500),
  includeAttachments: z.boolean().default(false),
});

/* ── Legal / Purpose ──────────────────────────────────────────────────── */

const legalSchema = z.object({
  purpose: z.literal("DSAR").default("DSAR"),
  dataMinimization: z.boolean().default(true),
  notes: z.string().max(2000).optional(),
});

/* ── Full QuerySpec ───────────────────────────────────────────────────── */

export const querySpecSchema = z.object({
  subjectIdentifiers: subjectIdentifiersSchema,
  timeRange: timeRangeSchema,
  searchTerms: searchTermsSchema,
  providerScope: z.record(z.unknown()),
  outputOptions: outputOptionsSchema.default({
    mode: "metadata_only",
    maxItems: 500,
    includeAttachments: false,
  }),
  legal: legalSchema.default({
    purpose: "DSAR",
    dataMinimization: true,
  }),
  templateId: z.string().optional(),
});

export type QuerySpec = z.infer<typeof querySpecSchema>;
export type SubjectIdentifiers = z.infer<typeof subjectIdentifiersSchema>;
export type TimeRange = z.infer<typeof timeRangeSchema>;
export type SearchTerms = z.infer<typeof searchTermsSchema>;
export type OutputOptions = z.infer<typeof outputOptionsSchema>;
export type LegalInfo = z.infer<typeof legalSchema>;

/* ── Validation helpers ───────────────────────────────────────────────── */

/**
 * Validate a full QuerySpec including provider-specific scope.
 * Throws ZodError if invalid.
 */
export function validateQuerySpec(
  data: unknown,
  provider?: string
): QuerySpec {
  // First validate the envelope
  const spec = querySpecSchema.parse(data);

  // Then validate provider-specific scope if provider is known
  if (provider && PROVIDER_SCOPE_SCHEMAS[provider]) {
    PROVIDER_SCOPE_SCHEMAS[provider].parse(spec.providerScope);
  }

  return spec;
}

/**
 * Validate just the QuerySpec envelope (no provider scope check).
 * Useful when provider isn't known at validation time.
 */
export function validateQuerySpecEnvelope(data: unknown): QuerySpec {
  return querySpecSchema.parse(data);
}

/**
 * Build a default QuerySpec for a given template.
 */
export function buildDefaultQuerySpec(templateId: string, provider: string): Partial<QuerySpec> {
  return {
    subjectIdentifiers: {
      primary: { type: "email", value: "" },
      alternatives: [],
    },
    outputOptions: {
      mode: "metadata_only",
      maxItems: 500,
      includeAttachments: false,
    },
    legal: {
      purpose: "DSAR",
      dataMinimization: true,
    },
    templateId,
    providerScope: {},
  };
}
