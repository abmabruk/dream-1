-- AlterTable
ALTER TABLE "Inquiry" ADD COLUMN "convertedCustomerId" TEXT,
ADD COLUMN "convertedOrderId" TEXT,
ADD COLUMN "convertedAt" TIMESTAMP(3),
ADD COLUMN "convertedByUserId" TEXT;

-- CreateIndex
CREATE INDEX "Inquiry_convertedCustomerId_idx" ON "Inquiry"("convertedCustomerId");

-- CreateIndex
CREATE INDEX "Inquiry_convertedOrderId_idx" ON "Inquiry"("convertedOrderId");

-- AddForeignKey
ALTER TABLE "Inquiry" ADD CONSTRAINT "Inquiry_convertedCustomerId_fkey" FOREIGN KEY ("convertedCustomerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inquiry" ADD CONSTRAINT "Inquiry_convertedOrderId_fkey" FOREIGN KEY ("convertedOrderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inquiry" ADD CONSTRAINT "Inquiry_convertedByUserId_fkey" FOREIGN KEY ("convertedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
