import { describe, it, expect, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Detection Service
// ---------------------------------------------------------------------------
import {
  detectPII,
  detectArt9,
  runAllDetectors,
  classifyFindings,
  hasArt9Content,
  getArt9Categories,
} from "@/lib/copilot/detection";
import type { DetectionResult } from "@/lib/copilot/detection";

// ---------------------------------------------------------------------------
// Identity Service
// ---------------------------------------------------------------------------
import {
  buildInitialIdentityGraph,
  mergeIdentifiers,
  addResolvedSystem,
  buildSubjectIdentifiers,
} from "@/lib/copilot/identity";
import type { IdentityEntry, IdentityGraph } from "@/lib/copilot/identity";

// ---------------------------------------------------------------------------
// RBAC — Copilot permissions
// ---------------------------------------------------------------------------
import {
  hasPermission,
  checkPermission,
  canUseCopilot,
  canReadCopilot,
} from "@/lib/rbac";

// =========================================================================
// 1. Detection Service
// =========================================================================
describe("Detection Service", () => {
  // -----------------------------------------------------------------------
  // detectPII
  // -----------------------------------------------------------------------
  describe("detectPII", () => {
    it("should detect a German IBAN (DE89370400440532013000)", () => {
      const text = "Please transfer to DE89370400440532013000 immediately.";
      const results = detectPII(text);
      const ibanResult = results.find((r) => r.patternName.startsWith("IBAN"));
      expect(ibanResult).toBeDefined();
      expect(ibanResult!.matchCount).toBeGreaterThanOrEqual(1);
      expect(ibanResult!.category).toBe("PAYMENT_BANK");
      expect(ibanResult!.isArt9).toBe(false);
    });

    it("should detect a Visa credit card number (4111111111111111)", () => {
      const text = "Card number: 4111111111111111";
      const results = detectPII(text);
      const ccResult = results.find((r) =>
        r.patternName.startsWith("CREDIT_CARD")
      );
      expect(ccResult).toBeDefined();
      expect(ccResult!.matchCount).toBeGreaterThanOrEqual(1);
      expect(ccResult!.category).toBe("PAYMENT_BANK");
    });

    it("should detect an email address (test@example.com)", () => {
      const text = "Send it to test@example.com please.";
      const results = detectPII(text);
      const emailResult = results.find(
        (r) => r.patternName === "EMAIL_ADDRESS"
      );
      expect(emailResult).toBeDefined();
      expect(emailResult!.matchCount).toBe(1);
      expect(emailResult!.category).toBe("CONTACT");
    });

    it("should detect an international phone number (+49 170 1234567)", () => {
      const text = "Call me at +49 170 1234567 any time.";
      const results = detectPII(text);
      const phoneResult = results.find((r) =>
        r.patternName.startsWith("PHONE")
      );
      expect(phoneResult).toBeDefined();
      expect(phoneResult!.category).toBe("CONTACT");
    });

    it("should detect a German tax ID (12345678901)", () => {
      const text = "Tax ID: 12 345 678 901 on the record.";
      const results = detectPII(text);
      const taxResult = results.find((r) => r.patternName === "TAX_ID_DE");
      expect(taxResult).toBeDefined();
      expect(taxResult!.category).toBe("IDENTIFICATION");
    });

    it("should return an empty array for empty string input", () => {
      expect(detectPII("")).toEqual([]);
    });

    it("should return an empty array for non-string input", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(detectPII(null as any)).toEqual([]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(detectPII(undefined as any)).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // Redaction of sample matches
  // -----------------------------------------------------------------------
  describe("redaction of sample matches", () => {
    it("should redact IBAN keeping country code and last 4 digits", () => {
      const text = "IBAN: DE89370400440532013000";
      const results = detectPII(text);
      const ibanResult = results.find((r) => r.patternName.startsWith("IBAN"));
      expect(ibanResult).toBeDefined();
      expect(ibanResult!.sampleMatch).not.toBeNull();
      const sample = ibanResult!.sampleMatch!;
      // Should start with "DE" and end with last 4 digits
      expect(sample.startsWith("DE")).toBe(true);
      expect(sample.endsWith("3000")).toBe(true);
      // Middle should contain asterisks
      expect(sample).toContain("*");
    });

    it("should redact credit card keeping first 4 and last 4 digits", () => {
      const text = "Card: 4111111111111111";
      const results = detectPII(text);
      const ccResult = results.find((r) =>
        r.patternName.startsWith("CREDIT_CARD")
      );
      expect(ccResult).toBeDefined();
      const sample = ccResult!.sampleMatch!;
      expect(sample.startsWith("4111")).toBe(true);
      expect(sample.endsWith("1111")).toBe(true);
      expect(sample).toContain("*");
    });

    it("should redact email keeping first character and domain", () => {
      const text = "Email: test@example.com";
      const results = detectPII(text);
      const emailResult = results.find(
        (r) => r.patternName === "EMAIL_ADDRESS"
      );
      expect(emailResult).toBeDefined();
      const sample = emailResult!.sampleMatch!;
      expect(sample.startsWith("t")).toBe(true);
      expect(sample).toContain("@example.com");
      expect(sample).toContain("*");
    });

    it("should redact phone number keeping prefix and last digits", () => {
      const text = "Phone: +49 170 1234567";
      const results = detectPII(text);
      const phoneResult = results.find((r) =>
        r.patternName.startsWith("PHONE")
      );
      expect(phoneResult).toBeDefined();
      const sample = phoneResult!.sampleMatch!;
      // redactPhone uses redactMiddle(match, 4, 2)
      expect(sample).toContain("*");
    });

    it("should redact German tax ID keeping first 2 and last 2 digits", () => {
      const text = "Tax: 12 345 678 901";
      const results = detectPII(text);
      const taxResult = results.find((r) => r.patternName === "TAX_ID_DE");
      expect(taxResult).toBeDefined();
      const sample = taxResult!.sampleMatch!;
      expect(sample.startsWith("12")).toBe(true);
      expect(sample.endsWith("01")).toBe(true);
      expect(sample).toContain("*");
    });
  });

  // -----------------------------------------------------------------------
  // detectArt9
  // -----------------------------------------------------------------------
  describe("detectArt9", () => {
    it("should detect health keywords in medical text", () => {
      const text = "The patient was diagnosed with diabetes";
      const results = detectArt9(text);
      expect(results.length).toBeGreaterThan(0);

      const healthResult = results.find(
        (r) => r.art9Type === "health_data"
      );
      expect(healthResult).toBeDefined();
      expect(healthResult!.isArt9).toBe(true);
      expect(healthResult!.category).toBe("SPECIAL_CATEGORY_ART9");
    });

    it("should detect political keywords", () => {
      const text = "Records show political party membership since 2018.";
      const results = detectArt9(text);
      const politicalResult = results.find(
        (r) => r.art9Type === "political_opinions"
      );
      expect(politicalResult).toBeDefined();
      expect(politicalResult!.isArt9).toBe(true);
    });

    it("should detect religious keywords (Kirchensteuer)", () => {
      const text = "Monthly Kirchensteuer payment of 42 EUR.";
      const results = detectArt9(text);
      const religiousResult = results.find(
        (r) => r.art9Type === "religious_beliefs"
      );
      expect(religiousResult).toBeDefined();
      expect(religiousResult!.isArt9).toBe(true);
    });

    it("should return empty array for innocuous text", () => {
      const text = "Hello world, nice day today";
      const results = detectArt9(text);
      expect(results).toEqual([]);
    });

    it("should redact Art. 9 keyword samples as bracketed lowercase text", () => {
      const text = "The patient was diagnosed with diabetes";
      const results = detectArt9(text);
      const healthResult = results.find(
        (r) => r.art9Type === "health_data"
      );
      expect(healthResult).toBeDefined();
      expect(healthResult!.sampleMatch).not.toBeNull();
      // redactKeyword wraps in brackets and lowercases
      expect(healthResult!.sampleMatch!.startsWith("[")).toBe(true);
      expect(healthResult!.sampleMatch!.endsWith("]")).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // runAllDetectors
  // -----------------------------------------------------------------------
  describe("runAllDetectors", () => {
    it("should combine PII and Art. 9 results", () => {
      const text =
        "Email: test@example.com. The patient was diagnosed with diabetes.";
      const results = runAllDetectors(text);

      // Should contain at least one PII result and one Art. 9 result
      const piiResults = results.filter((r) => !r.isArt9);
      const art9Results = results.filter((r) => r.isArt9);

      expect(piiResults.length).toBeGreaterThan(0);
      expect(art9Results.length).toBeGreaterThan(0);
    });

    it("should sort results by confidence descending", () => {
      const text =
        "Card: 4111111111111111. The patient needs treatment. Email: foo@bar.com";
      const results = runAllDetectors(text);

      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].confidence).toBeGreaterThanOrEqual(
          results[i + 1].confidence
        );
      }
    });

    it("should return empty array for empty text", () => {
      expect(runAllDetectors("")).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // classifyFindings
  // -----------------------------------------------------------------------
  describe("classifyFindings", () => {
    it("should return correct data categories for mixed results", () => {
      const text =
        "IBAN: DE89370400440532013000. Email: test@example.com. The patient needs treatment.";
      const results = runAllDetectors(text);
      const categories = classifyFindings(results);

      expect(categories).toContain("PAYMENT_BANK");
      expect(categories).toContain("CONTACT");
      expect(categories).toContain("SPECIAL_CATEGORY_ART9");
    });

    it("should return unique categories only", () => {
      const text = "Email: a@b.com and phone +49 170 1234567";
      const results = runAllDetectors(text);
      const categories = classifyFindings(results);

      // categories should not have duplicates
      const unique = Array.from(new Set(categories));
      expect(categories.length).toBe(unique.length);
    });

    it("should return empty array for empty results", () => {
      expect(classifyFindings([])).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // hasArt9Content
  // -----------------------------------------------------------------------
  describe("hasArt9Content", () => {
    it("should return true when Art. 9 content is present", () => {
      const text = "The patient was diagnosed with diabetes.";
      const results = runAllDetectors(text);
      expect(hasArt9Content(results)).toBe(true);
    });

    it("should return false when no Art. 9 content is present", () => {
      const text = "Email: test@example.com and IBAN: DE89370400440532013000";
      const results = detectPII(text);
      expect(hasArt9Content(results)).toBe(false);
    });

    it("should return false for empty results", () => {
      expect(hasArt9Content([])).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // getArt9Categories
  // -----------------------------------------------------------------------
  describe("getArt9Categories", () => {
    it("should return proper category names for health content", () => {
      const text = "The patient was diagnosed with diabetes.";
      const results = runAllDetectors(text);
      const art9Cats = getArt9Categories(results);
      expect(art9Cats).toContain("health_data");
    });

    it("should return multiple categories for mixed Art. 9 content", () => {
      const text =
        "The patient has a diagnosis. Records show political party membership. Kirchensteuer payment received.";
      const results = runAllDetectors(text);
      const art9Cats = getArt9Categories(results);

      expect(art9Cats).toContain("health_data");
      expect(art9Cats).toContain("political_opinions");
      expect(art9Cats).toContain("religious_beliefs");
    });

    it("should return empty array when no Art. 9 content", () => {
      const results = detectPII("Email: test@example.com");
      expect(getArt9Categories(results)).toEqual([]);
    });

    it("should return empty array for empty results", () => {
      expect(getArt9Categories([])).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // No false positives on innocuous text
  // -----------------------------------------------------------------------
  describe("no false positives", () => {
    it("should not produce PII or Art. 9 findings for innocuous text", () => {
      const text = "Hello world, nice day today";
      const piiResults = detectPII(text);
      const art9Results = detectArt9(text);

      // Filter out any low-confidence noise that might match generic patterns
      const significantPII = piiResults.filter((r) => r.confidence >= 0.7);
      const significantArt9 = art9Results.filter((r) => r.confidence >= 0.5);

      expect(significantArt9).toEqual([]);
      // We allow some PII pattern noise from very generic regexes, but no
      // high-confidence matches on truly innocuous text
      expect(significantPII.length).toBe(0);
    });
  });
});

// =========================================================================
// 2. Identity Service
// =========================================================================
describe("Identity Service", () => {
  // -----------------------------------------------------------------------
  // buildInitialIdentityGraph
  // -----------------------------------------------------------------------
  describe("buildInitialIdentityGraph", () => {
    it("should build a graph with full data subject information", () => {
      const graph = buildInitialIdentityGraph({
        fullName: "Max Mustermann",
        email: "max@example.com",
        phone: "+49 170 1234567",
        address: "Musterstrasse 1, 10115 Berlin",
        identifiers: {
          employeeId: "EMP-001",
          upn: "max@corp.onmicrosoft.com",
        },
      });

      expect(graph.primaryEmail).toBe("max@example.com");
      expect(graph.primaryName).toBe("Max Mustermann");
      expect(graph.resolvedSystems).toEqual([]);

      // Should have identifiers for name, email, phone, employeeId, upn
      expect(graph.identifiers.length).toBeGreaterThanOrEqual(5);

      const types = graph.identifiers.map((id) => id.type);
      expect(types).toContain("name");
      expect(types).toContain("email");
      expect(types).toContain("phone");
      expect(types).toContain("employeeId");
      expect(types).toContain("upn");

      // All case_data identifiers should have confidence 1.0
      for (const entry of graph.identifiers) {
        expect(entry.source).toBe("case_data");
        expect(entry.confidence).toBe(1.0);
      }

      // Overall confidence should be positive
      expect(graph.confidence).toBeGreaterThan(0);
    });

    it("should build a graph with minimal data (only fullName)", () => {
      const graph = buildInitialIdentityGraph({
        fullName: "Jane Doe",
        email: null,
        phone: null,
        address: null,
      });

      expect(graph.primaryEmail).toBeNull();
      expect(graph.primaryName).toBe("Jane Doe");
      expect(graph.identifiers).toHaveLength(1);
      expect(graph.identifiers[0].type).toBe("name");
      expect(graph.identifiers[0].value).toBe("Jane Doe");
      expect(graph.identifiers[0].confidence).toBe(1.0);
      expect(graph.confidence).toBeGreaterThan(0);
    });

    it("should de-duplicate identifiers from the custom identifiers field", () => {
      const graph = buildInitialIdentityGraph({
        fullName: "Max Mustermann",
        email: "max@example.com",
        phone: null,
        address: null,
        identifiers: {
          // This email is the same as the primary — should be de-duplicated
          email: "max@example.com",
          alternateEmail: "max.alt@example.com",
        },
      });

      // Should have: name, email (primary), alternateEmail — NOT a duplicate email
      const emailEntries = graph.identifiers.filter(
        (id) => id.type === "email"
      );
      expect(emailEntries).toHaveLength(2); // primary + alternate, but not 3
    });
  });

  // -----------------------------------------------------------------------
  // mergeIdentifiers
  // -----------------------------------------------------------------------
  describe("mergeIdentifiers", () => {
    let baseGraph: IdentityGraph;

    beforeEach(() => {
      baseGraph = buildInitialIdentityGraph({
        fullName: "Max Mustermann",
        email: "max@example.com",
        phone: null,
        address: null,
      });
    });

    it("should de-duplicate when merging identical identifiers", () => {
      const newEntries: IdentityEntry[] = [
        {
          type: "email",
          value: "max@example.com",
          source: "ad_connector",
          confidence: 0.9,
        },
      ];

      const merged = mergeIdentifiers(baseGraph, newEntries, "ad_connector");

      // Should still only have one email entry (de-duplicated)
      const emailEntries = merged.identifiers.filter(
        (id) => id.type === "email"
      );
      expect(emailEntries).toHaveLength(1);
    });

    it("should update confidence when same identifier comes from a different source", () => {
      const newEntries: IdentityEntry[] = [
        {
          type: "email",
          value: "max@example.com",
          source: "ad_connector",
          confidence: 0.8,
        },
      ];

      const merged = mergeIdentifiers(baseGraph, newEntries, "ad_connector");

      const emailEntry = merged.identifiers.find(
        (id) => id.type === "email"
      );
      expect(emailEntry).toBeDefined();
      // Original confidence was 1.0 from case_data.
      // The merge keeps max(1.0, 0.8) = 1.0 and since sources differ and
      // new entry >= 0.5, applies a +0.05 corroboration boost clamped to 1.0.
      expect(emailEntry!.confidence).toBe(1.0); // clamped at max
    });

    it("should add new unique identifiers", () => {
      const newEntries: IdentityEntry[] = [
        {
          type: "employeeId",
          value: "EMP-999",
          source: "hr_system",
          confidence: 0.85,
        },
      ];

      const merged = mergeIdentifiers(baseGraph, newEntries, "hr_system");

      const empEntry = merged.identifiers.find(
        (id) => id.type === "employeeId" && id.value === "EMP-999"
      );
      expect(empEntry).toBeDefined();
      expect(empEntry!.source).toBe("hr_system");
      expect(empEntry!.confidence).toBe(0.85);
    });

    it("should skip entries below the minimum confidence threshold", () => {
      const newEntries: IdentityEntry[] = [
        {
          type: "custom",
          value: "low-confidence-id",
          source: "weak_source",
          confidence: 0.05, // below 0.1 threshold
        },
      ];

      const merged = mergeIdentifiers(baseGraph, newEntries, "weak_source");

      const customEntry = merged.identifiers.find(
        (id) => id.value === "low-confidence-id"
      );
      expect(customEntry).toBeUndefined();
    });

    it("should not mutate the original graph", () => {
      const originalLength = baseGraph.identifiers.length;
      const newEntries: IdentityEntry[] = [
        {
          type: "objectId",
          value: "abc-123",
          source: "entra",
          confidence: 0.9,
        },
      ];

      mergeIdentifiers(baseGraph, newEntries, "entra");

      // Original graph should be unchanged
      expect(baseGraph.identifiers.length).toBe(originalLength);
    });
  });

  // -----------------------------------------------------------------------
  // addResolvedSystem
  // -----------------------------------------------------------------------
  describe("addResolvedSystem", () => {
    let baseGraph: IdentityGraph;

    beforeEach(() => {
      baseGraph = buildInitialIdentityGraph({
        fullName: "Max Mustermann",
        email: "max@example.com",
        phone: null,
        address: null,
      });
    });

    it("should add a new system to the graph", () => {
      const updated = addResolvedSystem(baseGraph, {
        provider: "microsoft_entra",
        accountId: "user-obj-id-123",
        displayName: "Max Mustermann",
        lastSeen: "2026-01-15T10:00:00Z",
      });

      expect(updated.resolvedSystems).toHaveLength(1);
      expect(updated.resolvedSystems[0].provider).toBe("microsoft_entra");
      expect(updated.resolvedSystems[0].accountId).toBe("user-obj-id-123");
      expect(updated.resolvedSystems[0].displayName).toBe("Max Mustermann");
    });

    it("should update an existing system (same provider + accountId)", () => {
      const withSystem = addResolvedSystem(baseGraph, {
        provider: "microsoft_entra",
        accountId: "user-obj-id-123",
        displayName: "Max M.",
        lastSeen: "2026-01-10T10:00:00Z",
      });

      const updated = addResolvedSystem(withSystem, {
        provider: "microsoft_entra",
        accountId: "user-obj-id-123",
        displayName: "Max Mustermann (Updated)",
        lastSeen: "2026-01-20T10:00:00Z",
      });

      // Should still have only 1 system, not 2
      expect(updated.resolvedSystems).toHaveLength(1);
      expect(updated.resolvedSystems[0].displayName).toBe(
        "Max Mustermann (Updated)"
      );
      expect(updated.resolvedSystems[0].lastSeen).toBe(
        "2026-01-20T10:00:00Z"
      );
    });

    it("should add multiple different systems", () => {
      let updated = addResolvedSystem(baseGraph, {
        provider: "microsoft_entra",
        accountId: "user-obj-id-123",
        displayName: "Max M.",
      });
      updated = addResolvedSystem(updated, {
        provider: "salesforce",
        accountId: "sf-contact-456",
        displayName: "Max Mustermann",
      });

      expect(updated.resolvedSystems).toHaveLength(2);
      const providers = updated.resolvedSystems.map((s) => s.provider);
      expect(providers).toContain("microsoft_entra");
      expect(providers).toContain("salesforce");
    });

    it("should update overall confidence when systems are added", () => {
      const confidenceBefore = baseGraph.confidence;

      const withOneSystem = addResolvedSystem(baseGraph, {
        provider: "microsoft_entra",
        accountId: "user-obj-id-123",
        displayName: "Max M.",
      });

      const withTwoSystems = addResolvedSystem(withOneSystem, {
        provider: "salesforce",
        accountId: "sf-contact-456",
        displayName: "Max Mustermann",
      });

      // With corroboration bonus, more systems should increase confidence
      // (unless already at 1.0)
      expect(withTwoSystems.confidence).toBeGreaterThanOrEqual(
        confidenceBefore
      );
    });
  });

  // -----------------------------------------------------------------------
  // buildSubjectIdentifiers
  // -----------------------------------------------------------------------
  describe("buildSubjectIdentifiers", () => {
    it("should return primary email and alternatives sorted by confidence", () => {
      const graph = buildInitialIdentityGraph({
        fullName: "Max Mustermann",
        email: "max@example.com",
        phone: "+49 170 1234567",
        address: null,
        identifiers: {
          employeeId: "EMP-001",
        },
      });

      const { primary, alternatives } = buildSubjectIdentifiers(graph);

      // Email should be primary (highest type priority)
      expect(primary.type).toBe("email");
      expect(primary.value).toBe("max@example.com");

      // Alternatives should contain the other identifiers
      expect(alternatives.length).toBeGreaterThanOrEqual(2);

      const altTypes = alternatives.map((a) => a.type);
      expect(altTypes).toContain("phone");
      expect(altTypes).toContain("name");
    });

    it("should handle a graph with only a name identifier", () => {
      const graph = buildInitialIdentityGraph({
        fullName: "Jane Doe",
        email: null,
        phone: null,
        address: null,
      });

      const { primary, alternatives } = buildSubjectIdentifiers(graph);

      expect(primary.type).toBe("name");
      expect(primary.value).toBe("Jane Doe");
      expect(alternatives).toEqual([]);
    });

    it("should handle an empty identity graph", () => {
      const emptyGraph: IdentityGraph = {
        primaryEmail: null,
        primaryName: null,
        identifiers: [],
        resolvedSystems: [],
        confidence: 0,
      };

      const { primary, alternatives } = buildSubjectIdentifiers(emptyGraph);

      // Fallback: empty primary
      expect(primary.type).toBe("email");
      expect(primary.value).toBe("");
      expect(alternatives).toEqual([]);
    });
  });
});

// =========================================================================
// 3. RBAC Copilot Permissions
// =========================================================================
describe("RBAC Copilot Permissions", () => {
  describe("copilot create permission", () => {
    it("should allow SUPER_ADMIN to create copilot runs", () => {
      expect(hasPermission("SUPER_ADMIN", "copilot", "create")).toBe(true);
    });

    it("should allow TENANT_ADMIN to create copilot runs", () => {
      expect(hasPermission("TENANT_ADMIN", "copilot", "create")).toBe(true);
    });

    it("should allow DPO to create copilot runs", () => {
      expect(hasPermission("DPO", "copilot", "create")).toBe(true);
    });

    it("should allow CASE_MANAGER to create copilot runs", () => {
      expect(hasPermission("CASE_MANAGER", "copilot", "create")).toBe(true);
    });

    it("should NOT allow CONTRIBUTOR to create copilot runs", () => {
      expect(hasPermission("CONTRIBUTOR", "copilot", "create")).toBe(false);
    });

    it("should NOT allow READ_ONLY to create copilot runs", () => {
      expect(hasPermission("READ_ONLY", "copilot", "create")).toBe(false);
    });
  });

  describe("copilot read permission", () => {
    it("should allow CONTRIBUTOR to read copilot results", () => {
      expect(hasPermission("CONTRIBUTOR", "copilot", "read")).toBe(true);
    });

    it("should allow CASE_MANAGER to read copilot results", () => {
      expect(hasPermission("CASE_MANAGER", "copilot", "read")).toBe(true);
    });

    it("should NOT allow READ_ONLY to read copilot results", () => {
      expect(hasPermission("READ_ONLY", "copilot", "read")).toBe(false);
    });
  });

  describe("checkPermission throws on forbidden access", () => {
    it("should throw ApiError(403) when CONTRIBUTOR tries copilot create", () => {
      expect(() =>
        checkPermission("CONTRIBUTOR", "copilot", "create")
      ).toThrow();
    });

    it("should throw ApiError(403) when READ_ONLY tries copilot read", () => {
      expect(() =>
        checkPermission("READ_ONLY", "copilot", "read")
      ).toThrow();
    });

    it("should NOT throw when SUPER_ADMIN creates copilot run", () => {
      expect(() =>
        checkPermission("SUPER_ADMIN", "copilot", "create")
      ).not.toThrow();
    });
  });

  describe("canUseCopilot helper", () => {
    it("should return true for SUPER_ADMIN", () => {
      expect(canUseCopilot("SUPER_ADMIN")).toBe(true);
    });

    it("should return true for TENANT_ADMIN", () => {
      expect(canUseCopilot("TENANT_ADMIN")).toBe(true);
    });

    it("should return true for DPO", () => {
      expect(canUseCopilot("DPO")).toBe(true);
    });

    it("should return true for CASE_MANAGER", () => {
      expect(canUseCopilot("CASE_MANAGER")).toBe(true);
    });

    it("should return false for CONTRIBUTOR", () => {
      expect(canUseCopilot("CONTRIBUTOR")).toBe(false);
    });

    it("should return false for READ_ONLY", () => {
      expect(canUseCopilot("READ_ONLY")).toBe(false);
    });
  });

  describe("canReadCopilot helper", () => {
    it("should return true for SUPER_ADMIN", () => {
      expect(canReadCopilot("SUPER_ADMIN")).toBe(true);
    });

    it("should return true for CONTRIBUTOR", () => {
      expect(canReadCopilot("CONTRIBUTOR")).toBe(true);
    });

    it("should return false for READ_ONLY", () => {
      expect(canReadCopilot("READ_ONLY")).toBe(false);
    });
  });
});

// =========================================================================
// 4. Art. 9 Gating Logic
// =========================================================================
describe("Art. 9 Gating Logic", () => {
  it("should set isArt9: true in findings when Art. 9 content is detected", () => {
    const text = "The patient was diagnosed with diabetes.";
    const results = runAllDetectors(text);
    const art9Findings = results.filter((r) => r.isArt9);

    expect(art9Findings.length).toBeGreaterThan(0);
    for (const finding of art9Findings) {
      expect(finding.isArt9).toBe(true);
      expect(finding.category).toBe("SPECIAL_CATEGORY_ART9");
      expect(finding.art9Type).toBeDefined();
    }
  });

  it("should properly aggregate multiple Art. 9 categories", () => {
    const text = [
      "The patient was diagnosed with diabetes.",
      "Records indicate political party membership.",
      "The Kirchensteuer payment was processed.",
      "Biometric fingerprint data was collected.",
      "Trade union membership confirmed.",
    ].join(" ");

    const results = runAllDetectors(text);
    const art9Cats = getArt9Categories(results);

    expect(art9Cats).toContain("health_data");
    expect(art9Cats).toContain("political_opinions");
    expect(art9Cats).toContain("religious_beliefs");
    expect(art9Cats).toContain("biometric_data");
    expect(art9Cats).toContain("trade_union_membership");
    expect(art9Cats.length).toBeGreaterThanOrEqual(5);
  });

  it("should handle mixed Art. 9 and non-Art. 9 content correctly", () => {
    const text =
      "Email: test@example.com. Card: 4111111111111111. The patient needs treatment. Kirchensteuer: 42 EUR.";
    const results = runAllDetectors(text);

    const piiResults = results.filter((r) => !r.isArt9);
    const art9Results = results.filter((r) => r.isArt9);

    expect(piiResults.length).toBeGreaterThan(0);
    expect(art9Results.length).toBeGreaterThan(0);

    // PII results should have standard categories
    const piiCategories = classifyFindings(piiResults);
    expect(piiCategories).toContain("CONTACT"); // email
    expect(piiCategories).toContain("PAYMENT_BANK"); // credit card

    // Art. 9 results should include health and religious
    const art9Cats = getArt9Categories(art9Results);
    expect(art9Cats).toContain("health_data");
    expect(art9Cats).toContain("religious_beliefs");

    // hasArt9Content should be true on the full set
    expect(hasArt9Content(results)).toBe(true);
  });

  it("should return isArt9: false for purely PII content without special categories", () => {
    const text = "Email: test@example.com. IBAN: DE89370400440532013000.";
    const results = runAllDetectors(text);

    expect(hasArt9Content(results)).toBe(false);
    expect(getArt9Categories(results)).toEqual([]);

    for (const r of results) {
      expect(r.isArt9).toBe(false);
    }
  });
});
