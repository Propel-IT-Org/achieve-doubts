ALTER TABLE "achieve_sso_tokens" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "batches" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "student_profiles" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "student_profiles" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
CREATE INDEX "achieve_sso_token_user_idx" ON "achieve_sso_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "achieve_sso_token_batch_idx" ON "achieve_sso_tokens" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "student_profile_user_idx" ON "student_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "student_profile_batch_idx" ON "student_profiles" USING btree ("batch_id");