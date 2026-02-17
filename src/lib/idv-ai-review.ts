/**
 * IDV AI Review Service — pluggable identity document analysis.
 *
 * Default implementation is a mock that simulates field extraction and
 * risk scoring. Replace with real OCR/vision provider for production.
 *
 * Provider interface allows integration with:
 *   - Vision LLMs (e.g., existing Copilot interface)
 *   - External IDV services (Onfido, Jumio, etc.)
 *   - Local OCR libraries
 */

export interface IdvFlag {
  flag: string;
  severity: "low" | "medium" | "high" | "critical";
  detail: string;
}

export interface ExtractedFields {
  name?: string;
  dob?: string;       // ISO date string
  address?: string;
  documentNumber?: string;
  expiryDate?: string; // ISO date string
  documentType?: string;
  issuingCountry?: string;
}

export interface FieldMismatch {
  field: string;
  expected: string;
  extracted: string;
  severity: "low" | "medium" | "high";
}

export interface IdvReviewResult {
  riskScore: number;       // 0–100, higher = more risky
  flags: IdvFlag[];
  extractedFields: ExtractedFields;
  mismatches: FieldMismatch[];
  provider: string;
  rawOutput?: unknown;
}

export interface IdvReviewInput {
  artifacts: Array<{
    artifactType: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
  }>;
  subjectInfo: {
    fullName: string;
    email?: string | null;
    address?: string | null;
    phone?: string | null;
  };
}

/**
 * Provider interface — implement this for real OCR/vision integration.
 */
export interface IdvReviewProvider {
  name: string;
  analyze(input: IdvReviewInput): Promise<IdvReviewResult>;
}

/**
 * Mock provider — simulates document analysis for development.
 * Generates realistic flags based on artifact metadata.
 */
export class MockIdvReviewProvider implements IdvReviewProvider {
  name = "mock";

  async analyze(input: IdvReviewInput): Promise<IdvReviewResult> {
    const flags: IdvFlag[] = [];
    let riskScore = 15; // baseline low risk

    const hasIdFront = input.artifacts.some((a) => a.artifactType === "ID_FRONT");
    const hasIdBack = input.artifacts.some((a) => a.artifactType === "ID_BACK");
    const hasPassport = input.artifacts.some((a) => a.artifactType === "PASSPORT");
    const hasDrivers = input.artifacts.some((a) => a.artifactType === "DRIVERS_LICENSE");
    const hasSelfie = input.artifacts.some((a) => a.artifactType === "SELFIE");
    const hasUtilityBill = input.artifacts.some((a) => a.artifactType === "UTILITY_BILL");

    // Check for required documents
    if (!hasIdFront && !hasPassport && !hasDrivers) {
      flags.push({
        flag: "MISSING_PRIMARY_ID",
        severity: "high",
        detail: "No primary ID document (ID card front, passport, or driver's license) provided",
      });
      riskScore += 30;
    }

    if (hasIdFront && !hasIdBack) {
      flags.push({
        flag: "MISSING_ID_BACK",
        severity: "medium",
        detail: "ID card front provided but back is missing",
      });
      riskScore += 10;
    }

    // Check file quality heuristics
    for (const artifact of input.artifacts) {
      if (artifact.sizeBytes < 50_000) {
        flags.push({
          flag: "LOW_QUALITY_DOCUMENT",
          severity: "medium",
          detail: `${artifact.filename} may be low quality (${Math.round(artifact.sizeBytes / 1024)}KB — minimum recommended: 50KB)`,
        });
        riskScore += 10;
      }

      if (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(artifact.mimeType)) {
        flags.push({
          flag: "UNSUPPORTED_FORMAT",
          severity: "low",
          detail: `${artifact.filename} has unexpected MIME type: ${artifact.mimeType}`,
        });
        riskScore += 5;
      }
    }

    // Simulate field extraction from the "best" ID document
    const nameParts = input.subjectInfo.fullName.split(" ");
    const mockExtractedName = nameParts.length >= 2
      ? `${nameParts[0]} ${nameParts[nameParts.length - 1]}`
      : input.subjectInfo.fullName;

    // Simulate mock expiry — 80% chance valid, 20% chance expired
    const now = new Date();
    const isExpired = Math.random() < 0.2;
    const expiryDate = new Date(now);
    if (isExpired) {
      expiryDate.setMonth(expiryDate.getMonth() - 6);
      flags.push({
        flag: "EXPIRED_DOCUMENT",
        severity: "high",
        detail: `ID document appears to have expired on ${expiryDate.toISOString().split("T")[0]}`,
      });
      riskScore += 25;
    } else {
      expiryDate.setFullYear(expiryDate.getFullYear() + 3);
    }

    const extractedFields: ExtractedFields = {
      name: mockExtractedName,
      dob: "1990-01-15",
      address: input.subjectInfo.address ?? undefined,
      documentNumber: `ID${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
      expiryDate: expiryDate.toISOString().split("T")[0],
      documentType: hasPassport ? "PASSPORT" : hasDrivers ? "DRIVERS_LICENSE" : "ID_CARD",
      issuingCountry: "DE",
    };

    // Check name mismatches
    const mismatches: FieldMismatch[] = [];
    if (mockExtractedName.toLowerCase() !== input.subjectInfo.fullName.toLowerCase()) {
      // Check if it's a minor difference (partial match)
      const extractedLower = mockExtractedName.toLowerCase();
      const expectedLower = input.subjectInfo.fullName.toLowerCase();
      if (extractedLower.includes(expectedLower) || expectedLower.includes(extractedLower)) {
        mismatches.push({
          field: "name",
          expected: input.subjectInfo.fullName,
          extracted: mockExtractedName,
          severity: "low",
        });
      } else {
        mismatches.push({
          field: "name",
          expected: input.subjectInfo.fullName,
          extracted: mockExtractedName,
          severity: "high",
        });
        riskScore += 20;
        flags.push({
          flag: "NAME_MISMATCH",
          severity: "high",
          detail: `Extracted name "${mockExtractedName}" does not match request name "${input.subjectInfo.fullName}"`,
        });
      }
    }

    // Address mismatch (if utility bill provided and address differs)
    if (hasUtilityBill && input.subjectInfo.address) {
      // Mock: 90% match
      if (Math.random() < 0.1) {
        mismatches.push({
          field: "address",
          expected: input.subjectInfo.address,
          extracted: "123 Different Street, Berlin 10115",
          severity: "medium",
        });
        flags.push({
          flag: "ADDRESS_MISMATCH",
          severity: "medium",
          detail: "Address on utility bill does not match the provided address",
        });
        riskScore += 15;
      }
    }

    // Selfie check placeholder
    if (hasSelfie) {
      // Mock: always passes with a note
      flags.push({
        flag: "SELFIE_COLLECTED",
        severity: "low",
        detail: "Selfie was submitted. Face matching is not enabled — manual review required.",
      });
    }

    return {
      riskScore: Math.min(100, Math.max(0, riskScore)),
      flags,
      extractedFields,
      mismatches,
      provider: this.name,
    };
  }
}

// Singleton — swap for a real provider in production
let _provider: IdvReviewProvider | null = null;

export function getIdvReviewProvider(): IdvReviewProvider {
  if (!_provider) {
    _provider = new MockIdvReviewProvider();
  }
  return _provider;
}

export function setIdvReviewProvider(provider: IdvReviewProvider): void {
  _provider = provider;
}
