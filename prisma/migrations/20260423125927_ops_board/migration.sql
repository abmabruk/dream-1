-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('PLANNING', 'READY', 'IN_PROGRESS', 'ON_HOLD', 'BLOCKED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProjectPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "ProjectTaskStatus" AS ENUM ('BACKLOG', 'PLANNED_TODAY', 'IN_PROGRESS', 'WAITING_APPROVAL', 'BLOCKED', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaskApprovalStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "WorkQueueStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'WAITING_APPROVAL', 'BLOCKED', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProjectActivityType" AS ENUM ('PROJECT_CREATED', 'PROJECT_UPDATED', 'TASK_CREATED', 'TASK_UPDATED', 'TASK_ADDED_TO_TODAY', 'QUEUE_REORDERED', 'QUEUE_STATUS_CHANGED', 'TASK_APPROVED', 'TASK_REJECTED');

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "factoryId" TEXT NOT NULL,
    "orderId" TEXT,
    "ownerUserId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'PLANNING',
    "priority" "ProjectPriority" NOT NULL DEFAULT 'MEDIUM',
    "startDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectTask" (
    "id" TEXT NOT NULL,
    "factoryId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "assignedToUserId" TEXT,
    "approvedByUserId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "ProjectTaskStatus" NOT NULL DEFAULT 'BACKLOG',
    "priority" "ProjectPriority" NOT NULL DEFAULT 'MEDIUM',
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "approvalStatus" "TaskApprovalStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedReason" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkQueueItem" (
    "id" TEXT NOT NULL,
    "factoryId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "assignedToUserId" TEXT,
    "workDate" TIMESTAMP(3) NOT NULL,
    "position" INTEGER NOT NULL,
    "status" "WorkQueueStatus" NOT NULL DEFAULT 'PLANNED',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkQueueItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectActivity" (
    "id" TEXT NOT NULL,
    "factoryId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "taskId" TEXT,
    "actorUserId" TEXT,
    "type" "ProjectActivityType" NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Project_factoryId_status_priority_dueDate_idx" ON "Project"("factoryId", "status", "priority", "dueDate");

-- CreateIndex
CREATE INDEX "Project_orderId_idx" ON "Project"("orderId");

-- CreateIndex
CREATE INDEX "Project_ownerUserId_idx" ON "Project"("ownerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Project_factoryId_code_key" ON "Project"("factoryId", "code");

-- CreateIndex
CREATE INDEX "ProjectTask_factoryId_projectId_status_priority_idx" ON "ProjectTask"("factoryId", "projectId", "status", "priority");

-- CreateIndex
CREATE INDEX "ProjectTask_assignedToUserId_idx" ON "ProjectTask"("assignedToUserId");

-- CreateIndex
CREATE INDEX "ProjectTask_approvedByUserId_idx" ON "ProjectTask"("approvedByUserId");

-- CreateIndex
CREATE INDEX "WorkQueueItem_factoryId_workDate_status_position_idx" ON "WorkQueueItem"("factoryId", "workDate", "status", "position");

-- CreateIndex
CREATE INDEX "WorkQueueItem_assignedToUserId_idx" ON "WorkQueueItem"("assignedToUserId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkQueueItem_taskId_workDate_key" ON "WorkQueueItem"("taskId", "workDate");

-- CreateIndex
CREATE UNIQUE INDEX "WorkQueueItem_factoryId_workDate_position_key" ON "WorkQueueItem"("factoryId", "workDate", "position");

-- CreateIndex
CREATE INDEX "ProjectActivity_factoryId_projectId_createdAt_idx" ON "ProjectActivity"("factoryId", "projectId", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectActivity_taskId_idx" ON "ProjectActivity"("taskId");

-- CreateIndex
CREATE INDEX "ProjectActivity_actorUserId_idx" ON "ProjectActivity"("actorUserId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_factoryId_fkey" FOREIGN KEY ("factoryId") REFERENCES "Factory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTask" ADD CONSTRAINT "ProjectTask_factoryId_fkey" FOREIGN KEY ("factoryId") REFERENCES "Factory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTask" ADD CONSTRAINT "ProjectTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTask" ADD CONSTRAINT "ProjectTask_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTask" ADD CONSTRAINT "ProjectTask_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkQueueItem" ADD CONSTRAINT "WorkQueueItem_factoryId_fkey" FOREIGN KEY ("factoryId") REFERENCES "Factory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkQueueItem" ADD CONSTRAINT "WorkQueueItem_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "ProjectTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkQueueItem" ADD CONSTRAINT "WorkQueueItem_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectActivity" ADD CONSTRAINT "ProjectActivity_factoryId_fkey" FOREIGN KEY ("factoryId") REFERENCES "Factory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectActivity" ADD CONSTRAINT "ProjectActivity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectActivity" ADD CONSTRAINT "ProjectActivity_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "ProjectTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectActivity" ADD CONSTRAINT "ProjectActivity_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
