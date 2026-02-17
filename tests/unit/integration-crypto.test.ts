import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  encryptIntegrationSecret,
  decryptIntegrationSecret,
} from "@/lib/integration-crypto";
import { randomBytes } from "crypto";

// Generate a valid 32-byte key for testing
const TEST_KEY = randomBytes(32).toString("base64");

describe("integration-crypto", () => {
  beforeEach(() => {
    process.env.INTEGRATION_ENCRYPTION_KEY = TEST_KEY;
  });

  afterEach(() => {
    delete process.env.INTEGRATION_ENCRYPTION_KEY;
  });

  describe("encryptIntegrationSecret / decryptIntegrationSecret", () => {
    it("should round-trip a simple string", () => {
      const plaintext = "hello world";
      const encrypted = encryptIntegrationSecret(plaintext);
      const decrypted = decryptIntegrationSecret(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it("should round-trip a JSON payload (AWS config)", () => {
      const payload = JSON.stringify({
        authType: "access_keys",
        accessKeyId: "AKIAIOSFODNN7EXAMPLE",
        secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        region: "eu-central-1",
      });
      const encrypted = encryptIntegrationSecret(payload);
      const decrypted = decryptIntegrationSecret(encrypted);
      expect(JSON.parse(decrypted)).toEqual(JSON.parse(payload));
    });

    it("should round-trip an assume_role config", () => {
      const payload = JSON.stringify({
        authType: "assume_role",
        accessKeyId: "AKIAIOSFODNN7EXAMPLE",
        secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        region: "eu-central-1",
        roleArn: "arn:aws:iam::123456789012:role/DSARCollector",
        externalId: "dsar-external-id-123",
      });
      const encrypted = encryptIntegrationSecret(payload);
      const decrypted = decryptIntegrationSecret(encrypted);
      expect(JSON.parse(decrypted)).toEqual(JSON.parse(payload));
    });

    it("should produce different ciphertext for the same plaintext (random IV)", () => {
      const plaintext = "same input twice";
      const a = encryptIntegrationSecret(plaintext);
      const b = encryptIntegrationSecret(plaintext);
      expect(a).not.toBe(b);
      // But both decrypt to the same value
      expect(decryptIntegrationSecret(a)).toBe(plaintext);
      expect(decryptIntegrationSecret(b)).toBe(plaintext);
    });

    it("should produce a base64 output", () => {
      const encrypted = encryptIntegrationSecret("test");
      // base64 regex
      expect(encrypted).toMatch(/^[A-Za-z0-9+/]+=*$/);
    });

    it("should handle empty string", () => {
      const encrypted = encryptIntegrationSecret("");
      const decrypted = decryptIntegrationSecret(encrypted);
      expect(decrypted).toBe("");
    });

    it("should handle unicode characters", () => {
      const plaintext = "Ünîcödé tëst with Ñ and 日本語";
      const encrypted = encryptIntegrationSecret(plaintext);
      const decrypted = decryptIntegrationSecret(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it("should fail to decrypt with a tampered blob", () => {
      const encrypted = encryptIntegrationSecret("secret");
      // Flip a byte in the middle
      const buf = Buffer.from(encrypted, "base64");
      buf[Math.floor(buf.length / 2)] ^= 0xff;
      const tampered = buf.toString("base64");

      expect(() => decryptIntegrationSecret(tampered)).toThrow();
    });

    it("should fail to decrypt with a truncated blob", () => {
      const encrypted = encryptIntegrationSecret("secret");
      const truncated = encrypted.slice(0, 10);
      expect(() => decryptIntegrationSecret(truncated)).toThrow(
        "Invalid encrypted blob: too short"
      );
    });

    it("should fail to decrypt with a different key", () => {
      const encrypted = encryptIntegrationSecret("secret");
      // Switch key
      process.env.INTEGRATION_ENCRYPTION_KEY = randomBytes(32).toString("base64");
      expect(() => decryptIntegrationSecret(encrypted)).toThrow();
    });
  });

  describe("key validation", () => {
    it("should throw if INTEGRATION_ENCRYPTION_KEY is not set", () => {
      delete process.env.INTEGRATION_ENCRYPTION_KEY;
      expect(() => encryptIntegrationSecret("test")).toThrow(
        "INTEGRATION_ENCRYPTION_KEY env var is not set"
      );
    });

    it("should throw if key is wrong length", () => {
      process.env.INTEGRATION_ENCRYPTION_KEY = randomBytes(16).toString("base64"); // 16 bytes instead of 32
      expect(() => encryptIntegrationSecret("test")).toThrow(
        "must decode to exactly 32 bytes"
      );
    });
  });
});
