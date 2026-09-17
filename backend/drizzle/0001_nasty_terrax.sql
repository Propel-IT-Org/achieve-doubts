-- idx_questions_text_trgm below uses gin_trgm_ops, which only exists once
-- pg_trgm is installed. drizzle-kit can't express extensions, so this line
-- was added by hand. pg_trgm is a trusted extension (PG13+), so the database
-- owner can create it without superuser.
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
DROP INDEX "idx_notifications_user_read";--> statement-breakpoint
CREATE INDEX "idx_questions_text_trgm" ON "questions" USING gin ("text" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_questions_answered_at" ON "questions" USING btree ("answered_at") WHERE "questions"."answered_at" is not null;--> statement-breakpoint
CREATE INDEX "idx_solutions_solver" ON "solutions" USING btree ("solver_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_user_created" ON "notifications" USING btree ("user_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_notifications_user_unread" ON "notifications" USING btree ("user_id") WHERE "notifications"."read_at" is null;--> statement-breakpoint
CREATE INDEX "idx_lock_events_question_at" ON "lock_events" USING btree ("question_id","at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_lock_events_solver_action" ON "lock_events" USING btree ("solver_id","action");--> statement-breakpoint
CREATE INDEX "idx_payout_lines_period" ON "payout_lines" USING btree ("period_id");