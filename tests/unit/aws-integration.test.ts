import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import { STSClient, GetCallerIdentityCommand, AssumeRoleCommand } from "@aws-sdk/client-sts";
import { S3Client, ListBucketsCommand } from "@aws-sdk/client-s3";
import { RDSClient, DescribeDBInstancesCommand } from "@aws-sdk/client-rds";
import { DynamoDBClient, ListTablesCommand } from "@aws-sdk/client-dynamodb";
import { testAwsConnection, scanAwsResources } from "@/lib/aws-clients";
import type { AwsSecrets } from "@/lib/aws-clients";

// Mock clients
const stsMock = mockClient(STSClient);
const s3Mock = mockClient(S3Client);
const rdsMock = mockClient(RDSClient);
const ddbMock = mockClient(DynamoDBClient);

const validAccessKeySecrets: AwsSecrets = {
  authType: "access_keys",
  accessKeyId: "AKIAIOSFODNN7EXAMPLE",
  secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
  region: "eu-central-1",
};

const validAssumeRoleSecrets: AwsSecrets = {
  authType: "assume_role",
  accessKeyId: "AKIAIOSFODNN7EXAMPLE",
  secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
  region: "eu-central-1",
  roleArn: "arn:aws:iam::123456789012:role/DSARCollector",
  externalId: "ext-id-123",
};

