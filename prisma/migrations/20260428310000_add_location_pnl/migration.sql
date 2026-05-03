-- AlterTable
ALTER TABLE "Location" ADD COLUMN     "quotedAmount" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "ProjectCost" ADD COLUMN     "locationId" TEXT;

-- CreateIndex
CREATE INDEX "ProjectCost_locationId_idx" ON "ProjectCost"("locationId");

-- AddForeignKey
ALTER TABLE "ProjectCost" ADD CONSTRAINT "ProjectCost_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;
