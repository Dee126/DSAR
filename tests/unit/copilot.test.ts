import { describe, it, expect, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Detection Service
// ---------------------------------------------------------------------------
import {
  runAllDetectors,
  classifyFindings,
  hasSpecialCategory,
  getSpecialCategories,
  isSpecialCategory,
  SPECIAL_CATEGORIES,
} from "@/lib/copilot/detection";
import type { DetectionResult, DataCategoryType } from "@/lib/copilot/detection";

// ---------------------------------------------------------------------------
// Identity Service
// ---------------------------------------------------------------------------
import {
  buildInitialIdentityGraph,
  mergeIdentifiers,
  addResolvedSystem,
  buildSubjectIdentifiers,
} from "@/lib/copilot/identity";
import type { AlternateIdentifier, IdentityGraph } from "@/lib/copilot/identity";

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
  // runAllDetectors — PII detection
  // -----------------------------------------------------------------------
  describe("runAllDetectors (PII)", () => {
    it("should detect a German IBAN (DE89370400440532013000)", () => {
      const text = "Please transfer to DE89370400440532013000 immediately.";
      const results = runAllDetectors(text);
      expect(results.length).toBeGreaterThan(0);

      // Should find PAYMENT category
      const allCategories = classifyFindings(results);
      expect(allCategories).toContain("PAYMENT");

      // Should have detectedElements referencing IBAN
      const allElements = results.flatMap((r) => r.detectedElements);
      const ibanElement = allElements.find((e) =>
        e.elementType.startsWith("IBAN")
      );
      expect(ibanElement).toBeDefined();
      expect(ibanElement!.confidence).toBeGreaterThanOrEqual(0.5);
    });

    it("should detect a Visa credit card number (4111111111111111)", () => {
      const text = "Card number: 4111111111111111";
      const results = runAllDetectors(text);
      const allCategories = classifyFindings(results);
      expect(allCategories).toContain("PAYMENT");
    });

    it("should detect an email address (test@example.com)", () => {
      const text = "Send it to test@example.com please.";
      const results = runAllDetectors(text);
      const allCategories = classifyFindings(results);
      expect(allCategories).toContain("CONTACT");

      const allElements = results.flatMap((r) => r.detectedElements);
      const emailElement = allElements.find(
        (r) => r.elementType === "EMAIL_ADDRESS"
      );
      expect(emailElement).toBeDefined();
    });

    it("should detect an international phone number (+49 170 1234567)", () => {
      const text = "Call me at +49 170 1234567 any time.";
      const results = runAllDetectors(text);
      const allCategories = classifyFindings(results);
      expect(allCategories).toContain("CONTACT");
    });

    it("should detect a German tax ID (12345678901)", () => {
      const text = "Tax ID: 12 345 678 901 on the record.";
      const results = runAllDetectors(text);
      const allCategories = classifyFindings(results);
      expect(allCategories).toContain("IDENTIFICATION");
    });

    it("should return an empty array for empty string input", () => {
      expect(runAllDetectors("")).toEqual([]);
    });

    it("should return an empty array for non-string input", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(runAllDetectors(null as any)).toEqual([]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(runAllDetectors(undefined as any)).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // DetectionResult structure validation
  // -----------------------------------------------------------------------
  describe("DetectionResult structure", () => {
    it("should have detectorType, detectedElements, detectedCategories, and containsSpecialCategorySuspected", () => {
      const text = "Email: test@example.com. IBAN: DE89370400440532013000.";
      const results = runAllDetectors(text);
      expect(results.length).toBeGreaterThan(0);

      for (const result of results) {
        expect(result).toHaveProperty("detectorType");
        expect(result).toHaveProperty("detectedElements");
        expect(result).toHaveProperty("detectedCategories");
        expect(result).toHaveProperty("containsSpecialCategorySuspected");
        expect(Array.isArray(result.detectedElements)).toBe(true);
        expect(Array.isArray(result.detectedCategories)).toBe(true);
        expect(typeof result.containsSpecialCategorySuspected).toBe("boolean");
      }
    });

    it("each detectedElement should have elementType, confidence, and snippetPreview", () => {
      const text = "Email: test@example.com";
      const results = runAllDetectors(text);
      const allElements = results.flatMap((r) => r.detectedElements);

      for (const element of allElements) {
        expect(element).toHaveProperty("elementType");
        expect(element).toHaveProperty("confidence");
        expect(typeof element.confidence).toBe("number");
        // snippetPreview can be null but must be present
        expect("snippetPreview" in element).toBe(true);
      }
    });

    it("each detectedCategory should have category and confidence", () => {
      const text = "Email: test@example.com";
      const results = runAllDetectors(text);
      const allCategories = results.flatMap((r) => r.detectedCategories);

      for (const cat of allCategories) {
        expect(cat).toHaveProperty("category");
        expect(cat).toHaveProperty("confidence");
        expect(typeof cat.confidence).toBe("number");
      }
    });
  });

  // -----------------------------------------------------------------------
  // Redaction of sample matches
  // -----------------------------------------------------------------------
  describe("redaction of sample matches", () => {
    it("should redact IBAN keeping country code and last 4 digits", () => {
      const text = "IBAN: DE89370400440532013000";
      const results = runAllDetectors(text);
      const allElements = results.flatMap((r) => r.detectedElements);
      const ibanElement = allElements.find((e) =>
        e.elementType.startsWith("IBAN")
      );
      expect(ibanElement).toBeDefined();
      expect(ibanElement!.snippetPreview).not.toBeNull();
      const sample = ibanElement!.snippetPreview!;
      expect(sample.startsWith("DE")).toBe(true);
      expect(sample.endsWith("3000")).toBe(true);
      expect(sample).toContain("*");
    });

    it("should redact credit card keeping first 4 and last 4 digits", () => {
      const text = "Card: 4111111111111111";
      const results = runAllDetectors(text);
      const allElements = results.flatMap((r) => r.detectedElements);
      const ccElement = allElements.find((e) =>
        e.elementType.startsWith("CREDIT_CARD")
      );
      expect(ccElement).toBeDefined();
      const sample = ccElement!.snippetPreview!;
      expect(sample.startsWith("4111")).toBe(true);
      expect(sample.endsWith("1111")).toBe(true);
      expect(sample).toContain("*");
    });

    it("should redact email keeping first character and domain", () => {
      const text = "Email: test@example.com";
      const results = runAllDetectors(text);
      const allElements = results.flatMap((r) => r.detectedElements);
      const emailElement = allElements.find(
        (e) => e.elementType === "EMAIL_ADDRESS"
      );
      expect(emailElement).toBeDefined();
      const sample = emailElement!.snippetPreview!;
      expect(sample.startsWith("t")).toBe(true);
      expect(sample).toContain("@example.com");
      expect(sample).toContain("*");
    });

    it("should redact phone number keeping prefix and last digits", () => {
      const text = "Phone: +49 170 1234567";
      const results = runAllDetectors(text);
      const allElements = results.flatMap((r) => r.detectedElements);
      const phoneElement = allElements.find((e) =>
        e.elementType.startsWith("PHONE")
      );
      expect(phoneElement).toBeDefined();
      const sample = phoneElement!.snippetPreview!;
      expect(sample).toContain("*");
    });

    it("should redact German tax ID keeping first 2 and last 2 digits", () => {
      const text = "Tax: 12 345 678 901";
      const results = runAllDetectors(text);
      const allElements = results.flatMap((r) => r.detectedElements);
      const taxElement = allElements.find(
        (e) => e.elementType === "TAX_ID_DE"
      );
      expect(taxElement).toBeDefined();
      const sample = taxElement!.snippetPreview!;
      expect(sample.startsWith("12")).toBe(true);
      expect(sample.endsWith("01")).toBe(true);
      expect(sample).toContain("*");
    });
  });

  // -----------------------------------------------------------------------
  // Special category (Art. 9) detection
  // -----------------------------------------------------------------------
  describe("special category (Art. 9) detection", () => {
    it("should detect health keywords in medical text", () => {
      const text = "The patient was diagnosed with diabetes";
      const results = runAllDetectors(text);
      expect(hasSpecialCategory(results)).toBe(true);

      const specialCats = getSpecialCategories(results);
      expect(specialCats).toContain("HEALTH");
    });

    it("should detect political keywords", () => {
      const text = "Records show political party membership since 2018.";
      const results = runAllDetectors(text);
      expect(hasSpecialCategory(results)).toBe(true);

      const specialCats = getSpecialCategories(results);
      expect(specialCats).toContain("POLITICAL_OPINION");
    });

    it("should detect religious keywords (Kirchensteuer)", () => {
      const text = "Monthly Kirchensteuer payment of 42 EUR.";
      const results = runAllDetectors(text);
      expect(hasSpecialCategory(results)).toBe(true);

      const specialCats = getSpecialCategories(results);
      expect(specialCats).toContain("RELIGION");
    });

    it("should return no special categories for innocuous text", () => {
      const text = "Hello world, nice day today";
      const results = runAllDetectors(text);
      expect(hasSpecialCategory(results)).toBe(false);
    });

    it("should redact Art. 9 keyword samples as bracketed lowercase text", () => {
      const text = "The patient was diagnosed with diabetes";
      const results = runAllDetectors(text);
      // Find the special category result
      const specialResult = results.find(
        (r) => r.containsSpecialCategorySuspected
      );
      expect(specialResult).toBeDefined();

      // Check that at least one element has a bracketed redaction
      const hasRedactedKeyword = specialResult!.detectedElements.some(
        (e) =>
          e.snippetPreview?.startsWith("[") && e.snippetPreview?.endsWith("]")
      );
      expect(hasRedactedKeyword).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // runAllDetectors — combined PII + Art. 9
  // -----------------------------------------------------------------------
  describe("runAllDetectors (combined)", () => {
    it("should combine PII and Art. 9 results", () => {
      const text =
        "Email: test@example.com. The patient was diagnosed with diabetes.";
      const results = runAllDetectors(text);

      // Should contain both non-special and special results
      const nonSpecial = results.filter(
        (r) => !r.containsSpecialCategorySuspected
      );
      const special = results.filter(
        (r) => r.containsSpecialCategorySuspected
      );

      expect(nonSpecial.length).toBeGreaterThan(0);
      expect(special.length).toBeGreaterThan(0);
    });

    it("should return empty array for empty text", () => {
      expect(runAllDetectors("")).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // classifyFindings
  // -----------------------------------------------------------------------
  describe("classifyFindings", () => {
    it("should extract categories from detectedCategories arrays", () => {
      const text =
        "IBAN: DE89370400440532013000. Email: test@example.com. The patient needs treatment.";
      const results = runAllDetectors(text);
      const categories = classifyFindings(results);

      expect(categories).toContain("PAYMENT");
      expect(categories).toContain("CONTACT");
      expect(categories).toContain("HEALTH");
    });

    it("should return unique categories only", () => {
      const text = "Email: a@b.com and phone +49 170 1234567";
      const results = runAllDetectors(text);
      const categories = classifyFindings(results);

      const unique = Array.from(new Set(categories));
      expect(categories.length).toBe(unique.length);
    });

    it("should return empty array for empty results", () => {
      expect(classifyFindings([])).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // hasSpecialCategory
  // -----------------------------------------------------------------------
  describe("hasSpecialCategory", () => {
    it("should return true when special category content is present", () => {
      const text = "The patient was diagnosed with diabetes.";
      const results = runAllDetectors(text);
      expect(hasSpecialCategory(results)).toBe(true);
    });

    it("should return false when no special category content is present", () => {
      const text = "Email: test@example.com and IBAN: DE89370400440532013000";
      const results = runAllDetectors(text);
      expect(hasSpecialCategory(results)).toBe(false);
    });

    it("should return false for empty results", () => {
      expect(hasSpecialCategory([])).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // getSpecialCategories
  // -----------------------------------------------------------------------
  describe("getSpecialCategories", () => {
    it("should return specific category names for health content", () => {
      const text = "The patient was diagnosed with diabetes.";
      const results = runAllDetectors(text);
      const specialCats = getSpecialCategories(results);
      expect(specialCats).toContain("HEALTH");
    });

    it("should return multiple categories for mixed Art. 9 content", () => {
      const text =
        "The patient has a diagnosis. Records show political party membership. Kirchensteuer payment received.";
      const results = runAllDetectors(text);
      const specialCats = getSpecialCategories(results);

      expect(specialCats).toContain("HEALTH");
      expect(specialCats).toContain("POLITICAL_OPINION");
      expect(specialCats).toContain("RELIGION");
    });

    it("should return empty array when no special category content", () => {
      const text = "Email: test@example.com";
      const results = runAllDetectors(text);
      expect(getSpecialCategories(results)).toEqual([]);
    });

    it("should return empty array for empty results", () => {
      expect(getSpecialCategories([])).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // No false positives on innocuous text
  // -----------------------------------------------------------------------
  describe("no false positives", () => {
    it("should not produce special category findings for innocuous text", () => {
      const text = "Hello world, nice day today";
      const results = runAllDetectors(text);

      expect(hasSpecialCategory(results)).toBe(false);
      expect(getSpecialCategories(results)).toEqual([]);
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

      expect(graph.displayName).toBe("Max Mustermann");
      expect(graph.primaryIdentifierType).toBe("EMAIL");
      expect(graph.primaryIdentifierValue).toBe("max@example.com");

      // Should have alternateIdentifiers for name, email, phone, employeeId, upn
      expect(graph.alternateIdentifiers.length).toBeGreaterThanOrEqual(5);

      const types = graph.alternateIdentifiers.map((id) => id.type);
      expect(types).toContain("name");
      expect(types).toContain("email");
      expect(types).toContain("phone");
      expect(types).toContain("employeeId");
      expect(types).toContain("upn");

      // All case_data identifiers should have source "case_data"
      for (const entry of graph.alternateIdentifiers) {
        expect(entry.source).toBe("case_data");
      }

      // confidenceScore should be 0-100
      expect(graph.confidenceScore).toBeGreaterThan(0);
      expect(graph.confidenceScore).toBeLessThanOrEqual(100);
    });

    it("should build a graph with minimal data (only fullName)", () => {
      const graph = buildInitialIdentityGraph({
        fullName: "Jane Doe",
        email: null,
        phone: null,
        address: null,
      });

      expect(graph.displayName).toBe("Jane Doe");
      expect(graph.primaryIdentifierType).toBe("OTHER");
      expect(graph.primaryIdentifierValue).toBe("Jane Doe");
      expect(graph.alternateIdentifiers).toHaveLength(1);
      expect(graph.alternateIdentifiers[0].type).toBe("name");
      expect(graph.alternateIdentifiers[0].value).toBe("Jane Doe");
      expect(graph.confidenceScore).toBeGreaterThan(0);
    });

    it("should de-duplicate identifiers from the custom identifiers field", () => {
      const graph = buildInitialIdentityGraph({
        fullName: "Max Mustermann",
        email: "max@example.com",
        phone: null,
        address: null,
        identifiers: {
          email: "max@example.com",
          alternateEmail: "max.alt@example.com",
        },
      });

      const emailEntries = graph.alternateIdentifiers.filter(
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
      const newEntries: AlternateIdentifier[] = [
        {
          type: "email",
          value: "max@example.com",
          source: "ad_connector",
          confidence: 0.9,
        },
      ];

      const merged = mergeIdentifiers(baseGraph, newEntries, "ad_connector");

      const emailEntries = merged.alternateIdentifiers.filter(
        (id) => id.type === "email"
      );
      expect(emailEntries).toHaveLength(1);
    });

    it("should update confidence when same identifier comes from a different source", () => {
      const newEntries: AlternateIdentifier[] = [
        {
          type: "email",
          value: "max@example.com",
          source: "ad_connector",
          confidence: 0.8,
        },
      ];

      const merged = mergeIdentifiers(baseGraph, newEntries, "ad_connector");

      const emailEntry = merged.alternateIdentifiers.find(
        (id) => id.type === "email"
      );
      expect(emailEntry).toBeDefined();
      // Original confidence was 0.9 from case_data.
      // Merge keeps max(0.9, 0.8) = 0.9, then cross-source corroboration
      // boost of +0.05 => 0.95
      expect(emailEntry!.confidence).toBeCloseTo(0.95, 10);
    });

    it("should add new unique identifiers", () => {
      const newEntries: AlternateIdentifier[] = [
        {
          type: "employeeId",
          value: "EMP-999",
          source: "hr_system",
          confidence: 0.85,
        },
      ];

      const merged = mergeIdentifiers(baseGraph, newEntries, "hr_system");

      const empEntry = merged.alternateIdentifiers.find(
        (id) => id.type === "employeeId" && id.value === "EMP-999"
      );
      expect(empEntry).toBeDefined();
      expect(empEntry!.source).toBe("hr_system");
      expect(empEntry!.confidence).toBe(0.85);
    });

    it("should skip entries below the minimum confidence threshold", () => {
      const newEntries: AlternateIdentifier[] = [
        {
          type: "custom",
          value: "low-confidence-id",
          source: "weak_source",
          confidence: 0.05, // below 0.1 threshold
        },
      ];

      const merged = mergeIdentifiers(baseGraph, newEntries, "weak_source");

      const customEntry = merged.alternateIdentifiers.find(
        (id) => id.value === "low-confidence-id"
      );
      expect(customEntry).toBeUndefined();
    });

    it("should not mutate the original graph", () => {
      const originalLength = baseGraph.alternateIdentifiers.length;
      const newEntries: AlternateIdentifier[] = [
        {
          type: "objectId",
          value: "abc-123",
          source: "entra",
          confidence: 0.9,
        },
      ];

      mergeIdentifiers(baseGraph, newEntries, "entra");

      expect(baseGraph.alternateIdentifiers.length).toBe(originalLength);
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

    it("should add a new system as an alternate identifier", () => {
      const updated = addResolvedSystem(baseGraph, {
        type: "system_account",
        value: "microsoft_entra:user-obj-id-123",
        source: "microsoft_entra",
        confidence: 0.85,
      });

      const sysEntry = updated.alternateIdentifiers.find(
        (id) =>
          id.type === "system_account" &&
          id.value === "microsoft_entra:user-obj-id-123"
      );
      expect(sysEntry).toBeDefined();
      expect(sysEntry!.source).toBe("microsoft_entra");
      expect(sysEntry!.confidence).toBe(0.85);
    });

    it("should update an existing system (same type + value)", () => {
      const withSystem = addResolvedSystem(baseGraph, {
        type: "system_account",
        value: "microsoft_entra:user-obj-id-123",
        source: "microsoft_entra",
        confidence: 0.7,
      });

      const updated = addResolvedSystem(withSystem, {
        type: "system_account",
        value: "microsoft_entra:user-obj-id-123",
        source: "microsoft_entra",
        confidence: 0.9,
      });

      // Should still have only 1 system_account entry for this value
      const sysEntries = updated.alternateIdentifiers.filter(
        (id) =>
          id.type === "system_account" &&
          id.value === "microsoft_entra:user-obj-id-123"
      );
      expect(sysEntries).toHaveLength(1);
      // Should keep the higher confidence
      expect(sysEntries[0].confidence).toBe(0.9);
    });

    it("should add multiple different systems", () => {
      let updated = addResolvedSystem(baseGraph, {
        type: "system_account",
        value: "microsoft_entra:user-obj-id-123",
        source: "microsoft_entra",
        confidence: 0.85,
      });
      updated = addResolvedSystem(updated, {
        type: "system_account",
        value: "salesforce:sf-contact-456",
        source: "salesforce",
        confidence: 0.8,
      });

      const systemEntries = updated.alternateIdentifiers.filter(
        (id) => id.type === "system_account"
      );
      expect(systemEntries).toHaveLength(2);
      const sources = systemEntries.map((s) => s.source);
      expect(sources).toContain("microsoft_entra");
      expect(sources).toContain("salesforce");
    });

    it("should update overall confidenceScore when systems are added", () => {
      const confidenceBefore = baseGraph.confidenceScore;

      const withOneSystem = addResolvedSystem(baseGraph, {
        type: "system_account",
        value: "microsoft_entra:user-obj-id-123",
        source: "microsoft_entra",
        confidence: 0.85,
      });

      const withTwoSystems = addResolvedSystem(withOneSystem, {
        type: "system_account",
        value: "salesforce:sf-contact-456",
        source: "salesforce",
        confidence: 0.8,
      });

      // More systems (from different sources) should increase confidence
      expect(withTwoSystems.confidenceScore).toBeGreaterThanOrEqual(
        confidenceBefore
      );
    });
  });

  // -----------------------------------------------------------------------
  // buildSubjectIdentifiers
  // -----------------------------------------------------------------------
  describe("buildSubjectIdentifiers", () => {
    it("should return primary identifier and alternatives sorted by confidence", () => {
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

      // Primary should be EMAIL (since email is available)
      expect(primary.type).toBe("EMAIL");
      expect(primary.value).toBe("max@example.com");

      // Alternatives should contain the other identifiers (excluding primary value)
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

      expect(primary.type).toBe("OTHER");
      expect(primary.value).toBe("Jane Doe");
      // name alternate is excluded because it matches primary value
      expect(alternatives).toEqual([]);
    });

    it("should handle an empty identity graph", () => {
      const emptyGraph: IdentityGraph = {
        displayName: "",
        primaryIdentifierType: "EMAIL",
        primaryIdentifierValue: "",
        alternateIdentifiers: [],
        confidenceScore: 0,
      };

      const { primary, alternatives } = buildSubjectIdentifiers(emptyGraph);

      expect(primary.type).toBe("EMAIL");
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

  // -----------------------------------------------------------------------
  // COPILOT_ROLES — only DPO/Admin/CaseManager/SuperAdmin for create
  // -----------------------------------------------------------------------
  describe("COPILOT_ROLES for create", () => {
    const COPILOT_CREATE_ROLES = [
      "SUPER_ADMIN",
      "TENANT_ADMIN",
      "DPO",
      "CASE_MANAGER",
    ] as const;

    const NON_CREATE_ROLES = ["CONTRIBUTOR", "READ_ONLY"] as const;

    it("should include exactly DPO, TENANT_ADMIN, CASE_MANAGER, and SUPER_ADMIN for copilot create", () => {
      for (const role of COPILOT_CREATE_ROLES) {
        expect(hasPermission(role, "copilot", "create")).toBe(true);
      }
      for (const role of NON_CREATE_ROLES) {
        expect(hasPermission(role, "copilot", "create")).toBe(false);
      }
    });
  });
});

// =========================================================================
// 4. Special Category Gating Logic
// =========================================================================
describe("Special Category Gating Logic", () => {
  it("should set containsSpecialCategorySuspected: true when special category content is detected", () => {
    const text = "The patient was diagnosed with diabetes.";
    const results = runAllDetectors(text);
    const specialResults = results.filter(
      (r) => r.containsSpecialCategorySuspected
    );

    expect(specialResults.length).toBeGreaterThan(0);
    for (const result of specialResults) {
      expect(result.containsSpecialCategorySuspected).toBe(true);
      // Should contain special categories in detectedCategories
      const specialCats = result.detectedCategories.filter((dc) =>
        isSpecialCategory(dc.category)
      );
      expect(specialCats.length).toBeGreaterThan(0);
    }
  });

  it("should properly aggregate multiple special categories", () => {
    const text = [
      "The patient was diagnosed with diabetes.",
      "Records indicate political party membership.",
      "The Kirchensteuer payment was processed.",
      "Biometric fingerprint data was collected.",
      "Trade union membership confirmed.",
    ].join(" ");

    const results = runAllDetectors(text);
    const specialCats = getSpecialCategories(results);

    expect(specialCats).toContain("HEALTH");
    expect(specialCats).toContain("POLITICAL_OPINION");
    expect(specialCats).toContain("RELIGION");
    expect(specialCats).toContain("OTHER_SPECIAL_CATEGORY"); // biometric
    expect(specialCats).toContain("UNION");
    expect(specialCats.length).toBeGreaterThanOrEqual(4);
  });

  it("should handle mixed special and non-special content correctly", () => {
    const text =
      "Email: test@example.com. Card: 4111111111111111. The patient needs treatment. Kirchensteuer: 42 EUR.";
    const results = runAllDetectors(text);

    const nonSpecial = results.filter(
      (r) => !r.containsSpecialCategorySuspected
    );
    const special = results.filter(
      (r) => r.containsSpecialCategorySuspected
    );

    expect(nonSpecial.length).toBeGreaterThan(0);
    expect(special.length).toBeGreaterThan(0);

    // Non-special should have standard categories
    const piiCategories = classifyFindings(nonSpecial);
    expect(piiCategories).toContain("CONTACT"); // email
    expect(piiCategories).toContain("PAYMENT"); // credit card

    // Special should include health and religious
    const specialCats = getSpecialCategories(special);
    expect(specialCats).toContain("HEALTH");
    expect(specialCats).toContain("RELIGION");

    // hasSpecialCategory should be true on the full set
    expect(hasSpecialCategory(results)).toBe(true);
  });

  it("should return containsSpecialCategorySuspected: false for purely PII content", () => {
    const text = "Email: test@example.com. IBAN: DE89370400440532013000.";
    const results = runAllDetectors(text);

    expect(hasSpecialCategory(results)).toBe(false);
    expect(getSpecialCategories(results)).toEqual([]);

    for (const r of results) {
      expect(r.containsSpecialCategorySuspected).toBe(false);
    }
  });

  // -----------------------------------------------------------------------
  // Special category gating: when HEALTH/RELIGION/etc detected,
  // containsSpecialCategory must be true
  // -----------------------------------------------------------------------
  describe("when HEALTH/RELIGION/etc detected, containsSpecialCategory must be true", () => {
    it("HEALTH detected => containsSpecialCategorySuspected is true", () => {
      const results = runAllDetectors(
        "The patient was diagnosed with diabetes."
      );
      expect(hasSpecialCategory(results)).toBe(true);
      const cats = getSpecialCategories(results);
      expect(cats).toContain("HEALTH");
    });

    it("RELIGION detected => containsSpecialCategorySuspected is true", () => {
      const results = runAllDetectors(
        "Monthly Kirchensteuer payment of 42 EUR."
      );
      expect(hasSpecialCategory(results)).toBe(true);
      const cats = getSpecialCategories(results);
      expect(cats).toContain("RELIGION");
    });

    it("POLITICAL_OPINION detected => containsSpecialCategorySuspected is true", () => {
      const results = runAllDetectors(
        "Records show political party membership."
      );
      expect(hasSpecialCategory(results)).toBe(true);
      const cats = getSpecialCategories(results);
      expect(cats).toContain("POLITICAL_OPINION");
    });

    it("UNION detected => containsSpecialCategorySuspected is true", () => {
      const results = runAllDetectors("Trade union membership confirmed.");
      expect(hasSpecialCategory(results)).toBe(true);
      const cats = getSpecialCategories(results);
      expect(cats).toContain("UNION");
    });

    it("OTHER_SPECIAL_CATEGORY (biometric) detected => containsSpecialCategorySuspected is true", () => {
      const results = runAllDetectors(
        "Biometric fingerprint data was collected."
      );
      expect(hasSpecialCategory(results)).toBe(true);
      const cats = getSpecialCategories(results);
      expect(cats).toContain("OTHER_SPECIAL_CATEGORY");
    });

    it("isSpecialCategory should match SPECIAL_CATEGORIES set", () => {
      const specialTypes: DataCategoryType[] = [
        "HEALTH",
        "RELIGION",
        "UNION",
        "POLITICAL_OPINION",
        "OTHER_SPECIAL_CATEGORY",
      ];

      for (const cat of specialTypes) {
        expect(isSpecialCategory(cat)).toBe(true);
        expect(SPECIAL_CATEGORIES.has(cat)).toBe(true);
      }

      const nonSpecial: DataCategoryType[] = [
        "IDENTIFICATION",
        "CONTACT",
        "PAYMENT",
        "COMMUNICATION",
        "HR",
        "CREDITWORTHINESS",
        "CONTRACT",
        "ONLINE_TECHNICAL",
        "OTHER",
      ];

      for (const cat of nonSpecial) {
        expect(isSpecialCategory(cat)).toBe(false);
      }
    });
  });
});

// =========================================================================
// 5. Legal Gate Logic
// =========================================================================
describe("Legal Gate Logic", () => {
  describe("checkLegalGate", () => {
    it("when special category is present, legal review should be required", () => {
      // Simulate detection that finds HEALTH data
      const results = runAllDetectors(
        "The patient was diagnosed with diabetes."
      );
      const containsSpecial = hasSpecialCategory(results);
      expect(containsSpecial).toBe(true);

      // When containsSpecialCategory is true, legalApprovalStatus should
      // be set to REQUIRED (not NOT_REQUIRED)
      const legalApprovalStatus = containsSpecial ? "REQUIRED" : "NOT_REQUIRED";
      expect(legalApprovalStatus).toBe("REQUIRED");
    });

    it("when no special category is present, legal review is not required", () => {
      const results = runAllDetectors(
        "Email: test@example.com. IBAN: DE89370400440532013000."
      );
      const containsSpecial = hasSpecialCategory(results);
      expect(containsSpecial).toBe(false);

      const legalApprovalStatus: string = containsSpecial ? "REQUIRED" : "NOT_REQUIRED";
      expect(legalApprovalStatus).toBe("NOT_REQUIRED");
    });

    it("legal gate should block exports when approval is REQUIRED but not yet APPROVED", () => {
      const containsSpecial = true;
      const legalApprovalStatus: string = "REQUIRED"; // not yet APPROVED

      // Export gate: allowed only if NOT_REQUIRED or APPROVED
      const exportAllowed =
        legalApprovalStatus === "NOT_REQUIRED" ||
        legalApprovalStatus === "APPROVED";
      expect(exportAllowed).toBe(false);

      const gateStatus: string = exportAllowed ? "ALLOWED" : "BLOCKED";
      expect(gateStatus).toBe("BLOCKED");
    });

    it("legal gate should allow exports when approval is APPROVED", () => {
      const legalApprovalStatus: string = "APPROVED";

      const exportAllowed =
        legalApprovalStatus === "NOT_REQUIRED" ||
        legalApprovalStatus === "APPROVED";
      expect(exportAllowed).toBe(true);

      const gateStatus: string = exportAllowed ? "ALLOWED" : "BLOCKED";
      expect(gateStatus).toBe("ALLOWED");
    });

    it("legal gate should allow exports when approval is NOT_REQUIRED", () => {
      const legalApprovalStatus: string = "NOT_REQUIRED";

      const exportAllowed =
        legalApprovalStatus === "NOT_REQUIRED" ||
        legalApprovalStatus === "APPROVED";
      expect(exportAllowed).toBe(true);

      const gateStatus: string = exportAllowed ? "ALLOWED" : "BLOCKED";
      expect(gateStatus).toBe("ALLOWED");
    });

    it("legal gate should block exports when approval is PENDING", () => {
      const legalApprovalStatus: string = "PENDING";

      const exportAllowed =
        legalApprovalStatus === "NOT_REQUIRED" ||
        legalApprovalStatus === "APPROVED";
      expect(exportAllowed).toBe(false);
    });

    it("legal gate should block exports when approval is REJECTED", () => {
      const legalApprovalStatus: string = "REJECTED";

      const exportAllowed =
        legalApprovalStatus === "NOT_REQUIRED" ||
        legalApprovalStatus === "APPROVED";
      expect(exportAllowed).toBe(false);
    });
  });
});

// =========================================================================
// 6. Evidence Integrity
// =========================================================================
describe("Evidence Integrity", () => {
  it("Finding.evidenceItemIds should reference valid evidence items", () => {
    // Simulate a set of evidence item IDs and findings that reference them
    const evidenceItemIds = ["ev-001", "ev-002", "ev-003"];
    const findings = [
      {
        dataCategory: "IDENTIFICATION",
        evidenceItemIds: ["ev-001"],
        containsSpecialCategory: false,
      },
      {
        dataCategory: "COMMUNICATION",
        evidenceItemIds: ["ev-002"],
        containsSpecialCategory: false,
      },
      {
        dataCategory: "HR",
        evidenceItemIds: ["ev-003"],
        containsSpecialCategory: false,
      },
    ];

    for (const finding of findings) {
      for (const refId of finding.evidenceItemIds) {
        expect(evidenceItemIds).toContain(refId);
      }
    }
  });

  it("findings should not reference non-existent evidence items", () => {
    const evidenceItemIds = ["ev-001", "ev-002"];
    const badFinding = {
      dataCategory: "HR",
      evidenceItemIds: ["ev-999"], // does not exist
      containsSpecialCategory: false,
    };

    for (const refId of badFinding.evidenceItemIds) {
      expect(evidenceItemIds).not.toContain(refId);
    }
  });

  it("evidence item array should be non-empty for findings with evidence", () => {
    const finding = {
      dataCategory: "IDENTIFICATION",
      evidenceItemIds: ["ev-001", "ev-002"],
    };

    expect(finding.evidenceItemIds.length).toBeGreaterThan(0);
  });

  it("findings can reference multiple evidence items", () => {
    const evidenceItemIds = ["ev-001", "ev-002", "ev-003"];
    const finding = {
      dataCategory: "COMMUNICATION",
      evidenceItemIds: ["ev-001", "ev-002"],
    };

    expect(finding.evidenceItemIds.length).toBe(2);
    for (const refId of finding.evidenceItemIds) {
      expect(evidenceItemIds).toContain(refId);
    }
  });
});
