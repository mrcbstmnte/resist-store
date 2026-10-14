import {
  pgTable,
  pgEnum,
  serial,
  integer,
  text,
  boolean,
  timestamp,
  uuid,
  uniqueIndex,
  index,
  customType,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const silhouetteEnum = pgEnum("silhouette", [
  "tee",
  "hoodie",
  "jacket",
  "pants",
  "shorts",
  "cap",
  "bag",
]);

export const orderStatusEnum = pgEnum("order_status", [
  "pending", // stock reserved, awaiting payment
  "paid",
  "cancelled",
  "expired",
]);

export const movementReasonEnum = pgEnum("movement_reason", [
  "initial",
  "restock",
  "sale",
  "adjustment",
]);

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  priceCents: integer("price_cents").notNull(),
  silhouette: silhouetteEnum("silhouette").notNull().default("tee"),
  imageUrl: text("image_url"),
  // Tints the drawn garment until a photo is added. Each colourway is its own product.
  colorHex: text("color_hex").notNull().default("#888888"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const variants = pgTable(
  "variants",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    sku: text("sku").notNull().unique(),
    size: text("size").notNull(),
    position: integer("position").notNull().default(0),
    // Physical units on the shelf. Decremented only when an order is paid.
    stockOnHand: integer("stock_on_hand").notNull().default(0),
    lowStockThreshold: integer("low_stock_threshold").notNull().default(3),
  },
  (t) => [
    uniqueIndex("variants_product_size").on(t.productId, t.size),
  ],
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reference: text("reference").notNull().unique(),
    status: orderStatusEnum("status").notNull().default("pending"),
    email: text("email").notNull(),
    name: text("name").notNull(),
    phone: text("phone").notNull().default(""),
    // Philippine delivery address
    addressLine1: text("address_line1").notNull(), // house/unit no., street, subdivision
    barangay: text("barangay").notNull(),
    city: text("city").notNull(), // city or municipality
    province: text("province").notNull(),
    postalCode: text("postal_code").notNull(),
    totalCents: integer("total_cents").notNull(),
    checkoutSessionId: text("checkout_session_id").unique(),
    // Reservation window: pending orders past this time no longer hold stock.
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    oversold: boolean("oversold").notNull().default(false),
    confirmationSentAt: timestamp("confirmation_sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("orders_status_expires").on(t.status, t.expiresAt)],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: serial("id").primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    variantId: integer("variant_id")
      .notNull()
      .references(() => variants.id),
    productName: text("product_name").notNull(),
    variantLabel: text("variant_label").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    quantity: integer("quantity").notNull(),
  },
  (t) => [index("order_items_variant").on(t.variantId)],
);

export const stockMovements = pgTable(
  "stock_movements",
  {
    id: serial("id").primaryKey(),
    variantId: integer("variant_id")
      .notNull()
      .references(() => variants.id, { onDelete: "cascade" }),
    delta: integer("delta").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    reason: movementReasonEnum("reason").notNull(),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    note: text("note").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("stock_movements_variant").on(t.variantId, t.createdAt)],
);

const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" });

// Uploaded photos, served from /media/<id>.webp. Kept in Postgres so uploads
// survive deploys on hosts without a persistent disk (Vercel, Render).
export const media = pgTable("media", {
  id: uuid("id").primaryKey().defaultRandom(),
  contentType: text("content_type").notNull(),
  data: bytea("data").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Homepage gallery carousel, managed in /admin/gallery.
export const galleryPhotos = pgTable("gallery_photos", {
  id: serial("id").primaryKey(),
  imageUrl: text("image_url").notNull(),
  alt: text("alt").notNull().default(""),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Homepage reviews, managed in /admin/testimonials.
export const testimonials = pgTable("testimonials", {
  id: serial("id").primaryKey(),
  quote: text("quote").notNull(),
  name: text("name").notNull(),
  detail: text("detail").notNull().default(""), // e.g. city, or the piece they bought
  visible: boolean("visible").notNull().default(true),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const productsRelations = relations(products, ({ many }) => ({
  variants: many(variants),
}));
export const variantsRelations = relations(variants, ({ one, many }) => ({
  product: one(products, { fields: [variants.productId], references: [products.id] }),
  movements: many(stockMovements),
}));
export const ordersRelations = relations(orders, ({ many }) => ({
  items: many(orderItems),
}));
export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  variant: one(variants, { fields: [orderItems.variantId], references: [variants.id] }),
}));
export const stockMovementsRelations = relations(stockMovements, ({ one }) => ({
  variant: one(variants, { fields: [stockMovements.variantId], references: [variants.id] }),
  order: one(orders, { fields: [stockMovements.orderId], references: [orders.id] }),
}));

export type Product = typeof products.$inferSelect;
export type Variant = typeof variants.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type GalleryPhoto = typeof galleryPhotos.$inferSelect;
export type Testimonial = typeof testimonials.$inferSelect;
export type Silhouette = (typeof silhouetteEnum.enumValues)[number];
