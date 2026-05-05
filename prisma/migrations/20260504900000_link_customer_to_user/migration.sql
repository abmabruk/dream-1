-- Link Customer to User for customer-portal login (CUSTOMER role accounts).
-- Existing customers stay unlinked (userId NULL); link is established via the invite flow.

ALTER TABLE "Customer" ADD COLUMN "userId" TEXT;

CREATE UNIQUE INDEX "Customer_userId_key" ON "Customer"("userId");

ALTER TABLE "Customer"
  ADD CONSTRAINT "Customer_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
