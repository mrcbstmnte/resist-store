CREATE TABLE "store_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"shipping_fee_cents" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "store_settings_single_row" CHECK ("store_settings"."id" = 1),
	CONSTRAINT "shipping_fee_not_negative" CHECK ("store_settings"."shipping_fee_cents" >= 0)
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipping_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
INSERT INTO "store_settings" ("id", "shipping_fee_cents") VALUES (1, 0) ON CONFLICT ("id") DO NOTHING;
