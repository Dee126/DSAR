/**
 * Response Template Service
 *
 * Resolves the best-matching template for a case based on DSAR type,
 * language preference, and tenant overrides.
 *
 * DISCLAIMER: Templates are customizable placeholders only.
 * They do not constitute legal advice.
 */

import { prisma } from "./prisma";
import type { DSARType } from "@prisma/client";

export interface TemplateSection {
  key: string;
  title: string;
  body: string;
}

export interface TemplatePlaceholder {
  key: string;
  label: string;
  description?: string;
}

export interface TemplateConditional {
  condition: string;
  sectionKey: string;
  show: boolean;
}

/**
 * Resolve the best template for a case, considering:
 * 1. Tenant-specific templates matching DSAR type + language
 * 2. System baseline templates matching DSAR type + language
 * 3. Fallback: any matching DSAR type in preferred language
 */
export async function resolveTemplate(
  tenantId: string,
  dsarType: DSARType,
  language: string = "en",
): Promise<{
  id: string;
  name: string;
  language: string;
  sections: TemplateSection[];
  placeholders: TemplatePlaceholder[];
  conditionals: TemplateConditional[];
  disclaimerText: string | null;
} | null> {
  // 1. Tenant-specific template
  const tenantTemplate = await prisma.responseTemplate.findFirst({
    where: {
      tenantId,
      dsarTypes: { has: dsarType },
      language,
      isBaseline: false,
    },
    orderBy: { updatedAt: "desc" },
  });

  if (tenantTemplate) {
    return formatTemplate(tenantTemplate);
  }

  // 2. System baseline
  const baselineTemplate = await prisma.responseTemplate.findFirst({
    where: {
      tenantId: null,
      dsarTypes: { has: dsarType },
      language,
      isBaseline: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  if (baselineTemplate) {
    return formatTemplate(baselineTemplate);
  }

  // 3. Fallback: any language baseline
  const fallback = await prisma.responseTemplate.findFirst({
    where: {
      OR: [
        { tenantId, dsarTypes: { has: dsarType } },
        { tenantId: null, dsarTypes: { has: dsarType }, isBaseline: true },
      ],
    },
    orderBy: { updatedAt: "desc" },
  });

  return fallback ? formatTemplate(fallback) : null;
}

function formatTemplate(t: {
  id: string;
  name: string;
  language: string;
  sections: unknown;
  placeholders: unknown;
  conditionals: unknown;
  disclaimerText: string | null;
}) {
  return {
    id: t.id,
    name: t.name,
    language: t.language,
    sections: (t.sections as TemplateSection[]) || [],
    placeholders: (t.placeholders as TemplatePlaceholder[]) || [],
    conditionals: (t.conditionals as TemplateConditional[]) || [],
    disclaimerText: t.disclaimerText,
  };
}

/**
 * Replace placeholders in template text with fact pack values.
 * Placeholders use {{key}} format.
 */
export function renderPlaceholders(
  text: string,
  values: Record<string, string>,
): string {
  return text.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const trimmedKey = key.trim();
    return values[trimmedKey] !== undefined ? values[trimmedKey] : match;
  });
}

/**
 * Evaluate conditional sections against a fact pack.
 * Returns keys of sections that should be shown.
 */
export function evaluateConditionals(
  conditionals: TemplateConditional[],
  factPack: Record<string, unknown>,
): Set<string> {
  const hiddenSections = new Set<string>();

  for (const cond of conditionals) {
    const value = factPack[cond.condition];
    const isTruthy = Boolean(value);
    if (cond.show && !isTruthy) {
      hiddenSections.add(cond.sectionKey);
    } else if (!cond.show && isTruthy) {
      hiddenSections.add(cond.sectionKey);
    }
  }

  return hiddenSections;
}
