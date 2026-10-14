CREATE TABLE "sales_channels" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sales_channels_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "channel_id" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_method" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "discount_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "note" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_channel_id_sales_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."sales_channels"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
INSERT INTO "sales_channels" ("name", "position") VALUES
	('In person', 0),
	('Facebook', 1),
	('Instagram', 2),
	('Pop-up / event', 3)
ON CONFLICT ("name") DO NOTHING;
