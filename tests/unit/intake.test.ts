import { describe, it, expect } from "vitest";
import { classifySubmission } from "@/lib/services/classification-service";
import {
  intakeSubmissionSchema,
  emailIngestSchema,
  clarificationRequestSchema,
  dedupeLinkSchema,
  updateIntakeSettingsSchema,
} from "@/lib/validation";

// ─── Classification Service ─────────────────────────────────────────────────

describe("ClassificationService", () => {
  describe("classifySubmission", () => {
    it("should use explicit request types when provided", () => {
      const result = classifySubmission({
        requestTypes: ["ACCESS", "ERASURE"],
        requestDetails: "test",
      });
      expect(result.requestTypes).toEqual(["ACCESS", "ERASURE"]);
      expect(result.confidence).toBe(1.0);
    });

    it("should infer ACCESS from keyword 'access'", () => {
      const result = classifySubmission({
        requestDetails: "I want to access all my personal data",
      });
      expect(result.requestTypes).toContain("ACCESS");
    });

    it("should infer ERASURE from keyword 'delete'", () => {
      const result = classifySubmission({
        requestDetails: "Please delete all my data",
      });
      expect(result.requestTypes).toContain("ERASURE");
    });

    it("should infer ERASURE from German keyword 'löschen'", () => {
      const result = classifySubmission({
        requestDetails: "Bitte löschen Sie alle meine Daten",
        preferredLanguage: "de",
      });
      expect(result.requestTypes).toContain("ERASURE");
    });

    it("should default to ACCESS if no keywords match", () => {
      const result = classifySubmission({
        requestDetails: "Hello, I have a question about my account",
      });
      expect(result.requestTypes).toContain("ACCESS");
      expect(result.confidence).toBeLessThan(0.5);
    });

    it("should detect CUSTOMER subject type", () => {
      const result = classifySubmission({
        requestDetails: "As a customer, I want my data",
      });
      expect(result.subjectType).toBe("CUSTOMER");
    });

    it("should detect EMPLOYEE subject type", () => {
      const result = classifySubmission({
        requestDetails: "I am an employee requesting my HR records",
      });
      expect(result.subjectType).toBe("EMPLOYEE");
    });

    it("should use explicit subjectType when provided", () => {
      const result = classifySubmission({
        subjectType: "APPLICANT",
        requestDetails: "test",
      });
      expect(result.subjectType).toBe("APPLICANT");
    });

    it("should default jurisdiction to GDPR", () => {
      const result = classifySubmission({
        requestDetails: "test",
      });
      expect(result.jurisdiction).toBe("GDPR");
    });

    it("should detect GDPR from German email domain", () => {
      const result = classifySubmission({
        requestDetails: "test",
        subjectEmail: "user@firma.de",
      });
      expect(result.jurisdiction).toBe("GDPR");
    });

    it("should detect multiple request types from combined text", () => {
      const result = classifySubmission({
        requestDetails: "I want to access my data and then have it deleted. Also please correct my phone number.",
      });
      expect(result.requestTypes).toContain("ACCESS");
      expect(result.requestTypes).toContain("ERASURE");
      expect(result.requestTypes).toContain("RECTIFICATION");
    });
  });
});

// ─── Validation Schemas ─────────────────────────────────────────────────────

