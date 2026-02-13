import { describe, it, expect, beforeEach } from "vitest";
import {
  validateQuerySpec,
  validateQuerySpecEnvelope,
  querySpecSchema,
} from "@/lib/query-spec";
import {
  createPendingResult,
  completeResult,
  resultMetadataSchema,
} from "@/lib/result-metadata";
import { checkRateLimit } from "@/lib/rate-limit";

/* ── Helpers ──────────────────────────────────────────────────────────── */

/** Minimal valid QuerySpec payload (just the required fields). */
function minimalQuerySpec() {
  return {
    subjectIdentifiers: {
      primary: { type: "email", value: "user@example.com" },
    },
    providerScope: {},
  };
}

/** Full QuerySpec payload with every optional field populated. */
function fullQuerySpec() {
  return {
    subjectIdentifiers: {
      primary: { type: "email", value: "user@example.com" },
      alternatives: [
        { type: "upn", value: "user@corp.onmicrosoft.com" },
        { type: "objectId", value: "abc-123-def" },
      ],
    },
    timeRange: {
      from: "2025-01-01T00:00:00+00:00",
      to: "2025-12-31T23:59:59+00:00",
    },
    searchTerms: {
      terms: ["personal data", "PII"],
      matchType: "contains",
    },
    providerScope: { lookupType: "all" },
    outputOptions: {
      mode: "include_content",
      maxItems: 1000,
      includeAttachments: true,
    },
    legal: {
      purpose: "DSAR",
      dataMinimization: false,
      notes: "Full data export requested by DPO.",
    },
    templateId: "tpl-m365-full",
  };
}

/* ══════════════════════════════════════════════════════════════════════ */
/*  QuerySpec Validation                                                */
/* ══════════════════════════════════════════════════════════════════════ */

