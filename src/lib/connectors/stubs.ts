/**
 * Stub connectors for Phase 2–4 providers.
 *
 * Each stub has full config-field + query-template definitions so the UI
 * can render provider setup and collection forms.  Health checks return
 * NOT_CONFIGURED / "coming soon" and collectData returns NOT_IMPLEMENTED.
 */

import type {
  Connector,
  ConnectorConfig,
  HealthCheckResult,
  CollectionResult,
  ConfigField,
  QueryTemplate,
} from "./types";
import { createPendingResult, completeResult } from "@/lib/result-metadata";
import type { QuerySpec } from "@/lib/query-spec";

/* ── Base stub ────────────────────────────────────────────────────────── */

class StubConnector implements Connector {
  constructor(
    public provider: string,
    private _configFields: ConfigField[],
    private _queryTemplates: QueryTemplate[]
  ) {}

  getConfigFields(): ConfigField[] {
    return this._configFields;
  }

  getQueryTemplates(): QueryTemplate[] {
    return this._queryTemplates;
  }

  async healthCheck(
    _config: ConnectorConfig,
    _secretRef: string | null
  ): Promise<HealthCheckResult> {
    return {
      healthy: false,
      message: `${this.provider} connector is not yet implemented. Coming soon.`,
      details: { status: "NOT_CONFIGURED", comingSoon: true },
      checkedAt: new Date(),
    };
  }

