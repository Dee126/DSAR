/**
 * Response Generator Service
 *
 * Takes a template + fact pack and produces structured section outputs
 * and a full rendered HTML document. Supports "No-AI" mode (pure template
 * rendering) and optional AI-assisted narrative drafting.
 *
 * DISCLAIMER: Generated responses are templates filled with case data.
 * They do not constitute legal advice. All content must be reviewed
 * by qualified personnel before sending.
 */

import { prisma } from "./prisma";
import { assembleFactPack, type FactPack } from "./data-assembly";
import {
  resolveTemplate,
  renderPlaceholders,
  evaluateConditionals,
  type TemplateSection,
  type TemplateConditional,
} from "./response-templates";
import { checkRedactionGate } from "./redaction-controls-service";
import { buildRedactionSummary } from "./legal-exception-service";
import type { DSARType } from "@prisma/client";

export interface RenderedSection {
  key: string;
  title: string;
  renderedHtml: string;
}

export interface GenerationResult {
  responseDocId: string;
  version: number;
  sections: RenderedSection[];
  fullHtml: string;
  templateUsed: string | null;
  aiAssisted: boolean;
  warnings: string[];
}

/**
 * Generate a response document for a case.
 *
 * 1. Assemble fact pack
 * 2. Resolve template (or use specified templateId)
 * 3. Render sections with placeholder substitution
 * 4. Apply conditional section visibility
 * 5. Produce full HTML
 * 6. Store as ResponseDocument (version incremented)
 */
export async function generateResponse(
  tenantId: string,
  caseId: string,
  userId: string,
  options: {
    templateId?: string;
    language?: string;
    aiAssisted?: boolean;
  } = {},
): Promise<GenerationResult> {
  const warnings: string[] = [];

  // 1. Assemble fact pack
  const factPack = await assembleFactPack(tenantId, caseId);

  // Pre-generation checks
  if (!factPack.identityVerified) {
    warnings.push("Identity verification has not been completed for this case.");
  }
  if (!factPack.collectionComplete) {
    warnings.push("Data collection is not yet complete. Generated response may have missing data.");
  }

  // Module 8.3: Redaction gate check
  const redactionGate = await checkRedactionGate(tenantId, caseId);
  if (!redactionGate.allowed) {
    for (const blocker of redactionGate.blockers) {
      warnings.push(`Redaction: ${blocker}`);
    }
  }

  // Module 8.3: Include redaction summary in fact pack
  const redactionSummary = await buildRedactionSummary(tenantId, caseId);
  if (redactionSummary.totalRedactions > 0 || redactionSummary.legalExceptions.length > 0 || redactionSummary.partialDenials.length > 0) {
    factPack.placeholderValues["redaction.total"] = String(redactionSummary.totalRedactions);
    factPack.placeholderValues["redaction.approved"] = String(redactionSummary.approvedRedactions);
    factPack.placeholderValues["redaction.types"] = redactionSummary.redactionTypes.join(", ") || "None";
    factPack.placeholderValues["legal_exceptions.count"] = String(redactionSummary.legalExceptions.length);
    factPack.placeholderValues["legal_exceptions.summary"] = redactionSummary.legalExceptions
      .map(e => `${e.type} (${e.status}): ${e.scope}`).join("; ") || "None";
    factPack.placeholderValues["partial_denials.count"] = String(redactionSummary.partialDenials.length);
    factPack.placeholderValues["partial_denials.summary"] = redactionSummary.partialDenials
      .map(d => `${d.sectionKey}: ${d.legalBasis}`).join("; ") || "None";
  }

  // 2. Resolve template
  const language = options.language || factPack.subjectPreferredLanguage || "en";
  let template;

  if (options.templateId) {
    const specific = await prisma.responseTemplate.findFirst({
      where: {
        id: options.templateId,
        OR: [{ tenantId }, { tenantId: null }],
      },
    });
    if (specific) {
      template = {
        id: specific.id,
        name: specific.name,
        language: specific.language,
        sections: (specific.sections as unknown as TemplateSection[]) || [],
        placeholders: (specific.placeholders as unknown as any[]) || [],
        conditionals: (specific.conditionals as unknown as TemplateConditional[]) || [],
        disclaimerText: specific.disclaimerText,
      };
    }
  }

  if (!template) {
    template = await resolveTemplate(tenantId, factPack.caseType as DSARType, language);
  }

  if (!template) {
    // Fallback: generate a minimal structure
    warnings.push("No matching template found. Using minimal fallback structure.");
    template = getFallbackTemplate(factPack);
  }

  // 3. Render sections
  const hiddenSections = evaluateConditionals(
    template.conditionals,
    factPack as unknown as Record<string, unknown>,
  );

  const renderedSections: RenderedSection[] = [];
  for (const section of template.sections) {
    if (hiddenSections.has(section.key)) continue;

    const renderedHtml = renderPlaceholders(section.body, factPack.placeholderValues);
    renderedSections.push({
      key: section.key,
      title: section.title,
      renderedHtml,
    });
  }

  // 4. Produce full HTML
  const fullHtml = buildFullHtml(renderedSections, factPack, template.disclaimerText);

  // 5. Determine version
  const existingCount = await prisma.responseDocument.count({
    where: { tenantId, caseId },
  });
  const version = existingCount + 1;

  // 6. Store
  const responseDoc = await prisma.responseDocument.create({
    data: {
      tenantId,
      caseId,
      templateId: template.id,
      version,
      status: "DRAFT",
      language,
      sections: renderedSections as any,
      fullHtml,
      factPackSnapshot: factPack as any,
      aiAssisted: options.aiAssisted || false,
      aiWarnings: warnings,
      createdByUserId: userId,
    },
  });

  return {
    responseDocId: responseDoc.id,
    version,
    sections: renderedSections,
    fullHtml,
    templateUsed: template.name,
    aiAssisted: options.aiAssisted || false,
    warnings,
  };
}

