-- Add sortOrder field to Project for manual ordering on the projects list page
ALTER TABLE "Project" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- Index for ordered listing within a factory
CREATE INDEX "Project_factoryId_sortOrder_idx" ON "Project"("factoryId", "sortOrder");
