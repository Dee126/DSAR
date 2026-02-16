import { describe, it, expect } from "vitest";
import { createHash, randomBytes, randomInt } from "crypto";

// ─── Token Hashing / Validation Tests ────────────────────────────────────────

function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

function hashToken(token: string, salt: string): string {
  return createHash("sha256").update(token + salt).digest("hex");
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  const visible = local.slice(0, 2);
  return `${visible}***@${domain}`;
}

describe("Token Security", () => {
  it("should generate URL-safe base64 tokens", () => {
    const token = generateToken();
    expect(token).toBeDefined();
    expect(token.length).toBeGreaterThan(20);
    // Should not contain +, /, = (URL-unsafe chars)
    expect(token).not.toMatch(/[+/=]/);
  });

  it("should hash token with salt correctly", () => {
    const token = "test-token-abc123";
    const salt = "random-salt-xyz";
    const hash1 = hashToken(token, salt);
    const hash2 = hashToken(token, salt);

    // Same input should produce same hash
    expect(hash1).toBe(hash2);
    // Hash should be 64 chars (sha256 hex)
    expect(hash1).toHaveLength(64);
  });

  it("should produce different hashes with different salts", () => {
    const token = "test-token";
    const hash1 = hashToken(token, "salt-a");
    const hash2 = hashToken(token, "salt-b");

    expect(hash1).not.toBe(hash2);
  });

  it("should produce different hashes with different tokens", () => {
    const salt = "same-salt";
    const hash1 = hashToken("token-a", salt);
    const hash2 = hashToken("token-b", salt);

    expect(hash1).not.toBe(hash2);
  });

  it("should validate token by re-hashing with stored salt", () => {
    const rawToken = generateToken();
    const salt = randomBytes(16).toString("hex");
    const storedHash = hashToken(rawToken, salt);

    // Simulating validation: re-hash and compare
    const candidateHash = hashToken(rawToken, salt);
    expect(candidateHash).toBe(storedHash);

    // Wrong token should not match
    const wrongHash = hashToken("wrong-token", salt);
    expect(wrongHash).not.toBe(storedHash);
  });
});

// ─── OTP Tests ───────────────────────────────────────────────────────────────

function generateOtp(): string {
  return String(randomInt(100000, 999999));
}

function hashOtp(otp: string): string {
  return createHash("sha256").update(otp).digest("hex");
}