/**
 * Build a complete HTML document from rendered sections.
 */
function buildFullHtml(
  sections: RenderedSection[],
  factPack: FactPack,
  disclaimerText: string | null,
): string {
  const sectionHtml = sections.map(
    (s) => `<section id="${s.key}"><h2>${escapeHtml(s.title)}</h2>${s.renderedHtml}</section>`,
  ).join("\n");

  const disclaimer = disclaimerText
    ? `<footer class="disclaimer"><p><em>${escapeHtml(disclaimerText)}</em></p></footer>`
    : `<footer class="disclaimer"><p><em>This document has been generated from a template and case data.
       It is provided as a draft for review and does not constitute legal advice.
       Please have this document reviewed by your Data Protection Officer or legal counsel before sending.</em></p></footer>`;

  return `<!DOCTYPE html>
<html lang="${factPack.subjectPreferredLanguage || "en"}">
<head>
  <meta charset="UTF-8">
  <title>DSAR Response — ${escapeHtml(factPack.caseNumber)}</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; color: #1a1a1a; line-height: 1.6; }
    h1 { font-size: 1.5rem; border-bottom: 2px solid #2563eb; padding-bottom: 0.5rem; }
    h2 { font-size: 1.1rem; color: #1e40af; margin-top: 1.5rem; }
    section { margin-bottom: 1rem; }
    table { border-collapse: collapse; width: 100%; margin: 0.5rem 0; }
    th, td { border: 1px solid #d1d5db; padding: 0.5rem; text-align: left; font-size: 0.9rem; }
    th { background: #f3f4f6; font-weight: 600; }
    .disclaimer { margin-top: 2rem; padding: 1rem; background: #fef3c7; border-left: 4px solid #f59e0b; font-size: 0.85rem; }
    .header-meta { font-size: 0.9rem; color: #6b7280; margin-bottom: 1.5rem; }
  </style>
</head>
<body>
  <h1>Data Subject Access Request Response</h1>
  <div class="header-meta">
    <p><strong>Case Reference:</strong> ${escapeHtml(factPack.caseNumber)}</p>
    <p><strong>Date:</strong> ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}</p>
    <p><strong>Data Subject:</strong> ${escapeHtml(factPack.subjectName)}</p>
  </div>
  ${sectionHtml}
  ${disclaimer}
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Minimal fallback template when no matching template is found.
 */
function getFallbackTemplate(factPack: FactPack) {
  const typeLabel = factPack.caseType === "ACCESS" ? "Access"
    : factPack.caseType === "ERASURE" ? "Erasure"
    : factPack.caseType === "RECTIFICATION" ? "Rectification"
    : factPack.caseType;

  return {
    id: "fallback",
    name: `Fallback ${typeLabel} Template`,
    language: "en",
    sections: [
      {
        key: "intro",
        title: "Introduction",
        body: `<p>Dear {{subject.name}},</p><p>Thank you for your ${typeLabel.toLowerCase()} request received on {{case.received_date}} (Reference: {{case.number}}). We have processed your request in accordance with the General Data Protection Regulation (GDPR).</p>`,
      },
      {
        key: "identity",
        title: "Identity Verification",
        body: `<p>Your identity has been {{idv.status}} as required under Article 12(6) GDPR.</p>`,
      },
      {
        key: "scope",
        title: "Scope of Request",
        body: `<p>Your request relates to: <strong>{{case.type}}</strong>.</p><p>We have searched {{systems.count}} system(s): {{systems.names}}.</p>`,
      },
      {
        key: "data_summary",
        title: "Data Summary",
        body: `<p>Categories of personal data processed: {{data.categories}}.</p><p>Total records identified: {{data.total_records}}.</p>`,
      },
      {
        key: "recipients",
        title: "Recipients",
        body: `<p>Your data has been shared with the following categories of recipients: {{recipients.categories}}.</p>`,
      },
      {
        key: "retention",
        title: "Retention Periods",
        body: `<p>Retention information: {{retention.summary}}.</p>`,
      },
      {
        key: "rights",
        title: "Your Rights",
        body: `<p>Under the GDPR, you have the right to access, rectify, erase, restrict processing, data portability, and object to processing of your personal data. You also have the right to lodge a complaint with a supervisory authority.</p>`,
      },
      {
        key: "contact",
        title: "Contact Information",
        body: `<p>If you have any questions about this response, please contact our Data Protection Officer at {{tenant.name}}.</p>`,
      },
    ] as TemplateSection[],
    placeholders: [],
    conditionals: [],
    disclaimerText: null,
  };
}
