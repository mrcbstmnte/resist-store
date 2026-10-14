-- Structured PH address. Existing orders keep their old free-text address in line 1.
ALTER TABLE "orders" ADD COLUMN "address_line1" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "barangay" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "province" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "postal_code" text;--> statement-breakpoint
UPDATE "orders" SET "address_line1" = "address", "barangay" = '', "city" = '', "province" = '', "postal_code" = '';--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "address_line1" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "barangay" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "city" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "province" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "postal_code" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "confirmation_sent_at" timestamp with time zone;
