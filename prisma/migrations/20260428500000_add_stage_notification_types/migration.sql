-- Add new NotificationType variants for stage events
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'STAGE_STARTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DEPOSIT_ATTESTED';
