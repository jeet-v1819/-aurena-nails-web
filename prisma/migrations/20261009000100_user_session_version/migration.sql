-- Session versioning revokes existing JWTs after a password change or account
-- deactivation without invalidating sessions for unrelated users.
ALTER TABLE "User"
    ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
