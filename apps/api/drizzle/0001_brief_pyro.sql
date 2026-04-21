CREATE TABLE "item_mood_tags" (
	"item_id" uuid NOT NULL,
	"tag_id" integer NOT NULL,
	CONSTRAINT "item_mood_tags_item_id_tag_id_pk" PRIMARY KEY("item_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "mood_tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mood_tags_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "item_mood_tags" ADD CONSTRAINT "item_mood_tags_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_mood_tags" ADD CONSTRAINT "item_mood_tags_tag_id_mood_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."mood_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" DROP COLUMN "mood_tags";