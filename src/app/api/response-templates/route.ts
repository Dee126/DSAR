export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { handleApiError, ApiError } from "@/lib/errors";
import { logAudit, getClientInfo } from "@/lib/audit";
import {
  createResponseTemplateSchema,
  updateResponseTemplateSchema,
} from "@/lib/validation";

/**
 * GET /api/response-templates — List templates (tenant + system baselines)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforce(user.role, "RESPONSE_TEMPLATE_VIEW");

    const { searchParams } = new URL(request.url);
    const language = searchParams.get("language");
    const dsarType = searchParams.get("dsarType");

    const where: Record<string, unknown> = {
      OR: [{ tenantId: user.tenantId }, { tenantId: null }],
    };

    if (language) {
      (where as any).language = language;
    }
    if (dsarType) {
      (where as any).dsarTypes = { has: dsarType };
    }

    const templates = await prisma.responseTemplate.findMany({
      where: where as any,
      orderBy: [{ isBaseline: "desc" }, { updatedAt: "desc" }],
      include: {
        _count: { select: { versions: true, responseDocuments: true } },
      },
    });

    return NextResponse.json({ templates });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/response-templates — Create or clone a template
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforce(user.role, "RESPONSE_TEMPLATE_MANAGE");
    const clientInfo = getClientInfo(request);

    const body = await request.json();
    const data = createResponseTemplateSchema.parse(body);

    // If cloning, verify source exists
    if (data.clonedFromId) {
      const source = await prisma.responseTemplate.findFirst({
        where: {
          id: data.clonedFromId,
          OR: [{ tenantId: user.tenantId }, { tenantId: null }],
        },
      });
      if (!source) throw new ApiError(404, "Source template not found");
    }

    const template = await prisma.responseTemplate.create({
      data: {
        tenantId: user.tenantId,
        name: data.name,
        language: data.language,
        jurisdiction: data.jurisdiction,
        dsarTypes: data.dsarTypes as any,
        subjectTypes: data.subjectTypes || [],
        sections: data.sections as any,
        placeholders: data.placeholders as any,
        conditionals: data.conditionals as any,
        disclaimerText: data.disclaimerText,
        isBaseline: false,
        clonedFromId: data.clonedFromId,
      },
    });

    // Create initial version
    await prisma.responseTemplateVersion.create({
      data: {
        templateId: template.id,
        version: 1,
        sections: data.sections as any,
        changedBy: user.id,
        changeNote: data.clonedFromId ? "Cloned from existing template" : "Initial version",
      },
    });

    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "response_template.created",
      entityType: "ResponseTemplate",
      entityId: template.id,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      details: { name: data.name, language: data.language, clonedFromId: data.clonedFromId },
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PUT /api/response-templates — Update a template (by id in body)
 */
export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforce(user.role, "RESPONSE_TEMPLATE_MANAGE");
    const clientInfo = getClientInfo(request);

    const body = await request.json();
    const templateId = body.id as string;
    if (!templateId) throw new ApiError(400, "Template id is required");

    const existing = await prisma.responseTemplate.findFirst({
      where: { id: templateId, tenantId: user.tenantId },
    });
    if (!existing) throw new ApiError(404, "Template not found");
    if (existing.isBaseline) {
      throw new ApiError(400, "Cannot modify baseline templates. Clone it first.");
    }

    const data = updateResponseTemplateSchema.parse(body);

    const updated = await prisma.responseTemplate.update({
      where: { id: templateId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.language && { language: data.language }),
        ...(data.jurisdiction && { jurisdiction: data.jurisdiction }),
        ...(data.dsarTypes && { dsarTypes: data.dsarTypes as any }),
        ...(data.subjectTypes && { subjectTypes: data.subjectTypes }),
        ...(data.sections && { sections: data.sections as any }),
        ...(data.placeholders !== undefined && { placeholders: data.placeholders as any }),
        ...(data.conditionals !== undefined && { conditionals: data.conditionals as any }),
        ...(data.disclaimerText !== undefined && { disclaimerText: data.disclaimerText }),
      },
    });

    // Create new version if sections changed
    if (data.sections) {
      const latestVersion = await prisma.responseTemplateVersion.findFirst({
        where: { templateId },
        orderBy: { version: "desc" },
      });
      await prisma.responseTemplateVersion.create({
        data: {
          templateId,
          version: (latestVersion?.version || 0) + 1,
          sections: data.sections as any,
          changedBy: user.id,
          changeNote: body.changeNote || "Updated",
        },
      });
    }

    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "response_template.updated",
      entityType: "ResponseTemplate",
      entityId: templateId,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      details: { name: updated.name },
    });

    return NextResponse.json({ template: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