describe("QuerySpec Validation", () => {
  it("valid minimal QuerySpec passes validation", () => {
    const result = validateQuerySpec(minimalQuerySpec());
    expect(result).toBeDefined();
    expect(result.subjectIdentifiers.primary.type).toBe("email");
    expect(result.subjectIdentifiers.primary.value).toBe("user@example.com");
  });

  it("valid full QuerySpec with all fields passes", () => {
    const result = validateQuerySpec(fullQuerySpec(), "M365");
    expect(result).toBeDefined();
    expect(result.subjectIdentifiers.alternatives).toHaveLength(2);
    expect(result.timeRange?.from).toBe("2025-01-01T00:00:00+00:00");
    expect(result.searchTerms?.terms).toEqual(["personal data", "PII"]);
    expect(result.outputOptions.mode).toBe("include_content");
    expect(result.legal.notes).toContain("Full data export");
    expect(result.templateId).toBe("tpl-m365-full");
  });

  it("missing subjectIdentifiers.primary fails", () => {
    const data = {
      subjectIdentifiers: {},
      providerScope: {},
    };
    expect(() => validateQuerySpec(data)).toThrow();
  });

  it("empty identifier value fails", () => {
    const data = {
      subjectIdentifiers: {
        primary: { type: "email", value: "" },
      },
      providerScope: {},
    };
    expect(() => validateQuerySpec(data)).toThrow();
  });

  it("invalid identifier type fails", () => {
    const data = {
      subjectIdentifiers: {
        primary: { type: "ssn", value: "123-45-6789" },
      },
      providerScope: {},
    };
    expect(() => validateQuerySpec(data)).toThrow();
  });

  it("time range with from > to fails", () => {
    const data = {
      ...minimalQuerySpec(),
      timeRange: {
        from: "2025-12-31T23:59:59+00:00",
        to: "2025-01-01T00:00:00+00:00",
      },
    };
    expect(() => validateQuerySpec(data)).toThrow();
  });

  it("valid time range passes", () => {
    const data = {
      ...minimalQuerySpec(),
      timeRange: {
        from: "2025-01-01T00:00:00+00:00",
        to: "2025-06-30T23:59:59+00:00",
      },
    };
    const result = validateQuerySpec(data);
    expect(result.timeRange).toBeDefined();
    expect(result.timeRange!.from).toBe("2025-01-01T00:00:00+00:00");
    expect(result.timeRange!.to).toBe("2025-06-30T23:59:59+00:00");
  });

  it("output mode defaults to metadata_only", () => {
    const result = validateQuerySpec(minimalQuerySpec());
    expect(result.outputOptions.mode).toBe("metadata_only");
  });

  it("legal purpose must be DSAR", () => {
    const data = {
      ...minimalQuerySpec(),
      legal: { purpose: "marketing", dataMinimization: true },
    };
    expect(() => validateQuerySpec(data)).toThrow();
  });

  it("data minimization defaults to true", () => {
    const result = validateQuerySpec(minimalQuerySpec());
    expect(result.legal.dataMinimization).toBe(true);
  });

  /* ── Provider-specific scope: M365 ─────────────────────────────────── */

  it("M365 scope: valid lookupType passes", () => {
    const data = {
      ...minimalQuerySpec(),
      providerScope: { lookupType: "user_profile" },
    };
    const result = validateQuerySpec(data, "M365");
    expect(result).toBeDefined();
    expect(result.providerScope).toEqual({ lookupType: "user_profile" });
  });

  it("M365 scope: invalid lookupType fails", () => {
    const data = {
      ...minimalQuerySpec(),
      providerScope: { lookupType: "invalid_type" },
    };
    expect(() => validateQuerySpec(data, "M365")).toThrow();
  });

  /* ── Provider-specific scope: Exchange Online ──────────────────────── */

  it("Exchange Online scope: missing mailboxes fails", () => {
    const data = {
      ...minimalQuerySpec(),
      providerScope: { folderScope: "inbox" },
    };
    expect(() => validateQuerySpec(data, "EXCHANGE_ONLINE")).toThrow();
  });

  /* ── Provider-specific scope: SharePoint ───────────────────────────── */

  it("SharePoint scope: valid siteIds passes", () => {
    const data = {
      ...minimalQuerySpec(),
      providerScope: {
        siteIds: ["site-001", "site-002"],
        drivePath: "/Shared Documents",
        fileTypes: [".docx", ".pdf"],
      },
    };
    const result = validateQuerySpec(data, "SHAREPOINT");
    expect(result).toBeDefined();
    expect(result.providerScope).toEqual({
      siteIds: ["site-001", "site-002"],
      drivePath: "/Shared Documents",
      fileTypes: [".docx", ".pdf"],
    });
  });

  /* ── Provider-specific scope: OneDrive ─────────────────────────────── */

  it("OneDrive scope: valid scope passes", () => {
    const data = {
      ...minimalQuerySpec(),
      providerScope: { userDrive: true, folderPath: "/Documents" },
    };
    const result = validateQuerySpec(data, "ONEDRIVE");
    expect(result).toBeDefined();
    expect(result.providerScope).toEqual({
      userDrive: true,
      folderPath: "/Documents",
    });
  });

  /* ── Envelope validation ───────────────────────────────────────────── */

  it("envelope validation passes without provider check", () => {
    const data = {
      ...minimalQuerySpec(),
      providerScope: { anything: "goes", nested: { ok: true } },
    };
    const result = validateQuerySpecEnvelope(data);
    expect(result).toBeDefined();
    expect(result.providerScope).toEqual({
      anything: "goes",
      nested: { ok: true },
    });
  });
});

/* ══════════════════════════════════════════════════════════════════════ */
/*  querySpecSchema (direct Zod parsing)                                */
/* ══════════════════════════════════════════════════════════════════════ */

describe("querySpecSchema", () => {
  it("parses a minimal payload and applies defaults", () => {
    const parsed = querySpecSchema.parse(minimalQuerySpec());
    expect(parsed.outputOptions.maxItems).toBe(500);
    expect(parsed.outputOptions.includeAttachments).toBe(false);
    expect(parsed.legal.purpose).toBe("DSAR");
    expect(parsed.legal.dataMinimization).toBe(true);
    expect(parsed.subjectIdentifiers.alternatives).toEqual([]);
  });

  it("rejects completely empty input", () => {
    expect(() => querySpecSchema.parse({})).toThrow();
  });
});

/* ══════════════════════════════════════════════════════════════════════ */
/*  ResultMetadata                                                      */
/* ══════════════════════════════════════════════════════════════════════ */

