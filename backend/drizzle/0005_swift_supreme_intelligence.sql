CREATE TABLE "levels" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"name_en" text NOT NULL,
	"name_bn" text NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
-- Added by hand: every existing subject is an HSC paper and every existing
-- batch an HSC cohort, so both are put on class-11-12 before the column
-- turns NOT NULL. The seed (db/seed/taxonomy.ts) owns these rows from here.
INSERT INTO "levels" ("id", "name_en", "name_bn", "sort") VALUES
	('class-5', 'Class 5', 'পঞ্চম শ্রেণি', 0),
	('class-8', 'Class 8', 'অষ্টম শ্রেণি', 1),
	('class-9-10', 'Class 9–10 (SSC)', 'নবম-দশম শ্রেণি', 2),
	('class-11-12', 'Class 11–12 (HSC)', 'একাদশ-দ্বাদশ শ্রেণি', 3)
	ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
ALTER TABLE "batches" ADD COLUMN "level_id" text;--> statement-breakpoint
ALTER TABLE "subjects" ADD COLUMN "level_id" varchar(32);--> statement-breakpoint
UPDATE "subjects" SET "level_id" = 'class-11-12' WHERE "level_id" IS NULL;--> statement-breakpoint
UPDATE "batches" SET "level_id" = 'class-11-12' WHERE "level_id" IS NULL;--> statement-breakpoint
ALTER TABLE "subjects" ALTER COLUMN "level_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_level_id_levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "public"."levels"("id") ON DELETE cascade ON UPDATE no action;
