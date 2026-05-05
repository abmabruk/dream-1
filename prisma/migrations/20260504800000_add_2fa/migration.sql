-- Add TOTP-based 2FA fields to User
ALTER TABLE "User"
  ADD COLUMN "totpSecret" TEXT,
  ADD COLUMN "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "totpRecoveryCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "totpEnabledAt" TIMESTAMP(3);
