-- Optional TOTP two-factor: secret encrypted at rest, enabled after first
-- successful verification. Nullable columns keep existing users unaffected.
ALTER TABLE "User" ADD COLUMN "totpSecret" TEXT;
ALTER TABLE "User" ADD COLUMN "totpEnabledAt" TIMESTAMP(3);
