import { decrypt } from "@/lib/security/encryption";
import { createPendingResult, completeResult } from "@/lib/result-metadata";
import type { QuerySpec } from "@/lib/query-spec";
import type {
  Connector,
  ConnectorConfig,
  HealthCheckResult,
  CollectionResult,
  ConfigField,
  QueryTemplate,
} from "./types";

/**
 * AWS Connector — supports Access-Key and Assume-Role authentication.
 *
 * Config fields model the encrypted JSON payload:
 * {
 *   authType: "access_keys" | "assume_role",
 *   accessKeyId, secretAccessKey, sessionToken?,
 *   region, roleArn?, externalId?
 * }
 *
 * Secret fields (accessKeyId, secretAccessKey, sessionToken) are encrypted
 * via the IntegrationSecret table (AES-256-GCM).
 */
export class AwsConnector implements Connector {
  provider = "AWS";

  getConfigFields(): ConfigField[] {
    return [
      {
        key: "authType",
        label: "Authentication Type",
        type: "select",
        required: true,
        description: "How to authenticate with AWS",
        options: [
          { label: "Access Keys", value: "access_keys" },
          { label: "Assume Role (STS)", value: "assume_role" },
        ],
      },
      {
        key: "accessKeyId",
        label: "Access Key ID",
        type: "text",
        required: true,
        placeholder: "AKIAIOSFODNN7EXAMPLE",
        isSecret: true,
      },
      {
        key: "secretAccessKey",
        label: "Secret Access Key",
        type: "password",
        required: true,
        placeholder: "Enter secret access key",
        isSecret: true,
      },
      {
        key: "sessionToken",
        label: "Session Token",
        type: "password",
        required: false,
        placeholder: "Optional — for temporary credentials",
        description: "Required when using temporary security credentials",
        isSecret: true,
      },
      {
        key: "region",
        label: "AWS Region",
        type: "text",
        required: true,
        placeholder: "eu-central-1",
        description: "Default region for API calls",
      },
      {
        key: "roleArn",
        label: "Role ARN",
        type: "text",
        required: false,
        placeholder: "arn:aws:iam::123456789012:role/DSARCollector",
        description: "Required when using Assume Role authentication",
      },
      {
        key: "externalId",
        label: "External ID",
        type: "text",
        required: false,
        placeholder: "Optional external ID for AssumeRole",
        description: "Third-party external ID for cross-account access",
      },
    ];
  }

  getQueryTemplates(): QueryTemplate[] {
    return [
      {
        id: "aws_s3_search",
        name: "S3 Bucket Search",
        description:
          "Search S3 bucket for objects matching subject identifiers",
        scopeFields: [
          {
            key: "bucket",
            label: "Bucket Name",
            type: "text",
            required: true,
            placeholder: "my-data-bucket",
          },
          {
            key: "prefix",
            label: "Key Prefix",
            type: "text",
            required: false,
            placeholder: "users/john.smith/",
            description: "Limit search to objects with this key prefix",
          },
        ],
        defaultScope: {},
      },
      {
        id: "aws_dynamodb_search",
        name: "DynamoDB Table Search",
        description:
          "Query DynamoDB tables for records matching subject identifiers",
        scopeFields: [
          {
            key: "tableName",
            label: "Table Name",
            type: "text",
            required: true,
            placeholder: "users-table",
          },
          {
            key: "indexName",
            label: "Index Name",
            type: "text",
            required: false,
            placeholder: "email-index",
            description: "GSI to query (leave blank for primary key)",
          },
        ],
        defaultScope: {},
      },
    ];
  }

  async healthCheck(
    config: ConnectorConfig,
    secretRef: string | null
  ): Promise<HealthCheckResult> {
    const now = new Date();
    try {
      // Verify we can decrypt secrets
      if (!secretRef) {
        return {
          healthy: false,
          message: "No credentials configured. Add AWS credentials to enable.",
          details: { status: "NOT_CONFIGURED" },
          checkedAt: now,
        };
      }

      const secrets = JSON.parse(decrypt(secretRef));
      const region = (config.region as string) || secrets.region;
      const authType = (config.authType as string) || secrets.authType || "access_keys";

      if (!secrets.accessKeyId || !secrets.secretAccessKey) {
        return {
          healthy: false,
          message: "Incomplete credentials: accessKeyId and secretAccessKey are required.",
          details: { status: "NOT_CONFIGURED" },
          checkedAt: now,
        };
      }

      if (authType === "assume_role") {
        const roleArn = (config.roleArn as string) || secrets.roleArn;
        if (!roleArn) {
          return {
            healthy: false,
            message: "Assume Role selected but no Role ARN provided.",
            details: { status: "NOT_CONFIGURED" },
            checkedAt: now,
          };
        }
      }

      // In a real implementation this would call STS GetCallerIdentity.
      // For now we validate that credentials are present and well-formed.
      return {
        healthy: true,
        message: `AWS credentials configured (${authType}, region: ${region || "not set"})`,
        details: {
          status: "HEALTHY",
          authType,
          region,
          hasSessionToken: !!secrets.sessionToken,
        },
        checkedAt: now,
      };
    } catch (err) {
      return {
        healthy: false,
        message: `Health check failed: ${err instanceof Error ? err.message : String(err)}`,
        details: { status: "FAILED" },
        checkedAt: now,
      };
    }
  }

  async collectData(
    _config: ConnectorConfig,
    _secretRef: string | null,
    _querySpec: QuerySpec
  ): Promise<CollectionResult> {
    // Data collection will be implemented when AWS SDK integration is complete.
    const result = createPendingResult("AWS", "s3");
    return {
      success: false,
      recordsFound: 0,
      findingsSummary:
        "AWS data collection is not yet fully implemented. Credentials and health checks are available.",
      resultMetadata: completeResult(result, {
        status: "failed",
        errorMessage: "AWS data collection not yet implemented",
      }),
      error: "AWS data collection not yet implemented",
    };
  }
}
