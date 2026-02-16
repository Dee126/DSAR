import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/errors";
import { authenticateApiKey, enforceScope, logApiCall, checkRateLimit } from "@/lib/api-key-auth";
import { v1PaginationSchema, createCaseSchema } from "@/lib/validation";
import { generateCaseNumber, calculateDueDate } from "@/lib/utils";
import { logAudit, getClientInfo } from "@/lib/audit";
import { emitWebhookEvent } from "@/lib/webhook-service";

export async function GET(request: NextRequest) {
  try {
    const apiUser = await authenticateApiKey(request);
    enforceScope(apiUser, "cases:read");
    checkRateLimit(apiUser.apiKeyId);
    await logApiCall(request, apiUser, "DSARCase");

    const url = new URL(request.url);
    const { page, pageSize } = v1PaginationSchema.parse({
      page: url.searchParams.get("page"),
      pageSize: url.searchParams.get("pageSize"),
    });
    const status = url.searchParams.get("status") || undefined;

    const where: any = { tenantId: apiUser.tenantId };
    if (status) where.status = status;

    const [cases, total] = await Promise.all([
      prisma.dSARCase.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          caseNumber: true,
          type: true,
          status: true,
          priority: true,
          receivedAt: true,
          dueDate: true,
          description: true,
          createdAt: true,
          updatedAt: true,
          dataSubject: { select: { fullName: true, email: true } },
          assignedTo: { select: { id: true, name: true } },
        },
      }),
      prisma.dSARCase.count({ where }),
    ]);

    return NextResponse.json({
      data: cases,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const apiUser = await authenticateApiKey(request);
    enforceScope(apiUser, "cases:write");
    checkRateLimit(apiUser.apiKeyId);

    const body = await request.json();
    const data = createCaseSchema.parse(body);

    const tenant = await prisma.tenant.findUnique({
      where: { id: apiUser.tenantId },
    });
    const slaDays = tenant?.slaDefaultDays || 30;
    const receivedAt = data.receivedAt ? new Date(data.receivedAt) : new Date();
    const dueDate = calculateDueDate(receivedAt, slaDays);

    // Find or create data subject
    let dataSubject = data.dataSubject.id
      ? await prisma.dataSubject.findFirst({
          where: { id: data.dataSubject.id, tenantId: apiUser.tenantId },
        })
      : null;

    if (!dataSubject) {
      dataSubject = await prisma.dataSubject.create({
        data: {
          tenantId: apiUser.tenantId,
          fullName: data.dataSubject.fullName,
          email: data.dataSubject.email || null,
          phone: data.dataSubject.phone || null,
          address: data.dataSubject.address || null,
        },
      });
    }

    const newCase = await prisma.dSARCase.create({
      data: {
        tenantId: apiUser.tenantId,
        caseNumber: generateCaseNumber(),
        type: data.type,
        priority: data.priority,
        description: data.description || null,
        lawfulBasis: data.lawfulBasis || null,
        receivedAt,
        dueDate,
        channel: data.channel || "API",
        dataSubjectId: dataSubject.id,
        createdByUserId: apiUser.createdBy,
      },
      include: {
        dataSubject: { select: { fullName: true, email: true } },
      },
    });

    await logApiCall(request, apiUser, "DSARCase", newCase.id);
    const { ip, userAgent } = getClientInfo(request);
    await logAudit({
      tenantId: apiUser.tenantId,
      actorUserId: apiUser.createdBy,
      action: "CASE_CREATE",
      entityType: "DSARCase",
      entityId: newCase.id,
      ip,
      userAgent,
      details: { via: "public_api", caseNumber: newCase.caseNumber },
    });

    await emitWebhookEvent(apiUser.tenantId, "case.created", "DSARCase", newCase.id, {
      caseNumber: newCase.caseNumber,
      type: newCase.type,
      status: newCase.status,
      priority: newCase.priority,
    });

    return NextResponse.json({ data: newCase }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
