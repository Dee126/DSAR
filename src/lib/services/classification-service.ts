import { DataSubjectType, IntakeJurisdiction } from "@prisma/client";

export interface ClassificationResult {
  requestTypes: string[];
  subjectType: DataSubjectType | null;
  jurisdiction: IntakeJurisdiction;
  confidence: number;
}

const DSAR_KEYWORDS: Record<string, string[]> = {
  ACCESS: ["access", "copy", "provide", "obtain", "zugang", "auskunft", "kopie"],
  ERASURE: ["delete", "erase", "remove", "löschen", "löschung", "entfernen"],
  RECTIFICATION: ["correct", "rectify", "update", "fix", "berichtigung", "korrektur"],
  RESTRICTION: ["restrict", "limit", "stop processing", "einschränkung"],
  PORTABILITY: ["portability", "transfer", "export", "datenübertragbarkeit"],
  OBJECTION: ["object", "opt out", "widerspruch", "einspruch"],
};

const SUBJECT_KEYWORDS: Record<DataSubjectType, string[]> = {
  CUSTOMER: ["customer", "client", "buyer", "kunde", "käufer"],
  EMPLOYEE: ["employee", "worker", "staff", "mitarbeiter", "angestellter"],
  APPLICANT: ["applicant", "candidate", "bewerber"],
  VISITOR: ["visitor", "guest", "besucher"],
  OTHER: [],
};

const JURISDICTION_INDICATORS: Record<IntakeJurisdiction, string[]> = {
  GDPR: [".de", ".eu", ".at", ".ch", ".fr", ".nl", ".it", ".es", "gdpr", "dsgvo", "datenschutz"],
  CCPA: [".us", "ccpa", "california", "cpra"],
  LGPD: [".br", "lgpd", "brasil"],
  POPIA: [".za", "popia", "south africa"],
  UNKNOWN: [],
};

function scoreKeywords(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  let matches = 0;
  for (const kw of keywords) {
    if (lower.includes(kw)) matches++;
  }
  return keywords.length > 0 ? matches / keywords.length : 0;
}

export function classifySubmission(input: {
  requestTypes?: string[];
  subjectType?: string;
  requestDetails?: string;
  subjectEmail?: string;
  preferredLanguage?: string;
}): ClassificationResult {
  const text = [input.requestDetails || "", input.subjectEmail || ""].join(" ");

  // Request types: use explicit if provided, else infer
  let requestTypes = input.requestTypes || [];
  let confidence = 1.0;

  if (requestTypes.length === 0 && text.length > 0) {
    confidence = 0;
    for (const [type, keywords] of Object.entries(DSAR_KEYWORDS)) {
      const score = scoreKeywords(text, keywords);
      if (score > 0.1) {
        requestTypes.push(type);
        confidence = Math.max(confidence, score);
      }
    }
    if (requestTypes.length === 0) {
      requestTypes = ["ACCESS"];
      confidence = 0.3;
    }
  }

  // Subject type
  let subjectType: DataSubjectType | null = (input.subjectType as DataSubjectType) || null;
  if (!subjectType && text.length > 0) {
    let bestScore = 0;
    for (const [type, keywords] of Object.entries(SUBJECT_KEYWORDS)) {
      if (keywords.length === 0) continue;
      const score = scoreKeywords(text, keywords);
      if (score > bestScore) {
        bestScore = score;
        subjectType = type as DataSubjectType;
      }
    }
  }

  // Jurisdiction
  let jurisdiction: IntakeJurisdiction = IntakeJurisdiction.GDPR;
  const emailDomain = input.subjectEmail?.split("@")[1] || "";
  const langHint = input.preferredLanguage || "";
  const jurisdictionText = [text, emailDomain, langHint].join(" ");

  for (const [j, indicators] of Object.entries(JURISDICTION_INDICATORS)) {
    if (j === "UNKNOWN") continue;
    const score = scoreKeywords(jurisdictionText, indicators);
    if (score > 0.2) {
      jurisdiction = j as IntakeJurisdiction;
      break;
    }
  }

  return { requestTypes, subjectType, jurisdiction, confidence };
}
