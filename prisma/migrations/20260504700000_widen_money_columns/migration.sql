-- AlterTable
ALTER TABLE "Inquiry" ALTER COLUMN "budgetAmount" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "Location" ALTER COLUMN "quotedAmount" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "quotedAmount" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "ProjectCost" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "ProjectStageInstance" ALTER COLUMN "depositAmount" SET DATA TYPE DECIMAL(14,2);

