import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/rbac";
import { logAudit, getClientInfo } from "@/lib/audit";
import { ApiError, handleApiError } from "@/lib/errors";
import { getStorage } from "@/lib/storage";
import archiver from "archiver";
import { PassThrough } from "stream";

interface RouteParams {
  params: { id: string };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "export", "read");

    // Fetch the complete case with all relations
    const dsarCase = await prisma.dSARCase.findFirst({
      where: {
        id: params.id,
        tenantId: user.tenantId,
      },
      include: {
        dataSubject: true,
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        assignedTo: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!dsarCase) {
      throw new ApiError(404, "Case not found");
    }

    // Fetch all related data in parallel
    const [stateTransitions, tasks, comments, auditLogs, documents] =
      await Promise.all([
        prisma.dSARStateTransition.findMany({
          where: { caseId: params.id, tenantId: user.tenantId },
          include: {
            changedBy: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { changedAt: "asc" },
        }),
        prisma.task.findMany({
          where: { caseId: params.id, tenantId: user.tenantId },
          include: {
            assignee: {
              select: { id: true, name: true, email: true },
            },
            system: {
              select: { id: true, name: true },
            },
          },
          orderBy: { createdAt: "asc" },
        }),
        prisma.comment.findMany({
          where: { caseId: params.id, tenantId: user.tenantId },
          include: {
            author: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { createdAt: "asc" },
        }),
        prisma.auditLog.findMany({
          where: {
            entityType: "DSARCase",
            entityId: params.id,
            tenantId: user.tenantId,
          },
          orderBy: { createdAt: "asc" },
        }),
        prisma.document.findMany({
          where: { caseId: params.id, tenantId: user.tenantId },
          include: {
            uploadedBy: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { uploadedAt: "asc" },
        }),
      ]);

    // Build the ZIP archive
    const archive = archiver("zip", { zlib: { level: 9 } });
    const passthrough = new PassThrough();

    archive.pipe(passthrough);

    // Add JSON data files
    archive.append(
      JSON.stringify(
        {
          id: dsarCase.id,
          caseNumber: dsarCase.caseNumber,
          type: dsarCase.type,
          status: dsarCase.status,
          priority: dsarCase.priority,
          lawfulBasis: dsarCase.lawfulBasis,
          channel: dsarCase.channel,
          requesterType: dsarCase.requesterType,
          description: dsarCase.description,
          receivedAt: dsarCase.receivedAt,
          dueDate: dsarCase.dueDate,
          createdAt: dsarCase.createdAt,
          updatedAt: dsarCase.updatedAt,
          dataSubject: dsarCase.dataSubject,
          createdBy: dsarCase.createdBy,
          assignedTo: dsarCase.assignedTo,
        },
        null,
        2
      ),
      { name: "case.json" }
    );

    archive.append(JSON.stringify(stateTransitions, null, 2), {
      name: "timeline.json",
    });

    archive.append(JSON.stringify(tasks, null, 2), {
      name: "tasks.json",
    });

    archive.append(JSON.stringify(comments, null, 2), {
      name: "comments.json",
    });

    archive.append(JSON.stringify(auditLogs, null, 2), {
      name: "audit_log.json",
    });

    // Download and add each document
    const storage = getStorage();
    for (const doc of documents) {
      try {
        const fileBuffer = await storage.download(doc.storageKey);
        archive.append(fileBuffer, { name: `documents/${doc.filename}` });
      } catch (err) {
        // If a document can't be downloaded, add an error note instead
        archive.append(
          `Failed to retrieve file: ${doc.filename} (storageKey: ${doc.storageKey})`,
          { name: `documents/${doc.filename}.error.txt` }
        );
      }
    }

    await archive.finalize();

    // Collect the stream into a buffer
    const chunks: Buffer[] = [];
    for await (const chunk of passthrough) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);

    // Log the export action
    const clientInfo = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "case.exported",
      entityType: "DSARCase",
      entityId: params.id,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      details: {
        caseNumber: dsarCase.caseNumber,
        documentsCount: documents.length,
        archiveSizeBytes: buffer.length,
      },
    });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${dsarCase.caseNumber}-export.zip"`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