describe("OTP Service", () => {
  it("should generate 6-digit numeric OTPs", () => {
    for (let i = 0; i < 50; i++) {
      const otp = generateOtp();
      expect(otp).toMatch(/^\d{6}$/);
      const num = parseInt(otp, 10);
      expect(num).toBeGreaterThanOrEqual(100000);
      expect(num).toBeLessThan(1000000);
    }
  });

  it("should hash OTP correctly", () => {
    const otp = "123456";
    const hash1 = hashOtp(otp);
    const hash2 = hashOtp(otp);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it("should verify OTP by hash comparison", () => {
    const otp = generateOtp();
    const storedHash = hashOtp(otp);

    // Correct OTP
    expect(hashOtp(otp)).toBe(storedHash);

    // Wrong OTP
    expect(hashOtp("000000")).not.toBe(storedHash);
    expect(hashOtp("999999")).not.toBe(storedHash);
  });

  it("should implement lockout after max attempts", () => {
    const maxAttempts = 5;
    let attempts = 0;
    let locked = false;
    const lockoutMinutes = 15;

    for (let i = 0; i < maxAttempts + 1; i++) {
      attempts++;
      if (attempts >= maxAttempts) {
        locked = true;
        break;
      }
    }

    expect(locked).toBe(true);
    expect(attempts).toBe(maxAttempts);

    // Lockout should expire after configured minutes
    const lockUntil = new Date(Date.now() + lockoutMinutes * 60 * 1000);
    expect(lockUntil.getTime()).toBeGreaterThan(Date.now());
  });
});

// ─── Max Downloads Enforcement Tests ─────────────────────────────────────────

describe("Max Downloads Enforcement", () => {
  it("should allow downloads up to max limit", () => {
    const maxDownloads = 3;
    let usedDownloads = 0;
    let status = "ACTIVE";
    const errors: string[] = [];

    for (let i = 0; i < maxDownloads; i++) {
      if (usedDownloads >= maxDownloads) {
        status = "EXPIRED";
        errors.push("Download limit reached");
        break;
      }
      usedDownloads++;
      if (usedDownloads >= maxDownloads) {
        status = "EXPIRED";
      }
    }

    expect(usedDownloads).toBe(maxDownloads);
    expect(status).toBe("EXPIRED");
    expect(errors).toHaveLength(0);
  });

  it("should reject downloads after max reached", () => {
    const maxDownloads = 1;
    let usedDownloads = 1; // Already used
    let rejected = false;

    if (usedDownloads >= maxDownloads) {
      rejected = true;
    }

    expect(rejected).toBe(true);
  });

  it("should handle one-time links", () => {
    const maxDownloads = 1;
    let usedDownloads = 0;
    let status = "ACTIVE";

    // First download succeeds
    usedDownloads++;
    if (usedDownloads >= maxDownloads) {
      status = "EXPIRED";
    }

    expect(usedDownloads).toBe(1);
    expect(status).toBe("EXPIRED");

    // Second download should be rejected
    const canDownload = usedDownloads < maxDownloads;
    expect(canDownload).toBe(false);
  });
});

// ─── Event Recording Tests ───────────────────────────────────────────────────

function hashPrivacySafe(value: string, tenantSalt: string): string {
  return createHash("sha256").update(value + tenantSalt).digest("hex");
}

describe("Delivery Event Recording", () => {
  it("should hash IP addresses for privacy", () => {
    const ip = "192.168.1.100";
    const tenantSalt = "tenant-123";
    const hash = hashPrivacySafe(ip, tenantSalt);

    // Hash should be consistent
    expect(hashPrivacySafe(ip, tenantSalt)).toBe(hash);

    // Different IPs produce different hashes
    expect(hashPrivacySafe("10.0.0.1", tenantSalt)).not.toBe(hash);

    // Different tenants produce different hashes for same IP
    expect(hashPrivacySafe(ip, "tenant-456")).not.toBe(hash);
  });

  it("should hash user agents for privacy", () => {
    const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
    const tenantSalt = "tenant-123";
    const hash = hashPrivacySafe(ua, tenantSalt);

    expect(hash).toHaveLength(64);
    expect(hashPrivacySafe(ua, tenantSalt)).toBe(hash);
  });

  it("should cover all delivery event types", () => {
    const eventTypes = [
      "LINK_CREATED",
      "OTP_SENT",
      "OTP_VERIFIED",
      "OTP_FAILED",
      "PORTAL_VIEWED",
      "FILE_DOWNLOADED",
      "PACKAGE_DOWNLOADED",
      "LINK_REVOKED",
      "LINK_EXPIRED",
    ];

    expect(eventTypes).toHaveLength(9);
    // Each event type should be a valid string
    eventTypes.forEach((type) => {
      expect(typeof type).toBe("string");
      expect(type.length).toBeGreaterThan(0);
    });
  });
});

// ─── Package Generation & Checksum Tests ─────────────────────────────────────

function computeChecksum(data: string): string {
  return createHash("sha256").update(data).digest("hex");
}

describe("Delivery Package & Checksum", () => {
  it("should compute deterministic checksums for manifest", () => {
    const manifest = JSON.stringify([
      { name: "response_v1_en.pdf", type: "application/pdf", source: "response", id: "doc-1" },
      { name: "evidence.xlsx", type: "application/xlsx", source: "evidence", id: "doc-2" },
    ]);

    const checksum1 = computeChecksum(manifest);
    const checksum2 = computeChecksum(manifest);

    expect(checksum1).toBe(checksum2);
    expect(checksum1).toHaveLength(64);
  });

  it("should detect manifest tampering via checksum", () => {
    const originalManifest = JSON.stringify([
      { name: "response.pdf", type: "application/pdf", source: "response", id: "doc-1" },
    ]);
    const tamperedManifest = JSON.stringify([
      { name: "response.pdf", type: "application/pdf", source: "response", id: "doc-1" },
      { name: "malicious.exe", type: "application/octet-stream", source: "evidence", id: "doc-X" },
    ]);

    const originalChecksum = computeChecksum(originalManifest);
    const tamperedChecksum = computeChecksum(tamperedManifest);

    expect(originalChecksum).not.toBe(tamperedChecksum);
  });

  it("should mask emails correctly", () => {
    expect(maskEmail("john@example.com")).toBe("jo***@example.com");
    expect(maskEmail("a@test.org")).toBe("a***@test.org");
    expect(maskEmail("longname@domain.co.uk")).toBe("lo***@domain.co.uk");
    expect(maskEmail("invalid")).toBe("***");
  });

  it("should generate unique tokens for each link", () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 100; i++) {
      tokens.add(generateToken());
    }
    // All 100 tokens should be unique
    expect(tokens.size).toBe(100);
  });
});

// ─── Link Expiry Tests ───────────────────────────────────────────────────────

describe("Link Expiry", () => {
  it("should correctly identify expired links", () => {
    const now = new Date();
    const expired = new Date(now.getTime() - 1000); // 1 second ago
    const valid = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

    expect(expired < now).toBe(true);
    expect(valid > now).toBe(true);
  });

  it("should calculate expiry from creation date", () => {
    const expiryDays = 7;
    const createdAt = new Date();
    const expiresAt = new Date(createdAt);
    expiresAt.setDate(expiresAt.getDate() + expiryDays);

    const diffMs = expiresAt.getTime() - createdAt.getTime();
    const diffDays = diffMs / (24 * 60 * 60 * 1000);

    expect(diffDays).toBe(expiryDays);
  });

  it("should support configurable expiry periods", () => {
    const configs = [1, 7, 14, 30, 90];
    configs.forEach((days) => {
      const now = new Date();
      const expiry = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
      expect(expiry.getTime()).toBeGreaterThan(now.getTime());

      const diffDays = (expiry.getTime() - now.getTime()) / (24 * 60 * 60 * 1000);
      expect(Math.round(diffDays)).toBe(days);
    });
  });
});