describe("aws-clients", () => {
  beforeEach(() => {
    stsMock.reset();
    s3Mock.reset();
    rdsMock.reset();
    ddbMock.reset();
  });

  afterEach(() => {
    stsMock.restore();
    s3Mock.restore();
    rdsMock.restore();
    ddbMock.restore();
  });

  // ─── testAwsConnection ────────────────────────────────────────────────

  describe("testAwsConnection", () => {
    it("should return identity for valid access_keys credentials", async () => {
      stsMock.on(GetCallerIdentityCommand).resolves({
        Account: "123456789012",
        Arn: "arn:aws:iam::123456789012:user/admin",
        UserId: "AIDAJDPLRKLG7UEXAMPLE",
      });

      const result = await testAwsConnection(validAccessKeySecrets);

      expect(result).toEqual({
        account: "123456789012",
        arn: "arn:aws:iam::123456789012:user/admin",
        userId: "AIDAJDPLRKLG7UEXAMPLE",
      });
    });

    it("should perform AssumeRole then GetCallerIdentity for assume_role auth", async () => {
      stsMock.on(AssumeRoleCommand).resolves({
        Credentials: {
          AccessKeyId: "ASIATEMP",
          SecretAccessKey: "tempSecret",
          SessionToken: "tempToken",
          Expiration: new Date(),
        },
      });
      stsMock.on(GetCallerIdentityCommand).resolves({
        Account: "987654321098",
        Arn: "arn:aws:sts::987654321098:assumed-role/DSARCollector/PrivacyPilot-DSAR",
        UserId: "AROA3XFRBF23",
      });

      const result = await testAwsConnection(validAssumeRoleSecrets);

      expect(result.account).toBe("987654321098");
      expect(result.arn).toContain("assumed-role");
    });

    it("should throw when AWS returns an error (invalid credentials)", async () => {
      stsMock.on(GetCallerIdentityCommand).rejects(
        new Error("The security token included in the request is invalid.")
      );

      await expect(testAwsConnection(validAccessKeySecrets)).rejects.toThrow(
        "The security token included in the request is invalid."
      );
    });

    it("should throw when AssumeRole fails", async () => {
      stsMock.on(AssumeRoleCommand).rejects(
        new Error("User: arn:aws:iam::123456789012:user/admin is not authorized to perform: sts:AssumeRole")
      );

      await expect(testAwsConnection(validAssumeRoleSecrets)).rejects.toThrow(
        "is not authorized to perform"
      );
    });

    it("should throw when assume_role has no roleArn", async () => {
      const secrets: AwsSecrets = {
        ...validAssumeRoleSecrets,
        roleArn: undefined,
      };

      await expect(testAwsConnection(secrets)).rejects.toThrow(
        "roleArn is required for assume_role auth type"
      );
    });
  });

  // ─── scanAwsResources ──────────────────────────────────────────────────

  describe("scanAwsResources", () => {
    it("should return resource counts from S3, RDS, and DynamoDB", async () => {
      s3Mock.on(ListBucketsCommand).resolves({
        Buckets: [
          { Name: "my-data-bucket", CreationDate: new Date("2024-01-01") },
          { Name: "logs-bucket", CreationDate: new Date("2024-06-15") },
        ],
      });

      rdsMock.on(DescribeDBInstancesCommand).resolves({
        DBInstances: [
          {
            DBInstanceIdentifier: "prod-db",
            Engine: "postgres",
            EngineVersion: "15.4",
            DBInstanceClass: "db.t3.medium",
            DBInstanceStatus: "available",
            AvailabilityZone: "eu-central-1a",
            StorageEncrypted: true,
          },
        ],
      });

      ddbMock.on(ListTablesCommand).resolves({
        TableNames: ["users-table", "orders-table", "audit-log"],
      });

      const result = await scanAwsResources(validAccessKeySecrets);

      expect(result.s3Buckets).toBe(2);
      expect(result.rdsInstances).toBe(1);
      expect(result.dynamoTables).toBe(3);
      expect(result.items).toHaveLength(6);

      // Verify S3 items
      const s3Items = result.items.filter((i) => i.resourceType === "s3_bucket");
      expect(s3Items).toHaveLength(2);
      expect(s3Items[0].resourceName).toBe("my-data-bucket");

      // Verify RDS items
      const rdsItems = result.items.filter((i) => i.resourceType === "rds_instance");
      expect(rdsItems).toHaveLength(1);
      expect(rdsItems[0].metaJson.engine).toBe("postgres");
      expect(rdsItems[0].metaJson.storageEncrypted).toBe(true);

      // Verify DynamoDB items
      const ddbItems = result.items.filter((i) => i.resourceType === "dynamodb_table");
      expect(ddbItems).toHaveLength(3);
      expect(ddbItems.map((i) => i.resourceId)).toEqual([
        "users-table",
        "orders-table",
        "audit-log",
      ]);
    });

    it("should handle empty responses gracefully", async () => {
      s3Mock.on(ListBucketsCommand).resolves({ Buckets: [] });
      rdsMock.on(DescribeDBInstancesCommand).resolves({ DBInstances: [] });
      ddbMock.on(ListTablesCommand).resolves({ TableNames: [] });

      const result = await scanAwsResources(validAccessKeySecrets);

      expect(result.s3Buckets).toBe(0);
      expect(result.rdsInstances).toBe(0);
      expect(result.dynamoTables).toBe(0);
      expect(result.items).toHaveLength(0);
    });

    it("should capture partial failures per service without failing the entire scan", async () => {
      // S3 succeeds
      s3Mock.on(ListBucketsCommand).resolves({
        Buckets: [{ Name: "ok-bucket", CreationDate: new Date() }],
      });

      // RDS fails (e.g., permission denied)
      rdsMock.on(DescribeDBInstancesCommand).rejects(
        new Error("User is not authorized to perform rds:DescribeDBInstances")
      );

      // DynamoDB succeeds
      ddbMock.on(ListTablesCommand).resolves({
        TableNames: ["table-1"],
      });

      const result = await scanAwsResources(validAccessKeySecrets);

      expect(result.s3Buckets).toBe(1);
      expect(result.rdsInstances).toBe(0);
      expect(result.dynamoTables).toBe(1);

      // Should have 3 items: 1 S3 bucket + 1 RDS error + 1 DynamoDB table
      expect(result.items).toHaveLength(3);

      const rdsError = result.items.find(
        (i) => i.resourceType === "rds_instance" && i.resourceId === "_error"
      );
      expect(rdsError).toBeDefined();
      expect(rdsError!.metaJson.error).toContain("not authorized");
    });

    it("should use assume_role credentials for scan", async () => {
      stsMock.on(AssumeRoleCommand).resolves({
        Credentials: {
          AccessKeyId: "ASIATEMP",
          SecretAccessKey: "tempSecret",
          SessionToken: "tempToken",
          Expiration: new Date(),
        },
      });

      s3Mock.on(ListBucketsCommand).resolves({ Buckets: [] });
      rdsMock.on(DescribeDBInstancesCommand).resolves({ DBInstances: [] });
      ddbMock.on(ListTablesCommand).resolves({ TableNames: [] });

      const result = await scanAwsResources(validAssumeRoleSecrets);

      expect(result.s3Buckets).toBe(0);
      expect(result.rdsInstances).toBe(0);
      expect(result.dynamoTables).toBe(0);
    });
  });

  // ─── Validation schema ──────────────────────────────────────────────────

  describe("createAwsIntegrationSchema", () => {
    // Inline import since it's a pure Zod schema
    it("should validate a valid access_keys payload", async () => {
      const { createAwsIntegrationSchema } = await import("@/lib/validation");

      const result = createAwsIntegrationSchema.safeParse({
        name: "AWS - Production",
        region: "eu-central-1",
        authType: "access_keys",
        accessKeyId: "AKIAIOSFODNN7EXAMPLE",
        secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      });

      expect(result.success).toBe(true);
    });

    it("should validate a valid assume_role payload", async () => {
      const { createAwsIntegrationSchema } = await import("@/lib/validation");

      const result = createAwsIntegrationSchema.safeParse({
        name: "AWS - Cross Account",
        region: "us-west-2",
        authType: "assume_role",
        accessKeyId: "AKIAIOSFODNN7EXAMPLE",
        secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        roleArn: "arn:aws:iam::123456789012:role/DSARCollector",
        externalId: "ext-123",
      });

      expect(result.success).toBe(true);
    });

    it("should reject assume_role without roleArn", async () => {
      const { createAwsIntegrationSchema } = await import("@/lib/validation");

      const result = createAwsIntegrationSchema.safeParse({
        name: "AWS - Missing Role",
        region: "eu-central-1",
        authType: "assume_role",
        accessKeyId: "AKIAIOSFODNN7EXAMPLE",
        secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      });

      expect(result.success).toBe(false);
    });

    it("should reject missing required fields", async () => {
      const { createAwsIntegrationSchema } = await import("@/lib/validation");

      const result = createAwsIntegrationSchema.safeParse({
        name: "AWS",
        region: "eu-central-1",
        // missing accessKeyId and secretAccessKey
      });

      expect(result.success).toBe(false);
    });

    it("should reject empty name", async () => {
      const { createAwsIntegrationSchema } = await import("@/lib/validation");

      const result = createAwsIntegrationSchema.safeParse({
        name: "",
        region: "eu-central-1",
        accessKeyId: "AKIAIOSFODNN7EXAMPLE",
        secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      });

      expect(result.success).toBe(false);
    });
  });
});
