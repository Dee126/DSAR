/**
 * AWS SDK v3 client factory — creates service clients from decrypted secrets.
 *
 * Supports two auth modes:
 *   1. access_keys — direct credentials
 *   2. assume_role — STS AssumeRole then use temporary credentials
 *
 * When env AWS_INTEGRATION_MOCK=true, all calls return deterministic fake data
 * so developers can test the full integration flow without real AWS credentials.
 */

import { STSClient, GetCallerIdentityCommand, AssumeRoleCommand } from "@aws-sdk/client-sts";
import { S3Client, ListBucketsCommand } from "@aws-sdk/client-s3";
import { RDSClient, DescribeDBInstancesCommand } from "@aws-sdk/client-rds";
import { DynamoDBClient, ListTablesCommand } from "@aws-sdk/client-dynamodb";

const DEFAULT_TIMEOUT_MS = 15_000;

function isMockMode(): boolean {
  return process.env.AWS_INTEGRATION_MOCK === "true";
}

export interface AwsSecrets {
  authType: "access_keys" | "assume_role";
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  region: string;
  roleArn?: string;
  externalId?: string;
}

interface AwsCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}

/**
 * Resolve final credentials — if assume_role, performs STS AssumeRole first.
 */
async function resolveCredentials(secrets: AwsSecrets): Promise<AwsCredentials> {
  const baseCredentials: AwsCredentials = {
    accessKeyId: secrets.accessKeyId,
    secretAccessKey: secrets.secretAccessKey,
    sessionToken: secrets.sessionToken,
  };

  if (secrets.authType !== "assume_role") {
    return baseCredentials;
  }

  if (!secrets.roleArn) {
    throw new Error("roleArn is required for assume_role auth type");
  }

  const stsClient = new STSClient({
    region: secrets.region,
    credentials: baseCredentials,
    requestHandler: { requestTimeout: DEFAULT_TIMEOUT_MS } as any,
  });

  const response = await stsClient.send(
    new AssumeRoleCommand({
      RoleArn: secrets.roleArn,
      RoleSessionName: "PrivacyPilot-DSAR",
      ExternalId: secrets.externalId || undefined,
      DurationSeconds: 900, // minimum: 15 minutes
    })
  );

  if (!response.Credentials) {
    throw new Error("AssumeRole returned no credentials");
  }

  return {
    accessKeyId: response.Credentials.AccessKeyId!,
    secretAccessKey: response.Credentials.SecretAccessKey!,
    sessionToken: response.Credentials.SessionToken,
  };
}

/**
 * Test the connection by calling STS GetCallerIdentity.
 * In mock mode, returns deterministic fake identity data.
 */
export async function testAwsConnection(secrets: AwsSecrets): Promise<{
  account: string;
  arn: string;
  userId: string;
}> {
  if (isMockMode()) {
    // Simulate a short network delay
    await new Promise((r) => setTimeout(r, 300));
    return {
      account: "123456789012",
      arn: secrets.authType === "assume_role"
        ? `arn:aws:sts::123456789012:assumed-role/${secrets.roleArn?.split("/").pop() ?? "MockRole"}/PrivacyPilot-DSAR`
        : "arn:aws:iam::123456789012:user/privacypilot-dev",
      userId: "AIDAMOCKUSERID123456",
    };
  }

  const creds = await resolveCredentials(secrets);

  const stsClient = new STSClient({
    region: secrets.region,
    credentials: creds,
    requestHandler: { requestTimeout: DEFAULT_TIMEOUT_MS } as any,
  });

  const identity = await stsClient.send(new GetCallerIdentityCommand({}));

  return {
    account: identity.Account ?? "unknown",
    arn: identity.Arn ?? "unknown",
    userId: identity.UserId ?? "unknown",
  };
}

export interface ScanSummary {
  s3Buckets: number;
  rdsInstances: number;
  dynamoTables: number;
  items: ScanItem[];
}

export interface ScanItem {
  resourceType: string;
  resourceId: string;
  resourceName: string;
  region: string;
  metaJson: Record<string, unknown>;
}

/**
 * Run a metadata inventory scan across S3, RDS, and DynamoDB.
 * In mock mode, returns deterministic fake resources:
 *   3 S3 buckets, 1 RDS instance, 2 DynamoDB tables.
 */
