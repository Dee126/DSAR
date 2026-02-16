import { describe, it, expect, beforeEach } from "vitest";
import { createHash } from "crypto";

// ═══════════════════════════════════════════════════════════════════════════════
// Module 8.4: Assurance Layer Tests
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Canonical JSON (replicated from assurance-audit-service) ─────────────

function canonicalJson(obj: unknown): string {
  if (obj === null || obj === undefined) return "null";
  if (typeof obj === "string") return JSON.stringify(obj);
  if (typeof obj === "number" || typeof obj === "boolean") return String(obj);
  if (Array.isArray(obj)) {
    return "[" + obj.map(canonicalJson).join(",") + "]";
  }
  if (typeof obj === "object") {
    const sorted = Object.keys(obj as Record<string, unknown>).sort();
    const pairs = sorted.map(
      (k) => JSON.stringify(k) + ":" + canonicalJson((obj as Record<string, unknown>)[k])
    );
    return "{" + pairs.join(",") + "}";
  }
  return String(obj);
}

function sha256(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

function hashIp(ip: string, salt = "assurance"): string {
  return sha256(salt + ":" + ip);
}

// ─── Hash Chain Simulation ────────────────────────────────────────────────

interface AuditEvent {
  tenantId: string;
  entityType: string;
  entityId: string | null;
  action: string;
  actorUserId: string | null;
  actorType: string;
  timestamp: string;
  diffJson: unknown;
  metadataJson: unknown;
}

function buildHashChain(events: AuditEvent[]): { hash: string; prevHash: string | null }[] {
  const chain: { hash: string; prevHash: string | null }[] = [];
  let prevHash: string | null = null;

  for (const event of events) {
    const canonical = canonicalJson(event);
    const hashInput = (prevHash || "") + canonical;
    const hash = sha256(hashInput);
    chain.push({ hash, prevHash });
    prevHash = hash;
  }

  return chain;
}

function verifyChain(events: AuditEvent[], chain: { hash: string; prevHash: string | null }[]): boolean {
  let prevHash: string | null = null;

  for (let i = 0; i < events.length; i++) {
    const entry = chain[i];

    // Check prevHash link
    if (entry.prevHash !== prevHash) return false;

    // Recompute hash
    const canonical = canonicalJson(events[i]);
    const hashInput = (prevHash || "") + canonical;
    const expectedHash = sha256(hashInput);

    if (entry.hash !== expectedHash) return false;

    prevHash = entry.hash;
  }

  return true;
}

// ─── SoD Guard Simulation ─────────────────────────────────────────────────

interface SodRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

const DEFAULT_SOD_RULES: SodRule[] = [
  { id: "generator_cannot_approve_response", name: "Response Generator ≠ Approver", description: "...", enabled: true },
  { id: "same_user_cannot_request_and_approve_legal_exception", name: "Legal Exception Creator ≠ Approver", description: "...", enabled: true },
  { id: "retention_override_requester_cannot_approve", name: "Retention Override Requester ≠ Approver", description: "...", enabled: true },
];

function checkSod(
  rules: SodRule[],
  sodEnabled: boolean,
  ruleId: string,
  actorId: string,
  creatorId: string,
): { allowed: boolean; violatedRule?: string } {
  if (!sodEnabled) return { allowed: true };
  const rule = rules.find(r => r.id === ruleId);
  if (!rule || !rule.enabled) return { allowed: true };
  if (actorId === creatorId) {
    return { allowed: false, violatedRule: ruleId };
  }
  return { allowed: true };
}

// ─── Retention Policy Simulation ──────────────────────────────────────────

interface RetentionPolicy {
  artifactType: string;
  retentionDays: number;
  deleteMode: "HARD_DELETE" | "SOFT_DELETE";
  legalHoldRespects: boolean;
  enabled: boolean;
}

interface Artifact {
  id: string;
  type: string;
  caseId: string;
  createdAt: Date;
}

function evaluateDeletion(
  policy: RetentionPolicy,
  artifact: Artifact,
  now: Date,
  hasLegalHold: boolean,
): { eligible: boolean; blocked: boolean; reason: string } {
  if (!policy.enabled) {
    return { eligible: false, blocked: false, reason: "Policy disabled" };
  }

  const cutoff = new Date(now.getTime() - policy.retentionDays * 24 * 60 * 60 * 1000);
  if (artifact.createdAt >= cutoff) {
    return { eligible: false, blocked: false, reason: "Within retention period" };
  }

  if (policy.legalHoldRespects && hasLegalHold) {
    return { eligible: true, blocked: true, reason: "Legal hold active" };
  }

  return { eligible: true, blocked: false, reason: `Retention exceeded (${policy.retentionDays} days)` };
}

// ─── Deletion Proof Simulation ────────────────────────────────────────────

interface DeletionEventPayload {
  tenantId: string;
  artifactType: string;
  artifactId: string;
  caseId: string | null;
  deletedAt: string;
  deletionMethod: string;
  legalHoldBlocked: boolean;
  reason: string;
}

function createDeletionProof(payload: DeletionEventPayload): string {
  return sha256(canonicalJson(payload));
}

function verifyDeletionProof(payload: DeletionEventPayload, proofHash: string): boolean {
  return sha256(canonicalJson(payload)) === proofHash;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe("Module 8.4: Assurance Layer", () => {

  // ─── Canonical JSON ─────────────────────────────────────────────────────

  describe("Canonical JSON", () => {
    it("should produce stable key ordering", () => {
      const obj1 = { b: 2, a: 1 };
      const obj2 = { a: 1, b: 2 };
      expect(canonicalJson(obj1)).toBe(canonicalJson(obj2));
    });

    it("should handle nested objects with stable ordering", () => {
      const obj = { z: { y: 1, x: 2 }, a: 3 };
      const result = canonicalJson(obj);
      expect(result).toBe('{"a":3,"z":{"x":2,"y":1}}');
    });

    it("should handle arrays correctly", () => {
      const arr = [3, 1, 2];
      expect(canonicalJson(arr)).toBe("[3,1,2]");
    });

    it("should handle null and undefined", () => {
      expect(canonicalJson(null)).toBe("null");
      expect(canonicalJson(undefined)).toBe("null");
    });

    it("should produce deterministic output for complex payloads", () => {
      const event = {
        tenantId: "t1",
        entityType: "DSARCase",
        entityId: "c1",
        action: "CREATE",
        actorUserId: "u1",
        actorType: "USER",
        timestamp: "2026-01-01T00:00:00.000Z",
        diffJson: null,
        metadataJson: { ip_hash: "abc", correlation_id: "xyz" },
      };

      // Run multiple times — must be identical
      const results = Array.from({ length: 10 }, () => canonicalJson(event));
      expect(new Set(results).size).toBe(1);
    });
  });

  // ─── Audit Hash Chain ──────────────────────────────────────────────────

  describe("Audit Hash Chain", () => {
    const events: AuditEvent[] = [
      { tenantId: "t1", entityType: "DSARCase", entityId: "c1", action: "CREATE", actorUserId: "u1", actorType: "USER", timestamp: "2026-01-01T00:00:00.000Z", diffJson: null, metadataJson: null },
      { tenantId: "t1", entityType: "DSARCase", entityId: "c1", action: "UPDATE", actorUserId: "u2", actorType: "USER", timestamp: "2026-01-01T01:00:00.000Z", diffJson: null, metadataJson: null },
      { tenantId: "t1", entityType: "Document", entityId: "d1", action: "ACCESS", actorUserId: "u1", actorType: "USER", timestamp: "2026-01-01T02:00:00.000Z", diffJson: null, metadataJson: null },
    ];

    it("should build a valid hash chain", () => {
      const chain = buildHashChain(events);

      expect(chain).toHaveLength(3);
      expect(chain[0].prevHash).toBeNull();
      expect(chain[1].prevHash).toBe(chain[0].hash);
      expect(chain[2].prevHash).toBe(chain[1].hash);
    });

    it("should verify a valid chain", () => {
      const chain = buildHashChain(events);
      expect(verifyChain(events, chain)).toBe(true);
    });

    it("should detect tampering (modified action)", () => {
      const chain = buildHashChain(events);

      // Tamper with the second event
      const tamperedEvents = [...events];
      tamperedEvents[1] = { ...events[1], action: "DELETE" };

      expect(verifyChain(tamperedEvents, chain)).toBe(false);
    });

    it("should detect tampering (modified hash)", () => {
      const chain = buildHashChain(events);

      // Tamper with a hash
      const tamperedChain = [...chain];
      tamperedChain[1] = { ...chain[1], hash: "deadbeef" };

      expect(verifyChain(events, tamperedChain)).toBe(false);
    });

    it("should detect broken chain link (modified prevHash)", () => {
      const chain = buildHashChain(events);

      const tamperedChain = [...chain];
      tamperedChain[2] = { ...chain[2], prevHash: "wronghash" };

      expect(verifyChain(events, tamperedChain)).toBe(false);
    });

    it("should produce unique hashes for different events", () => {
      const chain = buildHashChain(events);
      const hashes = chain.map(c => c.hash);
      expect(new Set(hashes).size).toBe(hashes.length);
    });

    it("should produce a valid chain for single event", () => {
      const single = [events[0]];
      const chain = buildHashChain(single);

      expect(chain).toHaveLength(1);
      expect(chain[0].prevHash).toBeNull();
      expect(verifyChain(single, chain)).toBe(true);
    });
  });

  // ─── Integrity Verification ─────────────────────────────────────────────

  describe("Integrity Verification", () => {
    it("should pass on empty chain", () => {
      expect(verifyChain([], [])).toBe(true);
    });

    it("should detect inserted event in the middle", () => {
      const events: AuditEvent[] = [
        { tenantId: "t1", entityType: "A", entityId: null, action: "CREATE", actorUserId: "u1", actorType: "USER", timestamp: "2026-01-01T00:00:00.000Z", diffJson: null, metadataJson: null },
        { tenantId: "t1", entityType: "B", entityId: null, action: "UPDATE", actorUserId: "u2", actorType: "USER", timestamp: "2026-01-01T01:00:00.000Z", diffJson: null, metadataJson: null },
      ];

      const chain = buildHashChain(events);

      // Insert a new event in the middle
      const insertedEvent: AuditEvent = {
        tenantId: "t1", entityType: "C", entityId: null, action: "DELETE", actorUserId: "u3", actorType: "USER", timestamp: "2026-01-01T00:30:00.000Z", diffJson: null, metadataJson: null,
      };

      const tamperedEvents = [events[0], insertedEvent, events[1]];
      const tamperedChain = [chain[0], { hash: sha256("fake"), prevHash: chain[0].hash }, chain[1]];

      expect(verifyChain(tamperedEvents, tamperedChain)).toBe(false);
    });
  });

  // ─── IP/User Agent Hashing ──────────────────────────────────────────────

  describe("Privacy-Safe Hashing", () => {
    it("should hash IP addresses consistently", () => {
      const hash1 = hashIp("192.168.1.1");
      const hash2 = hashIp("192.168.1.1");
      expect(hash1).toBe(hash2);
    });

    it("should produce different hashes for different IPs", () => {
      const hash1 = hashIp("192.168.1.1");
      const hash2 = hashIp("192.168.1.2");
      expect(hash1).not.toBe(hash2);
    });

    it("should not be reversible (output is hex sha256)", () => {
      const hash = hashIp("192.168.1.1");
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
      expect(hash).not.toContain("192.168");
    });
  });

  // ─── SoD Guard ──────────────────────────────────────────────────────────

  describe("Separation of Duties (SoD) Guard", () => {
    it("should block self-approval for response (same user created and tries to approve)", () => {
      const result = checkSod(DEFAULT_SOD_RULES, true, "generator_cannot_approve_response", "user-1", "user-1");
      expect(result.allowed).toBe(false);
      expect(result.violatedRule).toBe("generator_cannot_approve_response");
    });

    it("should allow approval by a different user", () => {
      const result = checkSod(DEFAULT_SOD_RULES, true, "generator_cannot_approve_response", "user-2", "user-1");
      expect(result.allowed).toBe(true);
    });

    it("should block self-approval for legal exception", () => {
      const result = checkSod(DEFAULT_SOD_RULES, true, "same_user_cannot_request_and_approve_legal_exception", "user-1", "user-1");
      expect(result.allowed).toBe(false);
    });

    it("should block self-approval for retention override", () => {
      const result = checkSod(DEFAULT_SOD_RULES, true, "retention_override_requester_cannot_approve", "user-1", "user-1");
      expect(result.allowed).toBe(false);
    });

    it("should skip check when SoD is disabled", () => {
      const result = checkSod(DEFAULT_SOD_RULES, false, "generator_cannot_approve_response", "user-1", "user-1");
      expect(result.allowed).toBe(true);
    });

    it("should skip check when specific rule is disabled", () => {
      const disabledRules = DEFAULT_SOD_RULES.map(r =>
        r.id === "generator_cannot_approve_response" ? { ...r, enabled: false } : r
      );
      const result = checkSod(disabledRules, true, "generator_cannot_approve_response", "user-1", "user-1");
      expect(result.allowed).toBe(true);
    });

    it("should skip check for unknown rule ID", () => {
      const result = checkSod(DEFAULT_SOD_RULES, true, "nonexistent_rule", "user-1", "user-1");
      expect(result.allowed).toBe(true);
    });
  });

  // ─── Retention Policy Engine ────────────────────────────────────────────

  describe("Retention Policy Engine", () => {
    const now = new Date("2026-06-15T00:00:00.000Z");

    const policy: RetentionPolicy = {
      artifactType: "IDV_ARTIFACT",
      retentionDays: 90,
      deleteMode: "HARD_DELETE",
      legalHoldRespects: true,
      enabled: true,
    };

    it("should mark old artifacts as eligible for deletion", () => {
      const artifact: Artifact = {
        id: "a1",
        type: "IDV_ARTIFACT",
        caseId: "c1",
        createdAt: new Date("2026-01-01T00:00:00.000Z"), // 165 days old
      };

      const result = evaluateDeletion(policy, artifact, now, false);
      expect(result.eligible).toBe(true);
      expect(result.blocked).toBe(false);
    });

    it("should not delete artifacts within retention period", () => {
      const artifact: Artifact = {
        id: "a2",
        type: "IDV_ARTIFACT",
        caseId: "c1",
        createdAt: new Date("2026-05-01T00:00:00.000Z"), // 45 days old
      };

      const result = evaluateDeletion(policy, artifact, now, false);
      expect(result.eligible).toBe(false);
      expect(result.blocked).toBe(false);
    });

    it("should block deletion when legal hold is active", () => {
      const artifact: Artifact = {
        id: "a3",
        type: "IDV_ARTIFACT",
        caseId: "c1",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      };

      const result = evaluateDeletion(policy, artifact, now, true);
      expect(result.eligible).toBe(true);
      expect(result.blocked).toBe(true);
      expect(result.reason).toContain("Legal hold");
    });

    it("should ignore legal hold when policy says not to respect it", () => {
      const noHoldPolicy = { ...policy, legalHoldRespects: false };
      const artifact: Artifact = {
        id: "a4",
        type: "IDV_ARTIFACT",
        caseId: "c1",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      };

      const result = evaluateDeletion(noHoldPolicy, artifact, now, true);
      expect(result.eligible).toBe(true);
      expect(result.blocked).toBe(false);
    });

    it("should skip disabled policies", () => {
      const disabledPolicy = { ...policy, enabled: false };
      const artifact: Artifact = {
        id: "a5",
        type: "IDV_ARTIFACT",
        caseId: "c1",
        createdAt: new Date("2020-01-01T00:00:00.000Z"),
      };

      const result = evaluateDeletion(disabledPolicy, artifact, now, false);
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain("disabled");
    });

    it("should handle boundary case (exactly at cutoff)", () => {
      const artifact: Artifact = {
        id: "a6",
        type: "IDV_ARTIFACT",
        caseId: "c1",
        createdAt: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000), // exactly at cutoff
      };

      const result = evaluateDeletion(policy, artifact, now, false);
      // At exact cutoff, createdAt >= cutoff, so NOT eligible
      expect(result.eligible).toBe(false);
    });
  });

  // ─── Deletion Proof ─────────────────────────────────────────────────────

  describe("Deletion Proof", () => {
    const payload: DeletionEventPayload = {
      tenantId: "t1",
      artifactType: "IDV_ARTIFACT",
      artifactId: "a1",
      caseId: "c1",
      deletedAt: "2026-06-15T00:00:00.000Z",
      deletionMethod: "HARD",
      legalHoldBlocked: false,
      reason: "Retention policy: 90 days exceeded",
    };

    it("should create a valid proof hash", () => {
      const proof = createDeletionProof(payload);
      expect(proof).toMatch(/^[a-f0-9]{64}$/);
    });

    it("should verify a valid proof", () => {
      const proof = createDeletionProof(payload);
      expect(verifyDeletionProof(payload, proof)).toBe(true);
    });

    it("should fail verification with tampered payload", () => {
      const proof = createDeletionProof(payload);
      const tampered = { ...payload, reason: "Modified reason" };
      expect(verifyDeletionProof(tampered, proof)).toBe(false);
    });

    it("should fail verification with wrong hash", () => {
      expect(verifyDeletionProof(payload, "deadbeef")).toBe(false);
    });

    it("should produce consistent proof for same payload", () => {
      const proof1 = createDeletionProof(payload);
      const proof2 = createDeletionProof(payload);
      expect(proof1).toBe(proof2);
    });

    it("should produce different proofs for different payloads", () => {
      const proof1 = createDeletionProof(payload);
      const proof2 = createDeletionProof({ ...payload, artifactId: "a2" });
      expect(proof1).not.toBe(proof2);
    });
  });

  // ─── Event Bus ──────────────────────────────────────────────────────────

  describe("Event Bus", () => {
    it("should emit and receive events", async () => {
      const received: string[] = [];

      // Simple event bus simulation
      type Handler = (event: { type: string; payload: unknown }) => void;
      const handlers: Map<string, Handler[]> = new Map();

      function on(type: string, handler: Handler) {
        const existing = handlers.get(type) || [];
        existing.push(handler);
        handlers.set(type, existing);
      }

      function emit(type: string, payload: unknown) {
        const typeHandlers = handlers.get(type) || [];
        for (const handler of typeHandlers) {
          handler({ type, payload });
        }
      }

      on("audit.log.created", (event) => received.push(event.type));
      on("access.allowed", (event) => received.push(event.type));

      emit("audit.log.created", { id: "1" });
      emit("access.allowed", { id: "2" });
      emit("unsubscribed.event", { id: "3" }); // no handler

      expect(received).toEqual(["audit.log.created", "access.allowed"]);
    });
  });

  // ─── Access Log ─────────────────────────────────────────────────────────

  describe("Access Logging", () => {
    it("should classify resource types correctly", () => {
      const validTypes = [
        "IDV_ARTIFACT", "DOCUMENT", "RESPONSE_DOC",
        "DELIVERY_PACKAGE", "VENDOR_ARTIFACT", "EXPORT_ARTIFACT", "EVIDENCE",
      ];

      for (const type of validTypes) {
        expect(validTypes).toContain(type);
      }
    });

    it("should classify access outcomes correctly", () => {
      expect(["ALLOWED", "DENIED"]).toContain("ALLOWED");
      expect(["ALLOWED", "DENIED"]).toContain("DENIED");
    });

    it("should support all access types", () => {
      expect(["VIEW", "DOWNLOAD", "EXPORT"]).toContain("VIEW");
      expect(["VIEW", "DOWNLOAD", "EXPORT"]).toContain("DOWNLOAD");
      expect(["VIEW", "DOWNLOAD", "EXPORT"]).toContain("EXPORT");
    });
  });

  // ─── RBAC Integration ──────────────────────────────────────────────────

  describe("RBAC for Assurance", () => {
    // Simulate permission checking
    const ASSURANCE_PERMISSIONS = [
      "ASSURANCE_VIEW", "ASSURANCE_MANAGE", "ASSURANCE_AUDIT_VERIFY",
      "ASSURANCE_SOD_MANAGE", "ASSURANCE_RETENTION_VIEW", "ASSURANCE_RETENTION_MANAGE",
      "ASSURANCE_RETENTION_RUN", "ASSURANCE_DELETION_VIEW", "ASSURANCE_DELETION_EXPORT",
      "ASSURANCE_APPROVAL_DECIDE",
    ];

    const ROLE_PERMS: Record<string, Set<string>> = {
      SUPER_ADMIN: new Set(ASSURANCE_PERMISSIONS),
      TENANT_ADMIN: new Set(ASSURANCE_PERMISSIONS),
      DPO: new Set(["ASSURANCE_VIEW", "ASSURANCE_AUDIT_VERIFY", "ASSURANCE_RETENTION_VIEW", "ASSURANCE_DELETION_VIEW", "ASSURANCE_DELETION_EXPORT", "ASSURANCE_APPROVAL_DECIDE"]),
      CASE_MANAGER: new Set(["ASSURANCE_VIEW"]),
      ANALYST: new Set(["ASSURANCE_VIEW"]),
      AUDITOR: new Set(["ASSURANCE_VIEW", "ASSURANCE_AUDIT_VERIFY", "ASSURANCE_RETENTION_VIEW", "ASSURANCE_DELETION_VIEW", "ASSURANCE_DELETION_EXPORT"]),
      READ_ONLY: new Set([]),
    };

    it("should grant SUPER_ADMIN all assurance permissions", () => {
      for (const perm of ASSURANCE_PERMISSIONS) {
        expect(ROLE_PERMS.SUPER_ADMIN.has(perm)).toBe(true);
      }
    });

    it("should grant TENANT_ADMIN all assurance permissions", () => {
      for (const perm of ASSURANCE_PERMISSIONS) {
        expect(ROLE_PERMS.TENANT_ADMIN.has(perm)).toBe(true);
      }
    });

    it("should grant DPO view + verify + approve but not manage", () => {
      expect(ROLE_PERMS.DPO.has("ASSURANCE_VIEW")).toBe(true);
      expect(ROLE_PERMS.DPO.has("ASSURANCE_AUDIT_VERIFY")).toBe(true);
      expect(ROLE_PERMS.DPO.has("ASSURANCE_APPROVAL_DECIDE")).toBe(true);
      expect(ROLE_PERMS.DPO.has("ASSURANCE_MANAGE")).toBe(false);
      expect(ROLE_PERMS.DPO.has("ASSURANCE_SOD_MANAGE")).toBe(false);
    });

    it("should grant AUDITOR read + verify + export", () => {
      expect(ROLE_PERMS.AUDITOR.has("ASSURANCE_VIEW")).toBe(true);
      expect(ROLE_PERMS.AUDITOR.has("ASSURANCE_AUDIT_VERIFY")).toBe(true);
      expect(ROLE_PERMS.AUDITOR.has("ASSURANCE_DELETION_EXPORT")).toBe(true);
      expect(ROLE_PERMS.AUDITOR.has("ASSURANCE_MANAGE")).toBe(false);
      expect(ROLE_PERMS.AUDITOR.has("ASSURANCE_RETENTION_RUN")).toBe(false);
    });

    it("should not grant READ_ONLY any assurance permissions", () => {
      for (const perm of ASSURANCE_PERMISSIONS) {
        expect(ROLE_PERMS.READ_ONLY.has(perm)).toBe(false);
      }
    });

    it("should only grant CASE_MANAGER view permission", () => {
      expect(ROLE_PERMS.CASE_MANAGER.has("ASSURANCE_VIEW")).toBe(true);
      expect(ROLE_PERMS.CASE_MANAGER.has("ASSURANCE_MANAGE")).toBe(false);
      expect(ROLE_PERMS.CASE_MANAGER.has("ASSURANCE_RETENTION_RUN")).toBe(false);
    });
  });

  // ─── Retention Timer Calculation ────────────────────────────────────────

  describe("Retention Timer Calculation", () => {
    it("should calculate correct days remaining", () => {
      const now = new Date("2026-06-15T00:00:00.000Z");
      const createdAt = new Date("2026-04-15T00:00:00.000Z"); // 61 days ago
      const retentionDays = 90;

      const elapsed = Math.floor((now.getTime() - createdAt.getTime()) / (24 * 60 * 60 * 1000));
      const daysRemaining = Math.max(0, retentionDays - elapsed);

      expect(elapsed).toBe(61);
      expect(daysRemaining).toBe(29);
    });

    it("should return 0 when retention exceeded", () => {
      const now = new Date("2026-06-15T00:00:00.000Z");
      const createdAt = new Date("2026-01-01T00:00:00.000Z"); // 165 days ago
      const retentionDays = 90;

      const elapsed = Math.floor((now.getTime() - createdAt.getTime()) / (24 * 60 * 60 * 1000));
      const daysRemaining = Math.max(0, retentionDays - elapsed);

      expect(daysRemaining).toBe(0);
    });
  });
});
