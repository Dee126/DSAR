import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── API Key Auth Tests ─────────────────────────────────────────────────────

describe("Module 8.6: Integration Hardening", () => {
  describe("API Key Auth", () => {
    it("should hash API keys deterministically with SHA-256", async () => {
      const { hashApiKey } = await import("@/lib/api-key-auth");
      const hash1 = hashApiKey("pp_live_test_key_12345");
      const hash2 = hashApiKey("pp_live_test_key_12345");
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 hex
    });

    it("should generate API keys with pp_live_ prefix", async () => {
      const { generateApiKey } = await import("@/lib/api-key-auth");
      const { key, prefix, hash } = generateApiKey();
      expect(key).toMatch(/^pp_live_/);
      expect(prefix).toHaveLength(16);
      expect(hash).toHaveLength(64);
    });

    it("should enforce scope checks with admin:all bypass", async () => {
      const { enforceScope } = await import("@/lib/api-key-auth");

      const adminUser = {
        apiKeyId: "test-key",
        tenantId: "test-tenant",
        name: "Admin Key",
        scopes: ["admin:all" as const],
        createdBy: "test-user",
      };

      // admin:all should bypass all scope checks
      expect(() => enforceScope(adminUser, "cases:read")).not.toThrow();
      expect(() => enforceScope(adminUser, "webhooks:write")).not.toThrow();
    });

    it("should reject requests missing required scope", async () => {
      const { enforceScope } = await import("@/lib/api-key-auth");

      const readOnlyUser = {
        apiKeyId: "test-key",
        tenantId: "test-tenant",
        name: "Read Key",
        scopes: ["cases:read" as const],
        createdBy: "test-user",
      };

      expect(() => enforceScope(readOnlyUser, "cases:read")).not.toThrow();
      expect(() => enforceScope(readOnlyUser, "cases:write")).toThrow(/missing required scope/);
    });

    it("should rate limit per API key", async () => {
      const { checkRateLimit } = await import("@/lib/api-key-auth");

      // First call should succeed
      const result = checkRateLimit("test-rate-limit-key");
      expect(result.remaining).toBeGreaterThan(0);
    });
  });

  // ─── Webhook HMAC Signature Tests ───────────────────────────────────────────

  describe("Webhook HMAC Signature", () => {
    it("should generate consistent HMAC-SHA256 signatures", async () => {
      const { signPayload } = await import("@/lib/webhook-service");

      const secret = "test-webhook-secret-123";
      const payload = JSON.stringify({ event: "case.created", id: "123" });

      const sig1 = signPayload(secret, payload);
      const sig2 = signPayload(secret, payload);

      expect(sig1).toBe(sig2);
      expect(sig1).toHaveLength(64); // HMAC-SHA256 hex
    });

    it("should produce different signatures for different secrets", async () => {
      const { signPayload } = await import("@/lib/webhook-service");

      const payload = JSON.stringify({ event: "case.created" });
      const sig1 = signPayload("secret-a", payload);
      const sig2 = signPayload("secret-b", payload);

      expect(sig1).not.toBe(sig2);
    });

    it("should produce different signatures for different payloads", async () => {
      const { signPayload } = await import("@/lib/webhook-service");

      const secret = "same-secret";
      const sig1 = signPayload(secret, '{"event":"a"}');
      const sig2 = signPayload(secret, '{"event":"b"}');

      expect(sig1).not.toBe(sig2);
    });
  });

  // ─── Webhook Retry Scheduling Tests ─────────────────────────────────────────

  describe("Webhook Retry Scheduling", () => {
    it("should return next retry time for valid attempt numbers", async () => {
      const { getNextRetryTime } = await import("@/lib/webhook-service");

      const retry0 = getNextRetryTime(0);
      expect(retry0).toBeInstanceOf(Date);
      expect(retry0!.getTime()).toBeGreaterThan(Date.now());

      const retry1 = getNextRetryTime(1);
      expect(retry1).toBeInstanceOf(Date);
      expect(retry1!.getTime()).toBeGreaterThan(retry0!.getTime());
    });

    it("should return null when max retries exceeded", async () => {
      const { getNextRetryTime } = await import("@/lib/webhook-service");

      const retry = getNextRetryTime(10); // exceeds RETRY_SCHEDULE_MINUTES length
      expect(retry).toBeNull();
    });
  });

  // ─── Secrets Encryption/Decryption Tests ────────────────────────────────────

  describe("Secrets Encryption", () => {
    it("should encrypt and decrypt secrets round-trip", async () => {
      const { encryptSecret, decryptSecret } = await import("@/lib/secrets");

      const plaintext = "my-super-secret-value-123";
      const encrypted = encryptSecret(plaintext);

      expect(encrypted).not.toBe(plaintext);
      expect(encrypted.length).toBeGreaterThan(0);

      const decrypted = decryptSecret(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it("should produce different ciphertexts for same plaintext (random IV)", async () => {
      const { encryptSecret } = await import("@/lib/secrets");

      const plaintext = "test-secret";
      const enc1 = encryptSecret(plaintext);
      const enc2 = encryptSecret(plaintext);

      expect(enc1).not.toBe(enc2); // Random IV each time
    });

    it("should handle empty string", async () => {
      const { encryptSecret, decryptSecret } = await import("@/lib/secrets");

      const encrypted = encryptSecret("");
      const decrypted = decryptSecret(encrypted);
      expect(decrypted).toBe("");
    });

    it("should handle unicode content", async () => {
      const { encryptSecret, decryptSecret } = await import("@/lib/secrets");

      const plaintext = "Geheimnis mit Umlauten: äöüß 🔒";
      const encrypted = encryptSecret(plaintext);
      const decrypted = decryptSecret(encrypted);
      expect(decrypted).toBe(plaintext);
    });
  });

  // ─── Connector Framework Tests ──────────────────────────────────────────────

  describe("Connector Framework", () => {
    it("should have M365 and GOOGLE connector implementations", async () => {
      const { getConnectorImplementation, listConnectorTypes } = await import("@/lib/connector-framework");

      const types = listConnectorTypes();
      expect(types).toContain("M365");
      expect(types).toContain("GOOGLE");

      const m365 = getConnectorImplementation("M365");
      expect(m365).toBeDefined();
      expect(m365!.type).toBe("M365");

      const google = getConnectorImplementation("GOOGLE");
      expect(google).toBeDefined();
      expect(google!.type).toBe("GOOGLE");
    });

    it("M365 connector should support mock identity lookup", async () => {
      const { M365Connector } = await import("@/lib/connector-framework");
      const connector = new M365Connector();

      const result = await connector.identityLookup("john.doe@example.com", { mock_mode: true });

      expect(result.found).toBe(true);
      expect(result.displayName).toBe("John Doe");
      expect(result.email).toBe("john.doe@example.com");
      expect(result.systems).toBeDefined();
      expect(result.systems!.length).toBeGreaterThan(0);
      expect(result.metadata?.mock).toBe(true);
    });

    it("M365 connector should support mock data export", async () => {
      const { M365Connector } = await import("@/lib/connector-framework");
      const connector = new M365Connector();

      const result = await connector.exportData("case-123", ["user@example.com"], { mock_mode: true });

      expect(result.success).toBe(true);
      expect(result.filename).toMatch(/m365-export/);
      expect(result.contentType).toBe("application/json");
      expect(result.data).toBeInstanceOf(Buffer);
      expect(result.itemCount).toBeGreaterThan(0);
      expect(result.summary).toContain("Mock export");
    });

    it("Google connector should support mock identity lookup", async () => {
      const { GoogleWorkspaceConnector } = await import("@/lib/connector-framework");
      const connector = new GoogleWorkspaceConnector();

      const result = await connector.identityLookup("jane.smith@example.com", { mock_mode: true });

      expect(result.found).toBe(true);
      expect(result.displayName).toBe("Jane Smith");
      expect(result.systems).toContain("Gmail");
      expect(result.systems).toContain("Google Drive");
    });

    it("Google connector should support mock data export", async () => {
      const { GoogleWorkspaceConnector } = await import("@/lib/connector-framework");
      const connector = new GoogleWorkspaceConnector();

      const result = await connector.exportData("case-456", ["user@example.com"], { mock_mode: true });

      expect(result.success).toBe(true);
      expect(result.filename).toMatch(/google-export/);
      expect(result.data).toBeInstanceOf(Buffer);
      expect(result.itemCount).toBeGreaterThan(0);

      // Verify the export data structure
      const parsed = JSON.parse(result.data.toString());
      expect(parsed.source).toContain("Google Workspace");
      expect(parsed.summary.gmail).toBeDefined();
      expect(parsed.summary.googleDrive).toBeDefined();
    });

    it("M365 connector should test connection in mock mode", async () => {
      const { M365Connector } = await import("@/lib/connector-framework");
      const connector = new M365Connector();

      const result = await connector.testConnection({ mock_mode: true });

      expect(result.ok).toBe(true);
      expect(result.message).toContain("Mock mode");
    });

    it("Google connector should test connection in mock mode", async () => {
      const { GoogleWorkspaceConnector } = await import("@/lib/connector-framework");
      const connector = new GoogleWorkspaceConnector();

      const result = await connector.testConnection({ mock_mode: true });

      expect(result.ok).toBe(true);
      expect(result.message).toContain("Mock mode");
    });
  });

  // ─── RBAC Permission Tests ──────────────────────────────────────────────────

  describe("RBAC Permissions for Module 8.6", () => {
    it("TENANT_ADMIN should have all Module 8.6 permissions", async () => {
      const { has } = await import("@/lib/rbac");

      expect(has("TENANT_ADMIN", "API_KEYS_MANAGE")).toBe(true);
      expect(has("TENANT_ADMIN", "WEBHOOKS_MANAGE")).toBe(true);
      expect(has("TENANT_ADMIN", "CONNECTORS_VIEW")).toBe(true);
      expect(has("TENANT_ADMIN", "CONNECTORS_MANAGE")).toBe(true);
      expect(has("TENANT_ADMIN", "CONNECTORS_RUN")).toBe(true);
    });

    it("DPO should have connector view/manage/run but not API keys or webhooks", async () => {
      const { has } = await import("@/lib/rbac");

      expect(has("DPO", "CONNECTORS_VIEW")).toBe(true);
      expect(has("DPO", "CONNECTORS_MANAGE")).toBe(true);
      expect(has("DPO", "CONNECTORS_RUN")).toBe(true);
      expect(has("DPO", "API_KEYS_MANAGE")).toBe(false);
      expect(has("DPO", "WEBHOOKS_MANAGE")).toBe(false);
    });

    it("CASE_MANAGER should have connector view only", async () => {
      const { has } = await import("@/lib/rbac");

      expect(has("CASE_MANAGER", "CONNECTORS_VIEW")).toBe(true);
      expect(has("CASE_MANAGER", "CONNECTORS_MANAGE")).toBe(false);
      expect(has("CASE_MANAGER", "API_KEYS_MANAGE")).toBe(false);
    });

    it("READ_ONLY should not have any Module 8.6 permissions", async () => {
      const { has } = await import("@/lib/rbac");

      expect(has("READ_ONLY", "API_KEYS_MANAGE")).toBe(false);
      expect(has("READ_ONLY", "WEBHOOKS_MANAGE")).toBe(false);
      expect(has("READ_ONLY", "CONNECTORS_VIEW")).toBe(false);
      expect(has("READ_ONLY", "CONNECTORS_MANAGE")).toBe(false);
      expect(has("READ_ONLY", "CONNECTORS_RUN")).toBe(false);
    });

    it("legacy checkPermission should work for new resources", async () => {
      const { hasPermission } = await import("@/lib/rbac");

      expect(hasPermission("TENANT_ADMIN", "api_keys", "manage")).toBe(true);
      expect(hasPermission("TENANT_ADMIN", "webhooks", "create")).toBe(true);
      expect(hasPermission("TENANT_ADMIN", "connectors", "manage")).toBe(true);
      expect(hasPermission("READ_ONLY", "api_keys", "manage")).toBe(false);
    });
  });

  // ─── Validation Schema Tests ────────────────────────────────────────────────

  describe("Validation Schemas", () => {
    it("should validate createApiKeySchema", async () => {
      const { createApiKeySchema } = await import("@/lib/validation");

      const valid = createApiKeySchema.parse({
        name: "My API Key",
        scopes: ["cases:read", "systems:read"],
      });
      expect(valid.name).toBe("My API Key");
      expect(valid.scopes).toHaveLength(2);

      expect(() => createApiKeySchema.parse({ name: "", scopes: [] })).toThrow();
    });

    it("should validate createWebhookEndpointSchema", async () => {
      const { createWebhookEndpointSchema } = await import("@/lib/validation");

      const valid = createWebhookEndpointSchema.parse({
        url: "https://hooks.example.com/test",
        subscribedEvents: ["case.created"],
      });
      expect(valid.url).toBe("https://hooks.example.com/test");

      expect(() => createWebhookEndpointSchema.parse({
        url: "not-a-url",
        subscribedEvents: [],
      })).toThrow();
    });

    it("should validate createConnectorSchema", async () => {
      const { createConnectorSchema } = await import("@/lib/validation");

      const valid = createConnectorSchema.parse({
        type: "M365",
        name: "My M365 Connector",
        config: { mock_mode: true },
      });
      expect(valid.type).toBe("M365");
      expect(valid.name).toBe("My M365 Connector");
    });

    it("should validate createConnectorRunSchema", async () => {
      const { createConnectorRunSchema } = await import("@/lib/validation");

      const valid = createConnectorRunSchema.parse({
        runType: "IDENTITY_LOOKUP",
      });
      expect(valid.runType).toBe("IDENTITY_LOOKUP");

      expect(() => createConnectorRunSchema.parse({
        runType: "INVALID_TYPE",
      })).toThrow();
    });

    it("should validate v1PaginationSchema with defaults", async () => {
      const { v1PaginationSchema } = await import("@/lib/validation");

      const defaults = v1PaginationSchema.parse({});
      expect(defaults.page).toBe(1);
      expect(defaults.pageSize).toBe(20);

      const custom = v1PaginationSchema.parse({ page: "3", pageSize: "50" });
      expect(custom.page).toBe(3);
      expect(custom.pageSize).toBe(50);
    });
  });
});
