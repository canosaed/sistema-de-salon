ALTER TABLE "user" ALTER COLUMN "emailVerified" SET DATA TYPE boolean USING ("emailVerified" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "emailVerified" SET NOT NULL;
