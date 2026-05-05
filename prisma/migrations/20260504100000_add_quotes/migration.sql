
-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'SENT', 'APPROVED', 'SUPERSEDED', 'REJECTED', 'CANCELLED', 'EXPIRED');

-- AlterTable
ALTER TABLE "ProjectCost" ADD COLUMN     "quoteLineId" TEXT;

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "factoryId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "QuoteStatus" NOT NULL DEFAULT 'DRAFT',
    "parentQuoteId" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 15.00,
    "taxInclusive" BOOLEAN NOT NULL DEFAULT false,
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "discountReason" TEXT,
    "taxAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "validUntil" TIMESTAMP(3),
    "sentToCustomerAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "notes" TEXT,
    "internalNotes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteLine" (
    "id" TEXT NOT NULL,
    "factoryId" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "productId" TEXT,
    "description" TEXT NOT NULL,
    "sku" TEXT,
    "quantity" DECIMAL(14,4) NOT NULL,
    "unitPrice" DECIMAL(14,4) NOT NULL,
    "lineTotal" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Quote_factoryId_status_orderId_idx" ON "Quote"("factoryId", "status", "orderId");

-- CreateIndex
CREATE INDEX "Quote_factoryId_validUntil_idx" ON "Quote"("factoryId", "validUntil");

-- CreateIndex
CREATE INDEX "Quote_deletedAt_idx" ON "Quote"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_orderId_version_key" ON "Quote"("orderId", "version");

-- CreateIndex
CREATE INDEX "QuoteLine_quoteId_sortOrder_idx" ON "QuoteLine"("quoteId", "sortOrder");

-- CreateIndex
CREATE INDEX "QuoteLine_factoryId_productId_idx" ON "QuoteLine"("factoryId", "productId");

-- CreateIndex
CREATE INDEX "ProjectCost_quoteLineId_idx" ON "ProjectCost"("quoteLineId");

-- AddForeignKey
ALTER TABLE "ProjectCost" ADD CONSTRAINT "ProjectCost_quoteLineId_fkey" FOREIGN KEY ("quoteLineId") REFERENCES "QuoteLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_factoryId_fkey" FOREIGN KEY ("factoryId") REFERENCES "Factory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_parentQuoteId_fkey" FOREIGN KEY ("parentQuoteId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteLine" ADD CONSTRAINT "QuoteLine_factoryId_fkey" FOREIGN KEY ("factoryId") REFERENCES "Factory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteLine" ADD CONSTRAINT "QuoteLine_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