describe("ResultMetadata", () => {
  it("createPendingResult creates valid structure", () => {
    const result = createPendingResult("M365", "user_profile");
    expect(result.provider).toBe("M365");
    expect(result.workload).toBe("user_profile");
    expect(result.counts).toEqual({
      matched: 0,
      exported: 0,
      attachments: 0,
      skipped: 0,
    });
    expect(result.artifacts).toEqual([]);
    expect(result.runInfo.status).toBe("success");
    expect(result.runInfo.startedAt).toBeDefined();
    expect(result.runInfo.completedAt).toBeUndefined();
    expect(result.runInfo.durationMs).toBeUndefined();
  });

  it("completeResult adds completedAt and durationMs", () => {
    const pending = createPendingResult("EXCHANGE_ONLINE", "mailbox");
    const completed = completeResult(pending, {
      counts: { matched: 42, exported: 40, attachments: 5, skipped: 2 },
      artifacts: [
        { type: "export_zip", filename: "mailbox-export.zip", size: 1024000 },
      ],
    });

    expect(completed.runInfo.completedAt).toBeDefined();
    expect(typeof completed.runInfo.durationMs).toBe("number");
    expect(completed.runInfo.durationMs!).toBeGreaterThanOrEqual(0);
    expect(completed.runInfo.status).toBe("success");
    expect(completed.counts.matched).toBe(42);
    expect(completed.counts.exported).toBe(40);
    expect(completed.artifacts).toHaveLength(1);
    expect(completed.artifacts[0].filename).toBe("mailbox-export.zip");
  });

  it("completeResult with failed status", () => {
    const pending = createPendingResult("SHAREPOINT", "site_export");
    const failed = completeResult(pending, {
      status: "failed",
      errorMessage: "Insufficient permissions to access site",
    });

    expect(failed.runInfo.status).toBe("failed");
    expect(failed.runInfo.errorMessage).toBe(
      "Insufficient permissions to access site"
    );
    expect(failed.runInfo.completedAt).toBeDefined();
    expect(typeof failed.runInfo.durationMs).toBe("number");
  });

  it("resultMetadataSchema validates correct data", () => {
    const data = {
      provider: "M365",
      workload: "user_profile",
      counts: { matched: 10, exported: 10, attachments: 0, skipped: 0 },
      artifacts: [
        {
          type: "metadata_json",
          filename: "user-profile.json",
          mimeType: "application/json",
          size: 2048,
        },
      ],
      runInfo: {
        startedAt: "2025-06-01T10:00:00.000Z",
        completedAt: "2025-06-01T10:00:05.000Z",
        status: "success",
        durationMs: 5000,
      },
    };
    const parsed = resultMetadataSchema.parse(data);
    expect(parsed.provider).toBe("M365");
    expect(parsed.runInfo.status).toBe("success");
    expect(parsed.artifacts).toHaveLength(1);
  });

  it("resultMetadataSchema rejects invalid data", () => {
    const data = {
      provider: "M365",
      // missing workload
      counts: { matched: -1 }, // negative number
      artifacts: [],
      runInfo: {
        startedAt: "not-a-date",
        status: "unknown_status",
      },
    };
    expect(() => resultMetadataSchema.parse(data)).toThrow();
  });
});

/* ══════════════════════════════════════════════════════════════════════ */
/*  Rate Limiter                                                        */
/* ══════════════════════════════════════════════════════════════════════ */

describe("Rate Limiter", () => {
  // Use a unique key prefix per test to avoid inter-test contamination.
  // The in-memory store persists across tests within the same vitest worker.
  let keyCounter = 0;
  function uniqueKey(prefix = "test") {
    return `${prefix}:${Date.now()}:${++keyCounter}`;
  }

  const config = { maxRequests: 3, windowMs: 60_000 };

  it("first request is allowed", () => {
    const key = uniqueKey();
    const result = checkRateLimit(key, config);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2); // 3 max - 1 used = 2
    expect(result.retryAfterMs).toBeUndefined();
  });

  it("requests within limit are allowed", () => {
    const key = uniqueKey();
    const r1 = checkRateLimit(key, config);
    const r2 = checkRateLimit(key, config);
    const r3 = checkRateLimit(key, config);

    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);

    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(1);

    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);
  });

  it("exceeding limit returns not allowed", () => {
    const key = uniqueKey();
    // Use up all 3 tokens
    checkRateLimit(key, config);
    checkRateLimit(key, config);
    checkRateLimit(key, config);

    // 4th request should be denied
    const result = checkRateLimit(key, config);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfterMs).toBeDefined();
    expect(result.retryAfterMs!).toBeGreaterThan(0);
  });

  it("different keys have independent limits", () => {
    const keyA = uniqueKey("a");
    const keyB = uniqueKey("b");

    // Exhaust key A
    checkRateLimit(keyA, config);
    checkRateLimit(keyA, config);
    checkRateLimit(keyA, config);
    const blockedA = checkRateLimit(keyA, config);

    // Key B should still be fresh
    const freshB = checkRateLimit(keyB, config);

    expect(blockedA.allowed).toBe(false);
    expect(freshB.allowed).toBe(true);
    expect(freshB.remaining).toBe(2);
  });
});
