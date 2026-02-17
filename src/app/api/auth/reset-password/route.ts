import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { resetPasswordSchema } from "@/lib/validation";
import { handleApiError } from "@/lib/errors";
import { ApiError } from "@/lib/errors";
import { logAudit, getClientInfo } from "@/lib/audit";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, password } = resetPasswordSchema.parse(body);
    const { ip, userAgent } = getClientInfo(request);

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!resetToken) {
      throw new ApiError(400, "Invalid or expired reset link.");
    }

    if (resetToken.usedAt) {
      throw new ApiError(400, "This reset link has already been used.");
    }

    if (resetToken.expiresAt < new Date()) {
      throw new ApiError(400, "This reset link has expired. Please request a new one.");
    }

    const passwordHash = await hash(password, 12);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
    ]);

    await logAudit({
      tenantId: resetToken.user.tenantId,
      actorUserId: resetToken.userId,
      action: "PASSWORD_RESET_COMPLETED",
      entityType: "User",
      entityId: resetToken.userId,
      ip,
      userAgent,
    });

    return NextResponse.json({
      message: "Your password has been reset successfully. You can now sign in.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
