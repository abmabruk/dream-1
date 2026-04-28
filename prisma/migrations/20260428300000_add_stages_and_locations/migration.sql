-- CreateEnum
CREATE TYPE "StageInstanceStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'SKIPPED');

-- AlterEnum: ProjectActivityType
ALTER TYPE "ProjectActivityType" ADD VALUE 'STAGE_STARTED';
ALTER TYPE "ProjectActivityType" ADD VALUE 'STAGE_COMPLETED';
ALTER TYPE "ProjectActivityType" ADD VALUE 'STAGE_SKIPPED';
ALTER TYPE "ProjectActivityType" ADD VALUE 'STAGE_BLOCKED';
ALTER TYPE "ProjectActivityType" ADD VALUE 'DEPOSIT_ATTESTED';
ALTER TYPE "ProjectActivityType" ADD VALUE 'LOCATION_ADDED';

-- CreateTable: ProjectStage
CREATE TABLE "ProjectStage" (
    "id" TEXT NOT NULL,
    "factoryId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ownerRole" "UserRole",
    "sortOrder" INTEGER NOT NULL,
    "isOptional" BOOLEAN NOT NULL DEFAULT false,
    "requiresDepositAttestation" BOOLEAN NOT NULL DEFAULT false,
    "expectedDays" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectStage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectStage_factoryId_slug_key" ON "ProjectStage"("factoryId", "slug");

-- CreateIndex
CREATE INDEX "ProjectStage_factoryId_sortOrder_idx" ON "ProjectStage"("factoryId", "sortOrder");

-- CreateTable: ProjectStageInstance
CREATE TABLE "ProjectStageInstance" (
    "id" TEXT NOT NULL,
    "factoryId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "status" "StageInstanceStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "ownerUserId" TEXT,
    "notes" TEXT,
    "depositAttested" BOOLEAN NOT NULL DEFAULT false,
    "depositAmount" DECIMAL(12,2),
    "depositReceivedAt" TIMESTAMP(3),
    "depositMethod" TEXT,
    "depositReceiptUrl" TEXT,
    "depositNote" TEXT,
    "drawingsApproved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectStageInstance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectStageInstance_projectId_stageId_key" ON "ProjectStageInstance"("projectId", "stageId");

-- CreateIndex
CREATE INDEX "ProjectStageInstance_factoryId_projectId_idx" ON "ProjectStageInstance"("factoryId", "projectId");

-- CreateIndex
CREATE INDEX "ProjectStageInstance_status_idx" ON "ProjectStageInstance"("status");

-- CreateTable: Location
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "factoryId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isTemplate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Location_factoryId_projectId_sortOrder_idx" ON "Location"("factoryId", "projectId", "sortOrder");

-- AlterTable: ProjectTask add stageInstanceId, locationId
ALTER TABLE "ProjectTask" ADD COLUMN "stageInstanceId" TEXT;
ALTER TABLE "ProjectTask" ADD COLUMN "locationId" TEXT;

-- AlterTable: ProjectCost add stageInstanceId
ALTER TABLE "ProjectCost" ADD COLUMN "stageInstanceId" TEXT;

-- AddForeignKey: ProjectStage
ALTER TABLE "ProjectStage" ADD CONSTRAINT "ProjectStage_factoryId_fkey" FOREIGN KEY ("factoryId") REFERENCES "Factory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: ProjectStageInstance
ALTER TABLE "ProjectStageInstance" ADD CONSTRAINT "ProjectStageInstance_factoryId_fkey" FOREIGN KEY ("factoryId") REFERENCES "Factory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectStageInstance" ADD CONSTRAINT "ProjectStageInstance_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectStageInstance" ADD CONSTRAINT "ProjectStageInstance_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "ProjectStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProjectStageInstance" ADD CONSTRAINT "ProjectStageInstance_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: Location
ALTER TABLE "Location" ADD CONSTRAINT "Location_factoryId_fkey" FOREIGN KEY ("factoryId") REFERENCES "Factory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Location" ADD CONSTRAINT "Location_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: ProjectTask new FKs
ALTER TABLE "ProjectTask" ADD CONSTRAINT "ProjectTask_stageInstanceId_fkey" FOREIGN KEY ("stageInstanceId") REFERENCES "ProjectStageInstance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectTask" ADD CONSTRAINT "ProjectTask_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: ProjectCost new FK
ALTER TABLE "ProjectCost" ADD CONSTRAINT "ProjectCost_stageInstanceId_fkey" FOREIGN KEY ("stageInstanceId") REFERENCES "ProjectStageInstance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
