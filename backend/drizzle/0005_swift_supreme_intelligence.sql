CREATE TABLE "levels" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"name_en" text NOT NULL,
	"name_bn" text NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "batches" ADD COLUMN "level_id" text;--> statement-breakpoint
ALTER TABLE "subjects" ADD COLUMN "level_id" varchar(32);--> statement-breakpoint
ALTER TABLE "batches" ADD CONSTRAINT "batches_level_id_levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "public"."levels"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_level_id_levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "public"."levels"("id") ON DELETE cascade ON UPDATE no action;