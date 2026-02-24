-- CreateEnum
CREATE TYPE "AiReviewStatus" AS ENUM ('NOT_ANALYZED', 'ANALYZED', 'REVIEW_PENDING', 'REVIEWED');

-- CreateEnum
CREATE TYPE "HumanDecision" AS ENUM ('APPROVED', 'REJECTED', 'ACCEPTED_RISK');

-- AlterTable
ALTER TABLE "findings" ADD COLUMN     "aiRiskScore" INTEGER,
ADD COLUMN     "aiConfidence" DOUBLE PRECISION,
ADD COLUMN     "aiSuggestedAction" TEXT,
ADD COLUMN     "aiLegalReference" TEXT,
ADD COLUMN     "aiRationale" TEXT,
ADD COLUMN     "aiReviewStatus" "AiReviewStatus",
ADD COLUMN     "humanDecision" "HumanDecision",
ADD COLUMN     "humanDecisionBy" TEXT,
ADD COLUMN     "humanDecisionAt" TIMESTAMP(3);
