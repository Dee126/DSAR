import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  encrypt,
  decrypt,
  validateEncryptionKey,
  _resetKeyCache,
} from "@/lib/security/encryption";
import {
  encryptIntegrationSecret,
  decryptIntegrationSecret,
} from "@/lib/integration-crypto";
import { randomBytes } from "crypto";

// Generate a valid 32-byte key for testing
const TEST_KEY = randomBytes(32).toString("base64");

describe("security/encryption (AES-256-GCM)", () => {
  beforeEach(() => {
    _resetKeyCache();
    process.env.INTEGRATION_ENCRYPTION_KEY = TEST_KEY;
  });

  afterEach(() => {
    _resetKeyCache();
    delete process.env.INTEGRATION_ENCRYPTION_KEY;
  });

  describe("encrypt / decrypt", () => {
    it("should round-trip a simple string", () => {
      const plaintext = "hello world";
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it("should round-trip a JSON payload (AWS config)", () => {
      const payload = JSON.stringify({
        authType: "access_keys",
        accessKeyId: "AKIAIOSFODNN7EXAMPLE",
        secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        region: "eu-central-1",
      });
      const encrypted = encrypt(payload);
      const decrypted = decrypt(encrypted);
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
      const encrypted = encrypt(payload);
      const decrypted = decrypt(encrypted);
      expect(JSON.parse(decrypted)).toEqual(JSON.parse(payload));
    });

    it("should produce different ciphertext for the same plaintext (random IV)", () => {
      const plaintext = "same input twice";
      const a = encrypt(plaintext);
      const b = encrypt(plaintext);
      expect(a).not.toBe(b);
      expect(decrypt(a)).toBe(plaintext);
      expect(decrypt(b)).toBe(plaintext);
    });

    it("should produce a base64 output", () => {
      const encrypted = encrypt("test");
      expect(encrypted).toMatch(/^[A-Za-z0-9+/]+=*$/);
    });

    it("should handle empty string", () => {
      const encrypted = encrypt("");
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe("");
    });

    it("should handle unicode characters", () => {
      const plaintext = "Ünîcödé tëst with Ñ and 日本語";
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it("should fail to decrypt with a tampered blob", () => {
      const encrypted = encrypt("secret");
      const buf = Buffer.from(encrypted, "base64");
      buf[Math.floor(buf.length / 2)] ^= 0xff;
      const tampered = buf.toString("base64");
      expect(() => decrypt(tampered)).toThrow();
    });

    it("should fail to decrypt with a truncated blob", () => {
      const encrypted = encrypt("secret");
      const truncated = encrypted.slice(0, 10);
      expect(() => decrypt(truncated)).toThrow("Invalid encrypted payload: too short");
    });

    it("should fail to decrypt with a different key", () => {
      const encrypted = encrypt("secret");
      _resetKeyCache();
      process.env.INTEGRATION_ENCRYPTION_KEY = randomBytes(32).toString("base64");
      expect(() => decrypt(encrypted)).toThrow();
    });
  });

  describe("payload format: base64(iv[12] + authTag[16] + ciphertext)", () => {
    it("should encode iv (12 bytes) then authTag (16 bytes) then ciphertext", () => {
      const encrypted = encrypt("test-payload");
      const buf = Buffer.from(encrypted, "base64");
      // Minimum length: 12 (IV) + 16 (tag) + at least 1 byte ciphertext
      expect(buf.length).toBeGreaterThanOrEqual(12 + 16 + 1);
    });
  });

  describe("validateEncryptionKey", () => {
    it("should return a 32-byte buffer for a valid key", () => {
      const key = validateEncryptionKey();
      expect(key.length).toBe(32);
    });

    it("should throw if INTEGRATION_ENCRYPTION_KEY is not set", () => {
      _resetKeyCache();
      delete process.env.INTEGRATION_ENCRYPTION_KEY;
      expect(() => validateEncryptionKey()).toThrow(
        "Invalid INTEGRATION_ENCRYPTION_KEY: must be 32 bytes base64"
      );
    });

    it("should throw if key is wrong length", () => {
      _resetKeyCache();
      process.env.INTEGRATION_ENCRYPTION_KEY = randomBytes(16).toString("base64");
      expect(() => validateEncryptionKey()).toThrow(
        "Invalid INTEGRATION_ENCRYPTION_KEY: must be 32 bytes base64"
      );
    });

    it("should cache the key after first validation", () => {
      const key1 = validateEncryptionKey();
      const key2 = validateEncryptionKey();
      expect(key1).toBe(key2); // same Buffer reference
    });
  });

  describe("backward-compat: integration-crypto re-exports", () => {
    it("encryptIntegrationSecret / decryptIntegrationSecret should round-trip", () => {
      const plaintext = "backward-compat-test";
      const encrypted = encryptIntegrationSecret(plaintext);
      const decrypted = decryptIntegrationSecret(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it("encrypt output should be decryptable by decryptIntegrationSecret", () => {
      const plaintext = "cross-module-test";
      const encrypted = encrypt(plaintext);
      const decrypted = decryptIntegrationSecret(encrypted);
      expect(decrypted).toBe(plaintext);
    });
  });
});
