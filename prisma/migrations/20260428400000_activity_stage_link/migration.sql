-- Wave 3 — link activities to a specific stage instance.
ALTER TABLE "ProjectActivity" ADD COLUMN "stageInstanceId" TEXT;

-- AddForeignKey
ALTER TABLE "ProjectActivity"
  ADD CONSTRAINT "ProjectActivity_stageInstanceId_fkey"
  FOREIGN KEY ("stageInstanceId") REFERENCES "ProjectStageInstance"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "ProjectActivity_stageInstanceId_idx" ON "ProjectActivity"("stageInstanceId");