  async collectData(
    _config: ConnectorConfig,
    _secretRef: string | null,
    _querySpec: QuerySpec
  ): Promise<CollectionResult> {
    const result = createPendingResult(this.provider, "stub");
    return {
      success: false,
      recordsFound: 0,
      findingsSummary: `${this.provider} data collection is not yet implemented`,
      resultMetadata: completeResult(result, {
        status: "failed",
        errorMessage: "Provider not yet implemented",
      }),
      error: "Provider not yet implemented",
    };
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   Phase 2 — High Business Value
   ═══════════════════════════════════════════════════════════════════════ */

export const GoogleWorkspaceConnector = new StubConnector(
  "GOOGLE_WORKSPACE",
  [
    {
      key: "serviceAccountJson",
      label: "Service Account JSON",
      type: "textarea",
      required: true,
      placeholder: '{"type":"service_account",...}',
      description: "Google Cloud service account key JSON with domain-wide delegation",
      isSecret: true,
    },
    {
      key: "adminEmail",
      label: "Admin Email",
      type: "text",
      required: true,
      placeholder: "admin@company.com",
      description: "Workspace super-admin email for domain-wide delegation",
    },
    {
      key: "domain",
      label: "Domain",
      type: "text",
      required: true,
      placeholder: "company.com",
    },
  ],
  [
    {
      id: "google_gmail_search",
      name: "Gmail Search",
      description: "Search Gmail mailbox for messages matching subject criteria (Phase 2)",
      scopeFields: [
        { key: "labels", label: "Gmail Labels", type: "textarea", required: false, placeholder: "INBOX, SENT", description: "Comma-separated labels to search" },
      ],
      defaultScope: { services: ["gmail"], labels: [] },
    },
    {
      id: "google_drive_search",
      name: "Google Drive Search",
      description: "Search Drive files owned by or shared with subject (Phase 2)",
      scopeFields: [
        { key: "folders", label: "Folder IDs", type: "textarea", required: false, placeholder: "root", description: "Comma-separated folder IDs" },
      ],
      defaultScope: { services: ["drive"], folders: [] },
    },
  ]
);

export const SalesforceConnector = new StubConnector(
  "SALESFORCE",
  [
    { key: "instanceUrl", label: "Instance URL", type: "text", required: true, placeholder: "https://yourorg.salesforce.com" },
    { key: "clientId", label: "Connected App Client ID", type: "text", required: true, placeholder: "Consumer Key" },
    { key: "clientSecret", label: "Client Secret", type: "password", required: true, placeholder: "Consumer Secret", isSecret: true },
    { key: "username", label: "Integration User", type: "text", required: true, placeholder: "api-user@company.com" },
  ],
  [
    {
      id: "salesforce_contact_search",
      name: "Contact / Case Search",
      description: "Search Salesforce Contacts, Leads, Cases, and Attachments for subject data (Phase 2)",
      scopeFields: [
        { key: "objects", label: "Objects to Search", type: "textarea", required: true, placeholder: "Contact, Lead, Case", description: "Comma-separated Salesforce object names" },
        { key: "includeAttachments", label: "Include Attachments", type: "select", required: false, options: [{ label: "No", value: "false" }, { label: "Yes", value: "true" }] },
      ],
      defaultScope: { objects: ["Contact", "Lead", "Case"], fields: [], includeAttachments: false },
    },
  ]
);

export const ServiceNowConnector = new StubConnector(
  "SERVICENOW",
  [
    { key: "instanceUrl", label: "Instance URL", type: "text", required: true, placeholder: "https://yourinstance.service-now.com" },
    { key: "username", label: "Username", type: "text", required: true, placeholder: "api-user" },
    { key: "password", label: "Password", type: "password", required: true, placeholder: "Enter password", isSecret: true },
  ],
  [
    {
      id: "servicenow_table_query",
      name: "Incident / HR Case Search",
      description: "Search ServiceNow tables (Incidents, HR Cases, Knowledge) for DSAR-relevant data (Phase 2)",
      scopeFields: [
        { key: "tables", label: "Tables", type: "textarea", required: true, placeholder: "sys_user, incident, sn_hr_core_case", description: "Comma-separated table names" },
        { key: "includeAttachments", label: "Include Attachments", type: "select", required: false, options: [{ label: "No", value: "false" }, { label: "Yes", value: "true" }] },
        { key: "includeNotes", label: "Include Notes", type: "select", required: false, options: [{ label: "Yes", value: "true" }, { label: "No", value: "false" }] },
      ],
      defaultScope: { tables: ["sys_user", "incident"], includeAttachments: false, includeNotes: true },
    },
  ]
);

/* ═══════════════════════════════════════════════════════════════════════
   Phase 3 — Customer-Dependent
   ═══════════════════════════════════════════════════════════════════════ */

export const AtlassianJiraConnector = new StubConnector(
  "ATLASSIAN_JIRA",
  [
    { key: "cloudUrl", label: "Atlassian Cloud URL", type: "text", required: true, placeholder: "https://yourorg.atlassian.net" },
    { key: "email", label: "Service Account Email", type: "text", required: true, placeholder: "service@company.com" },
    { key: "apiToken", label: "API Token", type: "password", required: true, placeholder: "Enter API token", isSecret: true },
  ],
  [
    {
      id: "jira_issue_search",
      name: "Jira Issue Search",
      description: "Search Jira issues (reporter, assignee, mentions) for subject data (Phase 3)",
      scopeFields: [
        { key: "projectKeys", label: "Project Keys", type: "textarea", required: false, placeholder: "PROJ, SUPPORT", description: "Comma-separated project keys (blank = all)" },
      ],
      defaultScope: { products: ["jira"], projectKeys: [] },
    },
  ]
);

export const AtlassianConfluenceConnector = new StubConnector(
  "ATLASSIAN_CONFLUENCE",
  [
    { key: "cloudUrl", label: "Atlassian Cloud URL", type: "text", required: true, placeholder: "https://yourorg.atlassian.net" },
    { key: "email", label: "Service Account Email", type: "text", required: true, placeholder: "service@company.com" },
    { key: "apiToken", label: "API Token", type: "password", required: true, placeholder: "Enter API token", isSecret: true },
  ],
  [
    {
      id: "confluence_content_search",
      name: "Confluence Content Search",
      description: "Search Confluence pages and blog posts authored by or mentioning subject (Phase 3)",
      scopeFields: [
        { key: "spaceKeys", label: "Space Keys", type: "textarea", required: false, placeholder: "HR, LEGAL", description: "Comma-separated space keys (blank = all)" },
      ],
      defaultScope: { products: ["confluence"], spaceKeys: [] },
    },
  ]
);

export const WorkdayConnector = new StubConnector(
  "WORKDAY",
  [
    { key: "apiUrl", label: "Workday API URL", type: "text", required: true, placeholder: "https://wd3-impl-services1.workday.com" },
    { key: "tenantAlias", label: "Tenant Alias", type: "text", required: true, placeholder: "your_tenant" },
    { key: "clientId", label: "Client ID", type: "text", required: true, placeholder: "OAuth client ID" },
    { key: "clientSecret", label: "Client Secret", type: "password", required: true, placeholder: "OAuth client secret", isSecret: true },
  ],
  [
    {
      id: "workday_worker_search",
      name: "Worker Profile Search",
      description: "Retrieve worker profile, compensation, and personal data from Workday (Phase 3)",
      scopeFields: [],
      defaultScope: {},
    },
  ]
);

export const SAPSuccessFactorsConnector = new StubConnector(
  "SAP_SUCCESSFACTORS",
  [
    { key: "apiUrl", label: "API Base URL", type: "text", required: true, placeholder: "https://api.successfactors.com" },
    { key: "companyId", label: "Company ID", type: "text", required: true, placeholder: "your_company_id" },
    { key: "clientId", label: "Client ID", type: "text", required: true, placeholder: "OAuth client ID" },
    { key: "clientSecret", label: "Client Secret", type: "password", required: true, placeholder: "OAuth client secret", isSecret: true },
  ],
  [
    {
      id: "sf_employee_search",
      name: "Employee Data Search",
      description: "Retrieve employee personal data, employment history from SuccessFactors (Phase 3)",
      scopeFields: [],
      defaultScope: {},
    },
  ]
);

export const OktaConnector = new StubConnector(
  "OKTA",
  [
    { key: "orgUrl", label: "Okta Org URL", type: "text", required: true, placeholder: "https://yourorg.okta.com" },
    { key: "apiToken", label: "API Token", type: "password", required: true, placeholder: "SSWS token", isSecret: true },
  ],
  [
    {
      id: "okta_user_search",
      name: "Okta User & Activity Search",
      description: "Retrieve user profile, app assignments, and sign-in activity from Okta (Phase 3)",
      scopeFields: [],
      defaultScope: {},
    },
  ]
);

/* ═══════════════════════════════════════════════════════════════════════
   Phase 4 — Cloud Providers (DSAR-relevant only if PII in storage/logs)
   ═══════════════════════════════════════════════════════════════════════ */

export const AWSConnector = new StubConnector(
  "AWS",
  [
    { key: "accessKeyId", label: "Access Key ID", type: "text", required: true, placeholder: "AKIAIOSFODNN7EXAMPLE" },
    { key: "secretAccessKey", label: "Secret Access Key", type: "password", required: true, placeholder: "Enter secret key", isSecret: true },
    { key: "region", label: "Region", type: "text", required: true, placeholder: "eu-west-1" },
  ],
  [
    {
      id: "aws_s3_search",
      name: "S3 Bucket Search",
      description: "Search S3 bucket for objects matching subject identifiers (Phase 4)",
      scopeFields: [
        { key: "bucket", label: "Bucket Name", type: "text", required: true, placeholder: "my-data-bucket" },
        { key: "prefix", label: "Key Prefix", type: "text", required: false, placeholder: "users/john.smith/" },
      ],
      defaultScope: {},
    },
  ]
);

export const AzureConnector = new StubConnector(
  "AZURE",
  [
    { key: "tenantId", label: "Tenant ID", type: "text", required: true, placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" },
    { key: "clientId", label: "Client ID", type: "text", required: true, placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" },
    { key: "clientSecret", label: "Client Secret", type: "password", required: true, placeholder: "Enter secret", isSecret: true },
    { key: "subscriptionId", label: "Subscription ID", type: "text", required: false, placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" },
  ],
  [
    {
      id: "azure_blob_search",
      name: "Blob Storage Search",
      description: "Search Azure Blob Storage containers for subject data (Phase 4)",
      scopeFields: [
        { key: "storageAccount", label: "Storage Account", type: "text", required: true, placeholder: "mystorageaccount" },
        { key: "container", label: "Container", type: "text", required: true, placeholder: "documents" },
        { key: "prefix", label: "Blob Prefix", type: "text", required: false, placeholder: "users/john/" },
      ],
      defaultScope: {},
    },
  ]
);

export const GCPConnector = new StubConnector(
  "GCP",
  [
    { key: "serviceAccountJson", label: "Service Account JSON", type: "textarea", required: true, placeholder: '{"type":"service_account",...}', isSecret: true },
    { key: "projectId", label: "Project ID", type: "text", required: true, placeholder: "my-gcp-project" },
  ],
  [
    {
      id: "gcp_gcs_search",
      name: "Cloud Storage Search",
      description: "Search GCS bucket for objects matching subject identifiers (Phase 4)",
      scopeFields: [
        { key: "bucket", label: "Bucket Name", type: "text", required: true, placeholder: "my-bucket" },
        { key: "prefix", label: "Object Prefix", type: "text", required: false, placeholder: "users/john/" },
      ],
      defaultScope: {},
    },
  ]
);