export async function scanAwsResources(secrets: AwsSecrets): Promise<ScanSummary> {
  if (isMockMode()) {
    await new Promise((r) => setTimeout(r, 500));
    return buildMockScanSummary(secrets.region);
  }

  const creds = await resolveCredentials(secrets);
  const items: ScanItem[] = [];

  // S3: ListBuckets (global — region doesn't matter much)
  const s3Client = new S3Client({
    region: secrets.region,
    credentials: creds,
    requestHandler: { requestTimeout: DEFAULT_TIMEOUT_MS } as any,
  });

  let s3Buckets = 0;
  try {
    const s3Response = await s3Client.send(new ListBucketsCommand({}));
    const buckets = s3Response.Buckets ?? [];
    s3Buckets = buckets.length;
    for (const bucket of buckets) {
      items.push({
        resourceType: "s3_bucket",
        resourceId: bucket.Name ?? "unknown",
        resourceName: bucket.Name ?? "unknown",
        region: secrets.region,
        metaJson: {
          creationDate: bucket.CreationDate?.toISOString() ?? null,
        },
      });
    }
  } catch (err) {
    items.push({
      resourceType: "s3_bucket",
      resourceId: "_error",
      resourceName: "S3 ListBuckets failed",
      region: secrets.region,
      metaJson: { error: err instanceof Error ? err.message : String(err) },
    });
  }

  // RDS: DescribeDBInstances
  const rdsClient = new RDSClient({
    region: secrets.region,
    credentials: creds,
    requestHandler: { requestTimeout: DEFAULT_TIMEOUT_MS } as any,
  });

  let rdsInstances = 0;
  try {
    const rdsResponse = await rdsClient.send(new DescribeDBInstancesCommand({}));
    const instances = rdsResponse.DBInstances ?? [];
    rdsInstances = instances.length;
    for (const db of instances) {
      items.push({
        resourceType: "rds_instance",
        resourceId: db.DBInstanceIdentifier ?? "unknown",
        resourceName: db.DBInstanceIdentifier ?? "unknown",
        region: db.AvailabilityZone ?? secrets.region,
        metaJson: {
          engine: db.Engine ?? null,
          engineVersion: db.EngineVersion ?? null,
          instanceClass: db.DBInstanceClass ?? null,
          status: db.DBInstanceStatus ?? null,
          storageEncrypted: db.StorageEncrypted ?? null,
        },
      });
    }
  } catch (err) {
    items.push({
      resourceType: "rds_instance",
      resourceId: "_error",
      resourceName: "RDS DescribeDBInstances failed",
      region: secrets.region,
      metaJson: { error: err instanceof Error ? err.message : String(err) },
    });
  }

  // DynamoDB: ListTables
  const ddbClient = new DynamoDBClient({
    region: secrets.region,
    credentials: creds,
    requestHandler: { requestTimeout: DEFAULT_TIMEOUT_MS } as any,
  });

  let dynamoTables = 0;
  try {
    const ddbResponse = await ddbClient.send(new ListTablesCommand({}));
    const tables = ddbResponse.TableNames ?? [];
    dynamoTables = tables.length;
    for (const tableName of tables) {
      items.push({
        resourceType: "dynamodb_table",
        resourceId: tableName,
        resourceName: tableName,
        region: secrets.region,
        metaJson: {},
      });
    }
  } catch (err) {
    items.push({
      resourceType: "dynamodb_table",
      resourceId: "_error",
      resourceName: "DynamoDB ListTables failed",
      region: secrets.region,
      metaJson: { error: err instanceof Error ? err.message : String(err) },
    });
  }

  return { s3Buckets, rdsInstances, dynamoTables, items };
}

/* ── Mock data (used when AWS_INTEGRATION_MOCK=true) ─────────────── */

function buildMockScanSummary(region: string): ScanSummary {
  const items: ScanItem[] = [
    // 3 S3 buckets
    {
      resourceType: "s3_bucket",
      resourceId: "acme-corp-data-lake",
      resourceName: "acme-corp-data-lake",
      region,
      metaJson: { creationDate: "2024-03-15T10:30:00.000Z" },
    },
    {
      resourceType: "s3_bucket",
      resourceId: "acme-corp-logs",
      resourceName: "acme-corp-logs",
      region,
      metaJson: { creationDate: "2024-06-01T08:00:00.000Z" },
    },
    {
      resourceType: "s3_bucket",
      resourceId: "acme-corp-backups",
      resourceName: "acme-corp-backups",
      region,
      metaJson: { creationDate: "2025-01-10T14:22:00.000Z" },
    },
    // 1 RDS instance
    {
      resourceType: "rds_instance",
      resourceId: "acme-production-db",
      resourceName: "acme-production-db",
      region: `${region}a`,
      metaJson: {
        engine: "postgres",
        engineVersion: "15.4",
        instanceClass: "db.r6g.large",
        status: "available",
        storageEncrypted: true,
      },
    },
    // 2 DynamoDB tables
    {
      resourceType: "dynamodb_table",
      resourceId: "UserSessions",
      resourceName: "UserSessions",
      region,
      metaJson: {},
    },
    {
      resourceType: "dynamodb_table",
      resourceId: "AuditEvents",
      resourceName: "AuditEvents",
      region,
      metaJson: {},
    },
  ];

  return {
    s3Buckets: 3,
    rdsInstances: 1,
    dynamoTables: 2,
    items,
  };
}
