import type {
  Connector,
  ConnectorConfig,
  HealthCheckResult,
  CollectionResult,
  ConfigField,
  QueryTemplate,
} from "./types";

/**
 * Base class for stub connectors (coming soon).
 * Implements the Connector interface with placeholder behavior
 * so future work is drop-in.
 */
class StubConnector implements Connector {
  constructor(
    public provider: string,
    private configFields: ConfigField[],
    private queryTemplates: QueryTemplate[]
  ) {}

  getConfigFields(): ConfigField[] {
    return this.configFields;
  }

  getQueryTemplates(): QueryTemplate[] {
    return this.queryTemplates;
  }

  async healthCheck(
    _config: ConnectorConfig,
    _secretRef: string | null
  ): Promise<HealthCheckResult> {
    return {
      healthy: false,
      message: `${this.provider} connector is not yet implemented. Coming soon.`,
      details: { status: "NOT_CONFIGURED" },
      checkedAt: new Date(),
    };
  }

  async collectData(
    _config: ConnectorConfig,
    _secretRef: string | null,
    _querySpec: Record<string, unknown>
  ): Promise<CollectionResult> {
    return {
      success: false,
      recordsFound: 0,
      findingsSummary: `${this.provider} data collection is not yet implemented`,
      resultMetadata: {},
      error: "Provider not yet implemented",
    };
  }
}

export const GoogleWorkspaceConnector = new StubConnector(
  "GOOGLE_WORKSPACE",
  [
    {
      key: "serviceAccountJson",
      label: "Service Account JSON",
      type: "textarea",
      required: true,
      placeholder: '{"type":"service_account",...}',
      description: "Google Cloud service account key JSON",
      isSecret: true,
    },
    {
      key: "adminEmail",
      label: "Admin Email",
      type: "text",
      required: true,
      placeholder: "admin@company.com",
      description: "Workspace admin email for domain-wide delegation",
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
      id: "gmail_search",
      name: "Gmail Search",
      description: "Search Gmail for messages (coming soon)",
      fields: [
        { key: "userEmail", label: "User Email", type: "text", required: true, placeholder: "user@company.com" },
        { key: "query", label: "Search Query", type: "text", required: false, placeholder: "from:user@example.com" },
      ],
    },
    {
      id: "drive_search",
      name: "Google Drive Search",
      description: "Search Drive files (coming soon)",
      fields: [
        { key: "userEmail", label: "User Email", type: "text", required: true, placeholder: "user@company.com" },
        { key: "query", label: "Search Query", type: "text", required: false, placeholder: "filename" },
      ],
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
      id: "soql_query",
      name: "SOQL Query",
      description: "Query Salesforce objects (coming soon)",
      fields: [
        { key: "objectType", label: "Object Type", type: "select", required: true, options: [
          { label: "Contact", value: "Contact" },
          { label: "Lead", value: "Lead" },
          { label: "Account", value: "Account" },
          { label: "Case", value: "Case" },
        ] },
        { key: "email", label: "Email", type: "text", required: false, placeholder: "user@example.com" },
      ],
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
      id: "table_query",
      name: "Table Query",
      description: "Query ServiceNow table (coming soon)",
      fields: [
        { key: "table", label: "Table", type: "text", required: true, placeholder: "sys_user" },
        { key: "query", label: "Encoded Query", type: "text", required: false, placeholder: "email=user@example.com" },
      ],
    },
  ]
);

export const AWSConnector = new StubConnector(
  "AWS",
  [
    { key: "accessKeyId", label: "Access Key ID", type: "text", required: true, placeholder: "AKIAIOSFODNN7EXAMPLE" },
    { key: "secretAccessKey", label: "Secret Access Key", type: "password", required: true, placeholder: "Enter secret key", isSecret: true },
    { key: "region", label: "Region", type: "text", required: true, placeholder: "eu-west-1" },
  ],
  [
    {
      id: "s3_search",
      name: "S3 Bucket Search",
      description: "Search S3 bucket for objects (coming soon)",
      fields: [
        { key: "bucket", label: "Bucket Name", type: "text", required: true, placeholder: "my-data-bucket" },
        { key: "prefix", label: "Key Prefix", type: "text", required: false, placeholder: "users/john.smith/" },
      ],
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
      id: "blob_search",
      name: "Blob Storage Search",
      description: "Search Azure Blob Storage (coming soon)",
      fields: [
        { key: "storageAccount", label: "Storage Account", type: "text", required: true, placeholder: "mystorageaccount" },
        { key: "container", label: "Container", type: "text", required: true, placeholder: "documents" },
        { key: "prefix", label: "Blob Prefix", type: "text", required: false, placeholder: "users/john/" },
      ],
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
      id: "gcs_search",
      name: "Cloud Storage Search",
      description: "Search GCS bucket (coming soon)",
      fields: [
        { key: "bucket", label: "Bucket Name", type: "text", required: true, placeholder: "my-bucket" },
        { key: "prefix", label: "Object Prefix", type: "text", required: false, placeholder: "users/john/" },
      ],
    },
  ]
);
