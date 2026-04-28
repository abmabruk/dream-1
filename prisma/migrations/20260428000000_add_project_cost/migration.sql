-- CreateEnum
CREATE TYPE "CostCategory" AS ENUM ('MATERIAL', 'LABOR', 'SERVICE', 'OVERHEAD', 'OTHER');

-- AlterEnum
ALTER TYPE "ProjectActivityType" ADD VALUE 'COST_ADDED';
ALTER TYPE "ProjectActivityType" ADD VALUE 'COST_DELETED';

-- CreateTable
CREATE TABLE "ProjectCost" (
    "id" TEXT NOT NULL,
    "factoryId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "taskId" TEXT,
    "category" "CostCategory" NOT NULL DEFAULT 'OTHER',
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "description" TEXT NOT NULL,
    "vendorName" TEXT,
    "receiptUrl" TEXT,
    "incurredAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectCost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectCost_factoryId_projectId_incurredAt_idx" ON "ProjectCost"("factoryId", "projectId", "incurredAt");

-- CreateIndex
CREATE INDEX "ProjectCost_factoryId_category_idx" ON "ProjectCost"("factoryId", "category");

-- CreateIndex
CREATE INDEX "ProjectCost_taskId_idx" ON "ProjectCost"("taskId");

-- AddForeignKey
ALTER TABLE "ProjectCost" ADD CONSTRAINT "ProjectCost_factoryId_fkey" FOREIGN KEY ("factoryId") REFERENCES "Factory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectCost" ADD CONSTRAINT "ProjectCost_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectCost" ADD CONSTRAINT "ProjectCost_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "ProjectTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectCost" ADD CONSTRAINT "ProjectCost_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
