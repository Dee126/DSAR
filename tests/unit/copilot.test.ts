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
  validateIBAN,
  validateLuhn,
  maskPII,
  toConfidenceLevel,
  runDetectionPipeline,
  runMetadataClassification,
  runRegexDetection,
  runPdfMetadataDetection,
  detectThirdPartyData,
  mapElementToCategory,
  generateEvidenceIndexCSV,
  generateFindingsSummaryJSON,
  MAX_TEXT_SCAN_LENGTH,
  MAX_ITEMS_PER_RUN,
} from "@/lib/copilot/detection";
import type {
  DetectionResult,
  DataCategoryType,
  ConfidenceLevel,
  DetectionInput,
  DetectionPipelineConfig,
} from "@/lib/copilot/detection";

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
// 1. Detection Service — Legacy API (runAllDetectors)
// =========================================================================
describe("Detection Service", () => {
  describe("runAllDetectors (PII)", () => {
    it("should detect a German IBAN (DE89370400440532013000)", () => {
      const text = "Please transfer to DE89370400440532013000 immediately.";
      const results = runAllDetectors(text);
      expect(results.length).toBeGreaterThan(0);
      const allCategories = classifyFindings(results);
      expect(allCategories).toContain("PAYMENT");

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
    it("should have all required fields including confidenceLevel", () => {
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

    it("each detectedElement should have elementType, confidence, confidenceLevel, and snippetPreview", () => {
      const text = "Email: test@example.com";
      const results = runAllDetectors(text);
      const allElements = results.flatMap((r) => r.detectedElements);

      for (const element of allElements) {
        expect(element).toHaveProperty("elementType");
        expect(element).toHaveProperty("confidence");
        expect(element).toHaveProperty("confidenceLevel");
        expect(typeof element.confidence).toBe("number");
        expect(["HIGH", "MEDIUM", "LOW"]).toContain(element.confidenceLevel);
        expect("snippetPreview" in element).toBe(true);
      }
    });

    it("each detectedCategory should have category, confidence, and confidenceLevel", () => {
      const text = "Email: test@example.com";
      const results = runAllDetectors(text);
      const allCategories = results.flatMap((r) => r.detectedCategories);

      for (const cat of allCategories) {
        expect(cat).toHaveProperty("category");
        expect(cat).toHaveProperty("confidence");
        expect(cat).toHaveProperty("confidenceLevel");
        expect(typeof cat.confidence).toBe("number");
        expect(["HIGH", "MEDIUM", "LOW"]).toContain(cat.confidenceLevel);
      }
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
      const specialResult = results.find(
        (r) => r.containsSpecialCategorySuspected
      );
      expect(specialResult).toBeDefined();
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
  // No false positives
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
// 2. IBAN Checksum Validation
// =========================================================================
describe("IBAN Validation (Mod 97-10)", () => {
  it("should validate a correct German IBAN", () => {
    expect(validateIBAN("DE89370400440532013000")).toBe(true);
  });

  it("should validate a correct German IBAN with spaces", () => {
    expect(validateIBAN("DE89 3704 0044 0532 0130 00")).toBe(true);
  });

  it("should reject an incorrect German IBAN (wrong check digits)", () => {
    expect(validateIBAN("DE00370400440532013000")).toBe(false);
  });

  it("should validate a correct Austrian IBAN", () => {
    expect(validateIBAN("AT611904300234573201")).toBe(true);
  });

  it("should validate a correct GB IBAN", () => {
    expect(validateIBAN("GB29NWBK60161331926819")).toBe(true);
  });

  it("should reject too-short input", () => {
    expect(validateIBAN("DE89")).toBe(false);
  });

  it("should reject non-IBAN strings", () => {
    expect(validateIBAN("NOT_AN_IBAN")).toBe(false);
    expect(validateIBAN("")).toBe(false);
    expect(validateIBAN("12345678901234")).toBe(false);
  });

  it("should reject IBAN with invalid characters", () => {
    expect(validateIBAN("DE89!704$044#532&130(0")).toBe(false);
  });

  it("should be case-insensitive", () => {
    expect(validateIBAN("de89370400440532013000")).toBe(true);
  });
});

// =========================================================================
// 3. Luhn Credit Card Validation
// =========================================================================
describe("Luhn Validation (Credit Card)", () => {
  it("should validate a known-valid Visa card (4111111111111111)", () => {
    expect(validateLuhn("4111111111111111")).toBe(true);
  });

  it("should validate with spaces", () => {
    expect(validateLuhn("4111 1111 1111 1111")).toBe(true);
  });

  it("should validate with hyphens", () => {
    expect(validateLuhn("4111-1111-1111-1111")).toBe(true);
  });

  it("should validate a known-valid Mastercard (5500000000000004)", () => {
    expect(validateLuhn("5500000000000004")).toBe(true);
  });

  it("should validate a known-valid Amex (378282246310005)", () => {
    expect(validateLuhn("378282246310005")).toBe(true);
  });

  it("should reject an invalid card number (wrong digit)", () => {
    expect(validateLuhn("4111111111111112")).toBe(false);
  });

  it("should reject too-short numbers", () => {
    expect(validateLuhn("41111")).toBe(false);
  });

  it("should reject non-numeric input", () => {
    expect(validateLuhn("abcdefghijklmnop")).toBe(false);
    expect(validateLuhn("")).toBe(false);
  });

  it("should reject a random 16-digit number failing Luhn", () => {
    expect(validateLuhn("1234567890123456")).toBe(false);
  });
});

// =========================================================================
// 4. Central Masking Policy (maskPII)
// =========================================================================
describe("Central Masking Policy (maskPII)", () => {
  it("should mask email: keep first char + domain", () => {
    const masked = maskPII("test@example.com", "EMAIL");
    expect(masked.startsWith("t")).toBe(true);
    expect(masked).toContain("@example.com");
    expect(masked).toContain("*");
  });

  it("should mask phone: keep prefix + last 2", () => {
    const masked = maskPII("+49 170 1234567", "PHONE");
    expect(masked).toContain("*");
    expect(masked.length).toBeGreaterThan(4);
  });

  it("should mask address: keep first word + ***", () => {
    const masked = maskPII("Musterstrasse 1, 10115 Berlin", "ADDRESS");
    expect(masked.startsWith("Musterstrasse")).toBe(true);
    expect(masked).toContain("***");
  });

  it("should mask name: first initials + dots", () => {
    const masked = maskPII("Max Mustermann", "NAME");
    expect(masked).toBe("M. M.");
  });

  it("should mask IBAN: country code + **** + last 4", () => {
    const masked = maskPII("DE89370400440532013000", "IBAN");
    expect(masked.startsWith("DE")).toBe(true);
    expect(masked.endsWith("3000")).toBe(true);
    expect(masked).toContain("*");
  });

  it("should mask credit card: first 4 + **** + last 4", () => {
    const masked = maskPII("4111111111111111", "CREDIT_CARD");
    expect(masked.startsWith("4111")).toBe(true);
    expect(masked.endsWith("1111")).toBe(true);
    expect(masked).toContain("*");
  });

  it("should mask bank account: first 2 + **** + last 2", () => {
    const masked = maskPII("12345678901234", "BANK_ACCOUNT");
    expect(masked.startsWith("12")).toBe(true);
    expect(masked.endsWith("34")).toBe(true);
    expect(masked).toContain("*");
  });

  it("should mask customer number as CUST-****", () => {
    expect(maskPII("KNR-123456", "CUSTOMER_NUMBER")).toBe("CUST-****");
  });

  it("should mask tax ID: first 2 + **** + last 2", () => {
    const masked = maskPII("12345678901", "TAX_ID");
    expect(masked.startsWith("12")).toBe(true);
    expect(masked.endsWith("01")).toBe(true);
    expect(masked).toContain("*");
  });

  it("should mask ID document: first char + **** + last 2", () => {
    const masked = maskPII("C01X00T47", "ID_DOCUMENT");
    expect(masked.startsWith("C")).toBe(true);
    expect(masked.endsWith("47")).toBe(true);
    expect(masked).toContain("*");
  });

  it("should mask employee ID as EMP-****", () => {
    expect(maskPII("EMP-001234", "EMPLOYEE_ID")).toBe("EMP-****");
  });

  it("should mask IPv4 address: first octet + ***.***. + last octet", () => {
    const masked = maskPII("192.168.1.100", "IP_ADDRESS");
    expect(masked.startsWith("192")).toBe(true);
    expect(masked).toContain("***");
  });

  it("should mask device ID: first 4 + ****", () => {
    const masked = maskPII("a1b2c3d4e5f6", "DEVICE_ID");
    expect(masked.startsWith("a1b2")).toBe(true);
    expect(masked).toContain("*");
  });

  it("should mask keyword as bracketed lowercase", () => {
    expect(maskPII("Diagnosis", "KEYWORD")).toBe("[diagnosis]");
  });

  it("should handle empty input", () => {
    expect(maskPII("", "EMAIL")).toBe("***");
    expect(maskPII("  ", "PHONE")).toBe("***");
  });

  it("should fall back to default masking for unknown types", () => {
    const masked = maskPII("some_value_here", "UNKNOWN_TYPE");
    expect(masked).toContain("*");
    expect(masked.startsWith("so")).toBe(true);
    expect(masked.endsWith("re")).toBe(true);
  });
});

// =========================================================================
// 5. Confidence Scoring
// =========================================================================
describe("Confidence Scoring", () => {
  it("toConfidenceLevel: >= 0.85 should be HIGH", () => {
    expect(toConfidenceLevel(0.85)).toBe("HIGH");
    expect(toConfidenceLevel(0.95)).toBe("HIGH");
    expect(toConfidenceLevel(1.0)).toBe("HIGH");
  });

  it("toConfidenceLevel: 0.50 to 0.84 should be MEDIUM", () => {
    expect(toConfidenceLevel(0.50)).toBe("MEDIUM");
    expect(toConfidenceLevel(0.70)).toBe("MEDIUM");
    expect(toConfidenceLevel(0.84)).toBe("MEDIUM");
  });

  it("toConfidenceLevel: < 0.50 should be LOW", () => {
    expect(toConfidenceLevel(0.49)).toBe("LOW");
    expect(toConfidenceLevel(0.2)).toBe("LOW");
    expect(toConfidenceLevel(0.0)).toBe("LOW");
  });

  it("validated IBAN detections should have higher confidence", () => {
    const text = "IBAN: DE89370400440532013000";
    const results = runAllDetectors(text);
    const allElements = results.flatMap((r) => r.detectedElements);
    const ibanElement = allElements.find((e) =>
      e.elementType.startsWith("IBAN")
    );
    expect(ibanElement).toBeDefined();
    // Validated IBAN should have HIGH confidence (0.75 base + 0.05 count + 0.15 validation = 0.95)
    expect(ibanElement!.confidence).toBeGreaterThanOrEqual(0.85);
    expect(ibanElement!.confidenceLevel).toBe("HIGH");
    expect(ibanElement!.validated).toBe(true);
  });

  it("validated credit card should have HIGH confidence", () => {
    const text = "Card: 4111111111111111";
    const results = runAllDetectors(text);
    const allElements = results.flatMap((r) => r.detectedElements);
    const ccElement = allElements.find((e) =>
      e.elementType.startsWith("CREDIT_CARD")
    );
    expect(ccElement).toBeDefined();
    expect(ccElement!.confidence).toBeGreaterThanOrEqual(0.85);
    expect(ccElement!.confidenceLevel).toBe("HIGH");
    expect(ccElement!.validated).toBe(true);
  });

  it("keyword detections should have MEDIUM confidence", () => {
    const text = "The patient was diagnosed with diabetes.";
    const results = runAllDetectors(text);
    const specialResult = results.find(
      (r) => r.containsSpecialCategorySuspected
    );
    expect(specialResult).toBeDefined();
    const keywordElement = specialResult!.detectedElements[0];
    expect(keywordElement.confidenceLevel).toBe("MEDIUM");
  });
});

// =========================================================================
// 6. Detection Pipeline (5-step)
// =========================================================================
describe("Detection Pipeline", () => {
  describe("Step A: Metadata Classification", () => {
    it("should classify by file name (invoice -> PAYMENT)", () => {
      const result = runMetadataClassification({
        fileName: "invoice_2024_01.pdf",
      });
      expect(result).not.toBeNull();
      expect(result!.detectorType).toBe("METADATA");
      const categories = result!.detectedCategories.map((c) => c.category);
      expect(categories).toContain("PAYMENT");
    });

    it("should classify by file name (medical -> HEALTH)", () => {
      const result = runMetadataClassification({
        fileName: "medical_report.pdf",
      });
      expect(result).not.toBeNull();
      const categories = result!.detectedCategories.map((c) => c.category);
      expect(categories).toContain("HEALTH");
      expect(result!.containsSpecialCategorySuspected).toBe(true);
    });

    it("should classify by MIME type (pdf -> COMMUNICATION)", () => {
      const result = runMetadataClassification({
        mimeType: "application/pdf",
      });
      expect(result).not.toBeNull();
      const categories = result!.detectedCategories.map((c) => c.category);
      expect(categories).toContain("COMMUNICATION");
    });

    it("should classify by provider (WORKDAY -> HR)", () => {
      const result = runMetadataClassification({
        provider: "WORKDAY",
      });
      expect(result).not.toBeNull();
      const categories = result!.detectedCategories.map((c) => c.category);
      expect(categories).toContain("HR");
    });

    it("should return null for items with no classifiable metadata", () => {
      const result = runMetadataClassification({});
      expect(result).toBeNull();
    });
  });

  describe("Step B: RegEx Detection", () => {
    it("should detect PII in text content", () => {
      const results = runRegexDetection("Email: test@example.com, IBAN: DE89370400440532013000");
      expect(results.length).toBeGreaterThan(0);
      const allCats = results.flatMap((r) => r.detectedCategories.map((c) => c.category));
      expect(allCats).toContain("CONTACT");
      expect(allCats).toContain("PAYMENT");
    });

    it("should enforce text length limit", () => {
      // Create text longer than MAX_TEXT_SCAN_LENGTH
      const longText = "x".repeat(MAX_TEXT_SCAN_LENGTH + 1000) + " test@example.com";
      // The email at the end should be beyond the scan limit and not detected
      const results = runRegexDetection(longText);
      const allElements = results.flatMap((r) => r.detectedElements);
      const emailElement = allElements.find((e) => e.elementType === "EMAIL_ADDRESS");
      expect(emailElement).toBeUndefined();
    });

    it("should respect custom max length", () => {
      const text = "Email: test@example.com. More text here.";
      const results = runRegexDetection(text, 10); // Only scan first 10 chars
      const allElements = results.flatMap((r) => r.detectedElements);
      const emailElement = allElements.find((e) => e.elementType === "EMAIL_ADDRESS");
      expect(emailElement).toBeUndefined();
    });
  });

  describe("Full Pipeline (runDetectionPipeline)", () => {
    it("should run metadata-only by default", () => {
      const input: DetectionInput = {
        fileName: "invoice_2024.pdf",
        text: "Email: test@example.com",
      };
      const result = runDetectionPipeline(input);
      expect(result.contentHandlingApplied).toBe("METADATA_ONLY");
      // Should NOT detect the email (content scanning disabled)
      const emailElements = result.results.flatMap((r) =>
        r.detectedElements.filter((e) => e.elementType === "EMAIL_ADDRESS")
      );
      expect(emailElements).toHaveLength(0);
      // Should detect via metadata (invoice -> PAYMENT)
      expect(result.allCategories).toContain("PAYMENT");
    });

    it("should run regex detection with CONTENT_SCAN mode", () => {
      const input: DetectionInput = {
        text: "Email: test@example.com. The patient was diagnosed.",
        fileName: "data.txt",
      };
      const config: DetectionPipelineConfig = {
        contentHandling: "CONTENT_SCAN",
      };
      const result = runDetectionPipeline(input, config);
      expect(result.contentHandlingApplied).toBe("CONTENT_SCAN");
      expect(result.allCategories).toContain("CONTACT");
      expect(result.allCategories).toContain("HEALTH");
      expect(result.containsSpecialCategory).toBe(true);
      expect(result.specialCategories).toContain("HEALTH");
    });

    it("should detect third-party data in CONTENT_SCAN mode", () => {
      const input: DetectionInput = {
        text: "Emergency contact: spouse Maria Mustermann, phone +49 170 9999999",
      };
      const config: DetectionPipelineConfig = {
        contentHandling: "CONTENT_SCAN",
      };
      const result = runDetectionPipeline(input, config);
      expect(result.thirdPartyDataSuspected).toBe(true);
    });

    it("should NOT detect third-party data in METADATA_ONLY mode", () => {
      const input: DetectionInput = {
        text: "Emergency contact: spouse Maria Mustermann",
      };
      const result = runDetectionPipeline(input); // default METADATA_ONLY
      expect(result.thirdPartyDataSuspected).toBe(false);
    });

    it("should combine metadata + regex results in CONTENT_SCAN mode", () => {
      const input: DetectionInput = {
        fileName: "payroll_report.xlsx",
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        text: "Employee: Max Mustermann, EMP-001234, salary 5000 EUR",
      };
      const config: DetectionPipelineConfig = {
        contentHandling: "CONTENT_SCAN",
      };
      const result = runDetectionPipeline(input, config);
      expect(result.results.length).toBeGreaterThanOrEqual(2); // metadata + regex
      expect(result.allCategories).toContain("HR");
    });
  });
});

// =========================================================================
// 7. New PII Pattern Detection
// =========================================================================
describe("New PII Pattern Detection", () => {
  describe("IP Address detection", () => {
    it("should detect IPv4 addresses", () => {
      const text = "Server IP: 192.168.1.100 and 10.0.0.1";
      const results = runAllDetectors(text);
      const allElements = results.flatMap((r) => r.detectedElements);
      const ipElements = allElements.filter((e) => e.elementType === "IP_V4");
      expect(ipElements.length).toBeGreaterThanOrEqual(1);
      const categories = classifyFindings(results);
      expect(categories).toContain("ONLINE_TECHNICAL");
    });

    it("should mask IPv4 preserving first and last octet", () => {
      const masked = maskPII("192.168.1.100", "IP_V4");
      expect(masked.startsWith("192")).toBe(true);
      expect(masked).toContain("***");
    });
  });

  describe("MAC Address detection", () => {
    it("should detect MAC addresses", () => {
      const text = "Device MAC: AA:BB:CC:DD:EE:FF";
      const results = runAllDetectors(text);
      const allElements = results.flatMap((r) => r.detectedElements);
      const macElements = allElements.filter((e) => e.elementType === "MAC_ADDRESS");
      expect(macElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Employee ID detection", () => {
    it("should detect EMP-style employee IDs", () => {
      const text = "Mitarbeiter EMP-001234 ist zuständig.";
      const results = runAllDetectors(text);
      const allElements = results.flatMap((r) => r.detectedElements);
      const empElements = allElements.filter((e) =>
        e.elementType === "EMPLOYEE_ID_GENERIC"
      );
      expect(empElements.length).toBeGreaterThanOrEqual(1);
      const categories = classifyFindings(results);
      expect(categories).toContain("HR");
    });
  });

  describe("Customer Number detection", () => {
    it("should detect KNR-style customer numbers", () => {
      const text = "Kundennummer: KNR-123456";
      const results = runAllDetectors(text);
      const allElements = results.flatMap((r) => r.detectedElements);
      const custElements = allElements.filter((e) =>
        e.elementType === "CUSTOMER_NUMBER_GENERIC"
      );
      expect(custElements.length).toBeGreaterThanOrEqual(1);
      const categories = classifyFindings(results);
      expect(categories).toContain("CONTRACT");
    });
  });
});

// =========================================================================
// 8. Third-Party Data Heuristics
// =========================================================================
describe("Third-Party Data Heuristics", () => {
  it("should detect 'spouse' as third-party indicator", () => {
    expect(detectThirdPartyData("Contact spouse for details")).toBe(true);
  });

  it("should detect 'emergency contact' as third-party indicator", () => {
    expect(detectThirdPartyData("Emergency contact: John Doe")).toBe(true);
  });

  it("should detect 'Ehepartner' as third-party indicator (German)", () => {
    expect(detectThirdPartyData("Ehepartner: Maria Mustermann")).toBe(true);
  });

  it("should detect 'Notfallkontakt' as third-party indicator (German)", () => {
    expect(detectThirdPartyData("Notfallkontakt angeben")).toBe(true);
  });

  it("should return false for text without third-party indicators", () => {
    expect(detectThirdPartyData("The employee works at company X")).toBe(false);
  });

  it("should return false for empty input", () => {
    expect(detectThirdPartyData("")).toBe(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(detectThirdPartyData(null as any)).toBe(false);
  });
});

// =========================================================================
// 9. Data Category Mapping
// =========================================================================
describe("Data Category Mapping (mapElementToCategory)", () => {
  it("should map EMAIL_ADDRESS -> CONTACT", () => {
    expect(mapElementToCategory("EMAIL_ADDRESS")).toBe("CONTACT");
  });

  it("should map IBAN_DE -> PAYMENT", () => {
    expect(mapElementToCategory("IBAN_DE")).toBe("PAYMENT");
  });

  it("should map CREDIT_CARD_VISA -> PAYMENT", () => {
    expect(mapElementToCategory("CREDIT_CARD_VISA")).toBe("PAYMENT");
  });

  it("should map TAX_ID_DE -> IDENTIFICATION", () => {
    expect(mapElementToCategory("TAX_ID_DE")).toBe("IDENTIFICATION");
  });

  it("should map SSN_DE -> HR", () => {
    expect(mapElementToCategory("SSN_DE")).toBe("HR");
  });

  it("should map EMPLOYEE_ID_GENERIC -> HR", () => {
    expect(mapElementToCategory("EMPLOYEE_ID_GENERIC")).toBe("HR");
  });

  it("should map CUSTOMER_NUMBER_GENERIC -> CONTRACT", () => {
    expect(mapElementToCategory("CUSTOMER_NUMBER_GENERIC")).toBe("CONTRACT");
  });

  it("should map IP_V4 -> ONLINE_TECHNICAL", () => {
    expect(mapElementToCategory("IP_V4")).toBe("ONLINE_TECHNICAL");
  });

  it("should map MAC_ADDRESS -> ONLINE_TECHNICAL", () => {
    expect(mapElementToCategory("MAC_ADDRESS")).toBe("ONLINE_TECHNICAL");
  });

  it("should map ART9_HEALTH_DATA -> HEALTH", () => {
    expect(mapElementToCategory("ART9_HEALTH_DATA")).toBe("HEALTH");
  });

  it("should map ART9_TRADE_UNION_MEMBERSHIP -> UNION", () => {
    expect(mapElementToCategory("ART9_TRADE_UNION_MEMBERSHIP")).toBe("UNION");
  });

  it("should map unknown element types to OTHER", () => {
    expect(mapElementToCategory("UNKNOWN_ELEMENT")).toBe("OTHER");
  });
});

// =========================================================================
// 10. Output Artifacts
// =========================================================================
describe("Output Artifacts", () => {
  describe("generateEvidenceIndexCSV", () => {
    it("should generate a valid CSV with header and rows", () => {
      const items = [
        {
          evidenceItemId: "ev-001",
          provider: "EXCHANGE_ONLINE",
          location: "EXCHANGE_ONLINE:Mailbox",
          results: runAllDetectors("Email: test@example.com"),
        },
      ];

      const csv = generateEvidenceIndexCSV(items);
      const lines = csv.split("\n");

      // Should have header
      expect(lines[0]).toContain("EvidenceItemId");
      expect(lines[0]).toContain("Provider");
      expect(lines[0]).toContain("ConfidenceLevel");

      // Should have at least one data row
      expect(lines.length).toBeGreaterThan(1);
      expect(lines[1]).toContain("ev-001");
      expect(lines[1]).toContain("EXCHANGE_ONLINE");
    });

    it("should include SpecialCategory=YES for Art. 9 detections", () => {
      const items = [
        {
          evidenceItemId: "ev-002",
          provider: "WORKDAY",
          location: "WORKDAY:HR",
          results: runAllDetectors("The patient was diagnosed with diabetes."),
        },
      ];

      const csv = generateEvidenceIndexCSV(items);
      // Art. 9 keywords should have YES in the SpecialCategory column
      expect(csv).toContain("YES");
    });

    it("should return only header for empty items", () => {
      const csv = generateEvidenceIndexCSV([]);
      const lines = csv.split("\n");
      expect(lines).toHaveLength(1);
      expect(lines[0]).toContain("EvidenceItemId");
    });
  });

  describe("generateFindingsSummaryJSON", () => {
    it("should produce correct summary structure", () => {
      const items = [
        {
          evidenceItemId: "ev-001",
          provider: "EXCHANGE_ONLINE",
          results: runAllDetectors("Email: test@example.com. Card: 4111111111111111"),
        },
      ];

      const summary = generateFindingsSummaryJSON(items);
      expect(summary.totalItems).toBe(1);
      expect(summary.totalElements).toBeGreaterThan(0);
      expect(summary.categoryCounts).toHaveProperty("CONTACT");
      expect(summary.categoryCounts).toHaveProperty("PAYMENT");
      expect(summary.specialCategoryDetected).toBe(false);
      expect(summary.confidenceDistribution).toHaveProperty("HIGH");
      expect(summary.confidenceDistribution).toHaveProperty("MEDIUM");
      expect(summary.confidenceDistribution).toHaveProperty("LOW");
    });

    it("should flag special categories in summary", () => {
      const items = [
        {
          evidenceItemId: "ev-002",
          provider: "WORKDAY",
          results: runAllDetectors("The patient was diagnosed with diabetes."),
        },
      ];

      const summary = generateFindingsSummaryJSON(items);
      expect(summary.specialCategoryDetected).toBe(true);
      expect(summary.specialCategories.length).toBeGreaterThan(0);
    });
  });
});

// =========================================================================
// 11. Performance Limits
// =========================================================================
describe("Performance Limits", () => {
  it("MAX_TEXT_SCAN_LENGTH should be 512000", () => {
    expect(MAX_TEXT_SCAN_LENGTH).toBe(512_000);
  });

  it("MAX_ITEMS_PER_RUN should be 10000", () => {
    expect(MAX_ITEMS_PER_RUN).toBe(10_000);
  });

  it("should not crash on very large text input", () => {
    const largeText = "Email: test@example.com. ".repeat(50000);
    // Should complete without error, potentially truncated
    const results = runRegexDetection(largeText);
    expect(Array.isArray(results)).toBe(true);
  });
});

// =========================================================================
// 12. Identity Service
// =========================================================================
describe("Identity Service", () => {
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
      expect(graph.alternateIdentifiers.length).toBeGreaterThanOrEqual(5);

      const types = graph.alternateIdentifiers.map((id) => id.type);
      expect(types).toContain("name");
      expect(types).toContain("email");
      expect(types).toContain("phone");
      expect(types).toContain("employeeId");
      expect(types).toContain("upn");

      for (const entry of graph.alternateIdentifiers) {
        expect(entry.source).toBe("case_data");
      }

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
      expect(emailEntries).toHaveLength(2);
    });
  });

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
    });

    it("should skip entries below the minimum confidence threshold", () => {
      const newEntries: AlternateIdentifier[] = [
        {
          type: "custom",
          value: "low-confidence-id",
          source: "weak_source",
          confidence: 0.05,
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

      const sysEntries = updated.alternateIdentifiers.filter(
        (id) =>
          id.type === "system_account" &&
          id.value === "microsoft_entra:user-obj-id-123"
      );
      expect(sysEntries).toHaveLength(1);
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
    });
  });

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
      expect(primary.type).toBe("EMAIL");
      expect(primary.value).toBe("max@example.com");
      expect(alternatives.length).toBeGreaterThanOrEqual(2);
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
      expect(alternatives).toEqual([]);
    });
  });
});

// =========================================================================
// 13. RBAC Copilot Permissions
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

    it("should NOT allow READ_ONLY to read copilot results", () => {
      expect(hasPermission("READ_ONLY", "copilot", "read")).toBe(false);
    });
  });

  describe("checkPermission throws on forbidden access", () => {
    it("should throw when CONTRIBUTOR tries copilot create", () => {
      expect(() =>
        checkPermission("CONTRIBUTOR", "copilot", "create")
      ).toThrow();
    });

    it("should throw when READ_ONLY tries copilot read", () => {
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
    const allowedRoles = ["SUPER_ADMIN", "TENANT_ADMIN", "DPO", "CASE_MANAGER"] as const;
    const deniedRoles = ["CONTRIBUTOR", "READ_ONLY"] as const;

    for (const role of allowedRoles) {
      it(`should return true for ${role}`, () => {
        expect(canUseCopilot(role)).toBe(true);
      });
    }

    for (const role of deniedRoles) {
      it(`should return false for ${role}`, () => {
        expect(canUseCopilot(role)).toBe(false);
      });
    }
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
// 14. Special Category Gating Logic
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
    expect(specialCats).toContain("OTHER_SPECIAL_CATEGORY");
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

    const piiCategories = classifyFindings(nonSpecial);
    expect(piiCategories).toContain("CONTACT");
    expect(piiCategories).toContain("PAYMENT");

    const specialCats = getSpecialCategories(special);
    expect(specialCats).toContain("HEALTH");
    expect(specialCats).toContain("RELIGION");

    expect(hasSpecialCategory(results)).toBe(true);
  });

  it("should return containsSpecialCategorySuspected: false for purely PII content", () => {
    const text = "Email: test@example.com. IBAN: DE89370400440532013000.";
    const results = runAllDetectors(text);

    expect(hasSpecialCategory(results)).toBe(false);
    for (const r of results) {
      expect(r.containsSpecialCategorySuspected).toBe(false);
    }
  });

  describe("isSpecialCategory matches SPECIAL_CATEGORIES set", () => {
    const specialTypes: DataCategoryType[] = [
      "HEALTH", "RELIGION", "UNION", "POLITICAL_OPINION", "OTHER_SPECIAL_CATEGORY",
    ];

    for (const cat of specialTypes) {
      it(`${cat} should be special`, () => {
        expect(isSpecialCategory(cat)).toBe(true);
        expect(SPECIAL_CATEGORIES.has(cat)).toBe(true);
      });
    }

    const nonSpecial: DataCategoryType[] = [
      "IDENTIFICATION", "CONTACT", "PAYMENT", "COMMUNICATION",
      "HR", "CREDITWORTHINESS", "CONTRACT", "ONLINE_TECHNICAL", "OTHER",
    ];

    for (const cat of nonSpecial) {
      it(`${cat} should NOT be special`, () => {
        expect(isSpecialCategory(cat)).toBe(false);
      });
    }
  });
});

// =========================================================================
// 15. Legal Gate Logic
// =========================================================================
describe("Legal Gate Logic", () => {
  it("when special category is present, legal review should be required", () => {
    const results = runAllDetectors("The patient was diagnosed with diabetes.");
    const containsSpecial = hasSpecialCategory(results);
    expect(containsSpecial).toBe(true);
    const legalApprovalStatus = containsSpecial ? "REQUIRED" : "NOT_REQUIRED";
    expect(legalApprovalStatus).toBe("REQUIRED");
  });

  it("when no special category is present, legal review is not required", () => {
    const results = runAllDetectors("Email: test@example.com. IBAN: DE89370400440532013000.");
    const containsSpecial = hasSpecialCategory(results);
    expect(containsSpecial).toBe(false);
    const legalApprovalStatus: string = containsSpecial ? "REQUIRED" : "NOT_REQUIRED";
    expect(legalApprovalStatus).toBe("NOT_REQUIRED");
  });

  it("should block exports when approval is REQUIRED but not APPROVED", () => {
    const legalApprovalStatus: string = "REQUIRED";
    const exportAllowed =
      legalApprovalStatus === "NOT_REQUIRED" ||
      legalApprovalStatus === "APPROVED";
    expect(exportAllowed).toBe(false);
  });

  it("should allow exports when approval is APPROVED", () => {
    const legalApprovalStatus: string = "APPROVED";
    const exportAllowed =
      legalApprovalStatus === "NOT_REQUIRED" ||
      legalApprovalStatus === "APPROVED";
    expect(exportAllowed).toBe(true);
  });

  it("should allow exports when approval is NOT_REQUIRED", () => {
    const legalApprovalStatus: string = "NOT_REQUIRED";
    const exportAllowed =
      legalApprovalStatus === "NOT_REQUIRED" ||
      legalApprovalStatus === "APPROVED";
    expect(exportAllowed).toBe(true);
  });

  it("should block exports when approval is PENDING", () => {
    const legalApprovalStatus: string = "PENDING";
    const exportAllowed =
      legalApprovalStatus === "NOT_REQUIRED" ||
      legalApprovalStatus === "APPROVED";
    expect(exportAllowed).toBe(false);
  });

  it("should block exports when approval is REJECTED", () => {
    const legalApprovalStatus: string = "REJECTED";
    const exportAllowed =
      legalApprovalStatus === "NOT_REQUIRED" ||
      legalApprovalStatus === "APPROVED";
    expect(exportAllowed).toBe(false);
  });
});

// =========================================================================
// 16. Evidence Integrity
// =========================================================================
describe("Evidence Integrity", () => {
  it("Finding.evidenceItemIds should reference valid evidence items", () => {
    const evidenceItemIds = ["ev-001", "ev-002", "ev-003"];
    const findings = [
      { dataCategory: "IDENTIFICATION", evidenceItemIds: ["ev-001"], containsSpecialCategory: false },
      { dataCategory: "COMMUNICATION", evidenceItemIds: ["ev-002"], containsSpecialCategory: false },
      { dataCategory: "HR", evidenceItemIds: ["ev-003"], containsSpecialCategory: false },
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
      evidenceItemIds: ["ev-999"],
    };

    for (const refId of badFinding.evidenceItemIds) {
      expect(evidenceItemIds).not.toContain(refId);
    }
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

// =========================================================================
// 17. Redaction via maskPII (integration with detection)
// =========================================================================
describe("Detection + Masking Integration", () => {
  it("IBAN detection should produce masked preview via maskPII", () => {
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

  it("credit card detection should produce masked preview via maskPII", () => {
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

  it("email detection should produce masked preview via maskPII", () => {
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

  it("phone detection should produce masked preview via maskPII", () => {
    const text = "Phone: +49 170 1234567";
    const results = runAllDetectors(text);
    const allElements = results.flatMap((r) => r.detectedElements);
    const phoneElement = allElements.find((e) =>
      e.elementType.startsWith("PHONE")
    );
    expect(phoneElement).toBeDefined();
    expect(phoneElement!.snippetPreview).toContain("*");
  });

  it("tax ID detection should produce masked preview via maskPII", () => {
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
