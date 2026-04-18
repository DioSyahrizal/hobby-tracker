CREATE TYPE "public"."item_status" AS ENUM('wishlist', 'active', 'paused', 'completed', 'dropped');--> statement-breakpoint
CREATE TYPE "public"."item_type" AS ENUM('game', 'anime', 'book', 'gunpla');--> statement-breakpoint
CREATE TYPE "public"."mental_load" AS ENUM('light', 'medium', 'heavy');--> statement-breakpoint
CREATE TYPE "public"."time_commitment" AS ENUM('short', 'medium', 'long', 'very_long');--> statement-breakpoint
CREATE TABLE "items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "item_type" NOT NULL,
	"title" text NOT NULL,
	"status" "item_status" DEFAULT 'wishlist' NOT NULL,
	"current_progress" text,
	"priority" integer DEFAULT 3 NOT NULL,
	"time_commitment" time_commitment,
	"mental_load" "mental_load",
	"mood_tags" text[],
	"cover_url" text,
	"external_id" text,
	"external_source" text,
	"metadata" jsonb,
	"notes" text,
	"rating" integer,
	"last_touched_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"active_limit_game" integer DEFAULT 3 NOT NULL,
	"active_limit_anime" integer DEFAULT 3 NOT NULL,
	"active_limit_book" integer DEFAULT 2 NOT NULL,
	"active_limit_gunpla" integer DEFAULT 5 NOT NULL,
	"theme" text DEFAULT 'system' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "items_type_status_idx" ON "items" USING btree ("type","status");--> statement-breakpoint
CREATE INDEX "items_last_touched_idx" ON "items" USING btree ("last_touched_at");--> statement-breakpoint
CREATE INDEX "items_priority_idx" ON "items" USING btree ("priority" DESC NULLS LAST);