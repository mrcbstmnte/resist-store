CREATE TABLE "hero" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"headline" text NOT NULL,
	"subhead" text DEFAULT '' NOT NULL,
	"cta_label" text DEFAULT '' NOT NULL,
	"cta_href" text DEFAULT '#shop' NOT NULL,
	"image_url" text,
	"alt" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hero_single_row" CHECK ("hero"."id" = 1)
);
--> statement-breakpoint
INSERT INTO "hero" ("id", "headline", "subhead", "cta_label", "cta_href")
VALUES (1, 'Faster than my excuses.', 'Active wear from Bacolod. Light, quick-dry, and printed edge to edge.', 'Shop the drop', '#shop')
ON CONFLICT ("id") DO NOTHING;
