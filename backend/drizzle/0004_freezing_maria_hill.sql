CREATE TABLE "textbooks" (
	"id" varchar(48) PRIMARY KEY NOT NULL,
	"subject_id" varchar(32) NOT NULL,
	"book_id" varchar(32),
	"name_en" text NOT NULL,
	"name_bn" text NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "textbook_id" varchar(48);--> statement-breakpoint
ALTER TABLE "textbooks" ADD CONSTRAINT "textbooks_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "textbooks" ADD CONSTRAINT "textbooks_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_textbook_id_textbooks_id_fk" FOREIGN KEY ("textbook_id") REFERENCES "public"."textbooks"("id") ON DELETE set null ON UPDATE no action;