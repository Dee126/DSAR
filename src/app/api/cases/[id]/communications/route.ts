import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/rbac";
import { logAudit, getClientInfo } from "@/lib/audit";
import { ApiError, handleApiError } from "@/lib/errors";
import { z } from "zod";

interface RouteParams {
  params: { id: string };
}

const createCommunicationSchema = z.object({
  direction: z.enum(["INBOUND", "OUTBOUND"]),
  channel: z.enum(["EMAIL", "LETTER", "PORTAL", "PHONE"]),
  subject: z.string().optional(),
  body: z.string().min(1, "Body is required"),
  attachments: z.array(z.string()).optional(),
  sentAt: z.string().datetime().optional(),
});

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "cases", "read");

    const dsarCase = await prisma.dSARCase.findFirst({
      where: { id: params.id, tenantId: user.tenantId, deletedAt: null },
    });

    if (!dsarCase) {
      throw new ApiError(404, "Case not found");
    }

    const communications = await prisma.communicationLog.findMany({
      where: { caseId: params.id, tenantId: user.tenantId },
      orderBy: { sentAt: "desc" },
    });

    return NextResponse.json({ data: communications });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "cases", "update");

    const dsarCase = await prisma.dSARCase.findFirst({
      where: { id: params.id, tenantId: user.tenantId, deletedAt: null },
    });

    if (!dsarCase) {
      throw new ApiError(404, "Case not found");
    }

    const body = await request.json();
    const data = createCommunicationSchema.parse(body);

    const communication = await prisma.communicationLog.create({
      data: {
        tenantId: user.tenantId,
        caseId: params.id,
        direction: data.direction,
        channel: data.channel,
        subject: data.subject,
        body: data.body,
        attachments: data.attachments ?? undefined,
        sentAt: data.sentAt ? new Date(data.sentAt) : new Date(),
      },
    });

    const clientInfo = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "communication.created",
      entityType: "CommunicationLog",
      entityId: communication.id,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      details: {
        caseId: params.id,
        direction: data.direction,
        channel: data.channel,
      },
    });

    return NextResponse.json(communication, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