describe("Intake Validation Schemas", () => {
  describe("intakeSubmissionSchema", () => {
    it("should accept valid submission", () => {
      const result = intakeSubmissionSchema.safeParse({
        requestTypes: ["ACCESS"],
        consentGiven: true,
      });
      expect(result.success).toBe(true);
    });

    it("should reject empty requestTypes", () => {
      const result = intakeSubmissionSchema.safeParse({
        requestTypes: [],
        consentGiven: true,
      });
      expect(result.success).toBe(false);
    });

    it("should reject without consent", () => {
      const result = intakeSubmissionSchema.safeParse({
        requestTypes: ["ACCESS"],
        consentGiven: false,
      });
      expect(result.success).toBe(false);
    });

    it("should accept with all optional fields", () => {
      const result = intakeSubmissionSchema.safeParse({
        preferredLanguage: "de",
        requestTypes: ["ERASURE", "ACCESS"],
        subjectType: "EMPLOYEE",
        subjectEmail: "test@example.com",
        subjectPhone: "+49 170 1234567",
        subjectName: "Max Mustermann",
        subjectAddress: "Musterstr. 1, 10115 Berlin",
        customerId: "CUST-001",
        employeeId: "EMP-001",
        requestDetails: "Please delete all my data",
        consentGiven: true,
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid email format", () => {
      const result = intakeSubmissionSchema.safeParse({
        requestTypes: ["ACCESS"],
        subjectEmail: "not-an-email",
        consentGiven: true,
      });
      expect(result.success).toBe(false);
    });

    it("should accept empty email string", () => {
      const result = intakeSubmissionSchema.safeParse({
        requestTypes: ["ACCESS"],
        subjectEmail: "",
        consentGiven: true,
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid request type", () => {
      const result = intakeSubmissionSchema.safeParse({
        requestTypes: ["INVALID_TYPE"],
        consentGiven: true,
      });
      expect(result.success).toBe(false);
    });

    it("should default language to en", () => {
      const result = intakeSubmissionSchema.parse({
        requestTypes: ["ACCESS"],
        consentGiven: true,
      });
      expect(result.preferredLanguage).toBe("en");
    });
  });

  describe("emailIngestSchema", () => {
    it("should accept valid email ingest payload", () => {
      const result = emailIngestSchema.safeParse({
        from: "sender@example.com",
        subject: "DSAR Request",
        body: "I want my data",
        tenantSlug: "acme-corp",
      });
      expect(result.success).toBe(true);
    });

    it("should reject missing from address", () => {
      const result = emailIngestSchema.safeParse({
        subject: "test",
        tenantSlug: "acme-corp",
      });
      expect(result.success).toBe(false);
    });

    it("should reject missing tenantSlug", () => {
      const result = emailIngestSchema.safeParse({
        from: "sender@example.com",
      });
      expect(result.success).toBe(false);
    });

    it("should accept with attachments", () => {
      const result = emailIngestSchema.safeParse({
        from: "sender@example.com",
        tenantSlug: "acme-corp",
        attachments: [
          {
            filename: "doc.pdf",
            contentType: "application/pdf",
            base64: "dGVzdA==",
          },
        ],
      });
      expect(result.success).toBe(true);
    });
  });

  describe("clarificationRequestSchema", () => {
    it("should accept valid clarification", () => {
      const result = clarificationRequestSchema.safeParse({
        questions: ["What is your customer ID?", "Which data do you want?"],
      });
      expect(result.success).toBe(true);
    });

    it("should reject empty questions array", () => {
      const result = clarificationRequestSchema.safeParse({
        questions: [],
      });
      expect(result.success).toBe(false);
    });

    it("should reject questions with empty strings", () => {
      const result = clarificationRequestSchema.safeParse({
        questions: [""],
      });
      expect(result.success).toBe(false);
    });
  });

  describe("dedupeLinkSchema", () => {
    it("should accept link action", () => {
      const result = dedupeLinkSchema.safeParse({
        candidateId: "550e8400-e29b-41d4-a716-446655440000",
        action: "link",
      });
      expect(result.success).toBe(true);
    });

    it("should accept merge action", () => {
      const result = dedupeLinkSchema.safeParse({
        candidateId: "550e8400-e29b-41d4-a716-446655440000",
        action: "merge",
      });
      expect(result.success).toBe(true);
    });

    it("should accept dismiss action", () => {
      const result = dedupeLinkSchema.safeParse({
        candidateId: "550e8400-e29b-41d4-a716-446655440000",
        action: "dismiss",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid action", () => {
      const result = dedupeLinkSchema.safeParse({
        candidateId: "550e8400-e29b-41d4-a716-446655440000",
        action: "delete",
      });
      expect(result.success).toBe(false);
    });

    it("should reject invalid UUID", () => {
      const result = dedupeLinkSchema.safeParse({
        candidateId: "not-a-uuid",
        action: "link",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("updateIntakeSettingsSchema", () => {
    it("should accept valid settings update", () => {
      const result = updateIntakeSettingsSchema.safeParse({
        autoCreateCase: true,
        dedupeWindowDays: 60,
        clarificationPausesClock: false,
      });
      expect(result.success).toBe(true);
    });

    it("should reject dedupeWindowDays out of range", () => {
      const result = updateIntakeSettingsSchema.safeParse({
        dedupeWindowDays: 0,
      });
      expect(result.success).toBe(false);
    });

    it("should accept partial update", () => {
      const result = updateIntakeSettingsSchema.safeParse({
        rateLimitPerMinute: 10,
      });
      expect(result.success).toBe(true);
    });

    it("should accept empty object (no changes)", () => {
      const result = updateIntakeSettingsSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });
});

// ─── Email Parsing (Identifier Extraction) ──────────────────────────────────

describe("Email Identifier Parsing", () => {
  // Test the regex patterns used in email-ingest-service
  const EMAIL_REGEX = /[\w.-]+@[\w.-]+\.\w{2,}/g;
  const PHONE_REGEX = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{2,4}/g;
  const CUSTOMER_ID_REGEX = /(?:customer[_\- ]?(?:id|nr|number|no))[:\s]*([A-Z0-9-]+)/gi;
  const EMPLOYEE_ID_REGEX = /(?:employee[_\- ]?(?:id|nr|number|no)|mitarbeiter[_\- ]?(?:nr|nummer))[:\s]*([A-Z0-9-]+)/gi;

  it("should extract email addresses from text", () => {
    const text = "Please contact me at john@example.com or john.doe@work.org";
    const matches = text.match(EMAIL_REGEX);
    expect(matches).toContain("john@example.com");
    expect(matches).toContain("john.doe@work.org");
  });

  it("should extract phone numbers", () => {
    const text = "My phone is +49 170 1234567";
    const matches = text.match(PHONE_REGEX);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThan(0);
  });

  it("should extract customer IDs", () => {
    const text = "Customer ID: CUST-12345 and customer-number: ABC999";
    const matches: string[] = [];
    let match;
    while ((match = CUSTOMER_ID_REGEX.exec(text)) !== null) {
      matches.push(match[1]);
    }
    expect(matches).toContain("CUST-12345");
  });

  it("should extract employee IDs in German", () => {
    const text = "Mitarbeiternummer: EMP-4567";
    const matches: string[] = [];
    let match;
    while ((match = EMPLOYEE_ID_REGEX.exec(text)) !== null) {
      matches.push(match[1]);
    }
    expect(matches).toContain("EMP-4567");
  });
});

// ─── Dedupe Scoring Logic (Unit) ────────────────────────────────────────────

describe("Dedupe Scoring Logic", () => {
  function nameSimilarity(a: string, b: string): number {
    const na = (a || "").trim().toLowerCase();
    const nb = (b || "").trim().toLowerCase();
    if (!na || !nb) return 0;
    if (na === nb) return 1.0;
    const tokensA = new Set(na.split(/\s+/));
    const tokensB = new Set(nb.split(/\s+/));
    let overlap = 0;
    Array.from(tokensA).forEach((t) => {
      if (tokensB.has(t)) overlap++;
    });
    const total = Math.max(tokensA.size, tokensB.size);
    return total > 0 ? overlap / total : 0;
  }

  it("should return 1.0 for identical names", () => {
    expect(nameSimilarity("John Doe", "John Doe")).toBe(1.0);
  });

  it("should return 1.0 for case-insensitive identical names", () => {
    expect(nameSimilarity("John Doe", "john doe")).toBe(1.0);
  });

  it("should return 0.5 for partial name match", () => {
    expect(nameSimilarity("John Doe", "John Smith")).toBe(0.5);
  });

  it("should return 0 for completely different names", () => {
    expect(nameSimilarity("John Doe", "Maria Mueller")).toBe(0);
  });

  it("should return 0 for empty strings", () => {
    expect(nameSimilarity("", "John")).toBe(0);
    expect(nameSimilarity("John", "")).toBe(0);
  });

  it("should handle single-name inputs", () => {
    expect(nameSimilarity("John", "John")).toBe(1.0);
  });

  it("should handle abbreviated names with overlap", () => {
    // "J. Doe" has tokens ["j.", "doe"], "John Doe" has ["john", "doe"]
    // overlap = 1 ("doe"), max = 2 → 0.5
    expect(nameSimilarity("J. Doe", "John Doe")).toBe(0.5);
  });
});

// ─── Rate Limiting Logic ────────────────────────────────────────────────────

describe("Spam Detection", () => {
  function isSpamHoneypot(value: string | undefined): boolean {
    return !!(value && value.length > 0);
  }

  it("should detect honeypot field as spam", () => {
    expect(isSpamHoneypot("gotcha-bot")).toBe(true);
  });

  it("should not flag empty honeypot as spam", () => {
    expect(isSpamHoneypot("")).toBe(false);
  });

  it("should not flag undefined honeypot as spam", () => {
    expect(isSpamHoneypot(undefined)).toBe(false);
  });
});

// ─── Intake Reference Generation ────────────────────────────────────────────

describe("Intake Reference Generation", () => {
  it("should generate a reference matching INK-XXXXXXXX pattern", () => {
    // Replicate the generation logic
    const { v4: uuidv4 } = require("uuid");
    const rand = uuidv4().replace(/-/g, "").substring(0, 8).toUpperCase();
    const reference = `INK-${rand}`;
    expect(reference).toMatch(/^INK-[A-F0-9]{8}$/);
  });

  it("should generate unique references", () => {
    const { v4: uuidv4 } = require("uuid");
    const refs = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const rand = uuidv4().replace(/-/g, "").substring(0, 8).toUpperCase();
      refs.add(`INK-${rand}`);
    }
    expect(refs.size).toBe(100);
  });
});
