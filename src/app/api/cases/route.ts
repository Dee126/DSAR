export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/rbac";
import { logAudit, getClientInfo } from "@/lib/audit";
import { handleApiError } from "@/lib/errors";
import { createCaseSchema } from "@/lib/validation";
import { generateCaseNumber, calculateDueDate } from "@/lib/utils";
import { CaseStatus, DSARType, Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "cases", "read");

    const { searchParams } = request.nextUrl;
    const status = searchParams.get("status") as CaseStatus | null;
    const type = searchParams.get("type") as DSARType | null;
    const assignee = searchParams.get("assignee");
    const search = searchParams.get("search");
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
    const skip = (page - 1) * limit;

    const where: Prisma.DSARCaseWhereInput = {
      tenantId: user.tenantId,
    };

    if (status) {
      where.status = status;
    }

    if (type) {
      where.type = type;
    }

    if (assignee) {
      where.assignedToUserId = assignee;
    }

    if (search) {
      where.OR = [
        { caseNumber: { contains: search, mode: "insensitive" } },
        {
          dataSubject: {
            fullName: { contains: search, mode: "insensitive" },
          },
        },
        {
          dataSubject: {
            email: { contains: search, mode: "insensitive" },
          },
        },
      ];
    }

    const [cases, total] = await Promise.all([
      prisma.dSARCase.findMany({
        where,
        include: {
          dataSubject: true,
          assignedTo: {
            select: { id: true, name: true, email: true },
          },
          createdBy: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.dSARCase.count({ where }),
    ]);

    return NextResponse.json({
      data: cases,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "cases", "create");

    const body = await request.json();
    const data = createCaseSchema.parse(body);

    const { dataSubject: dsData, ...caseData } = data;

    // Find or create DataSubject
    let dataSubject;
    if (dsData.id) {
      dataSubject = await prisma.dataSubject.findFirst({
        where: { id: dsData.id, tenantId: user.tenantId },
      });
      if (!dataSubject) {
        return NextResponse.json(
          { error: "Data subject not found" },
          { status: 404 }
        );
      }
      // Update data subject fields if provided
      dataSubject = await prisma.dataSubject.update({
        where: { id: dataSubject.id },
        data: {
          fullName: dsData.fullName,
          ...(dsData.email !== undefined && { email: dsData.email || null }),
          ...(dsData.phone !== undefined && { phone: dsData.phone || null }),
          ...(dsData.address !== undefined && { address: dsData.address || null }),
        },
      });
    } else {
      dataSubject = await prisma.dataSubject.create({
        data: {
          tenantId: user.tenantId,
          fullName: dsData.fullName,
          email: dsData.email || null,
          phone: dsData.phone || null,
          address: dsData.address || null,
        },
      });
    }

    // Get tenant SLA days for due date calculation
    const tenant = await prisma.tenant.findUniqueOrThrow({
      where: { id: user.tenantId },
    });

    const receivedAt = caseData.receivedAt
      ? new Date(caseData.receivedAt)
      : new Date();
    const dueDate = calculateDueDate(receivedAt, tenant.slaDefaultDays);
    const caseNumber = generateCaseNumber();

    const newCase = await prisma.dSARCase.create({
      data: {
        tenantId: user.tenantId,
        caseNumber,
        type: caseData.type,
        priority: caseData.priority,
        channel: caseData.channel ?? null,
        requesterType: caseData.requesterType ?? null,
        description: caseData.description ?? null,
        lawfulBasis: caseData.lawfulBasis ?? null,
        receivedAt,
        dueDate,
        dataSubjectId: dataSubject.id,
        createdByUserId: user.id,
      },
      include: {
        dataSubject: true,
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    const clientInfo = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "case.created",
      entityType: "DSARCase",
      entityId: newCase.id,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      details: {
        caseNumber: newCase.caseNumber,
        type: newCase.type,
        dataSubjectName: dataSubject.fullName,
      },
    });

    return NextResponse.json(newCase, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
