"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  galleryPhotos,
  hero,
  orderItems,
  products,
  salesChannels,
  stockMovements,
  storeSettings,
  testimonials,
  variants,
} from "@/db/schema";
import { isAdminAuthorization } from "@/lib/admin-auth";
import { InsufficientStockError, SaleInputError, adjustStock, recordOfflineSale } from "@/lib/inventory";
import { PAYMENT_METHODS, WEBSITE } from "@/lib/sales";
import { money, slugify } from "@/lib/format";
import { MediaError, deleteUpload, photoBackground, saveUpload } from "@/lib/media";
import { getHero } from "@/lib/hero";
import { mailer, sendEmail } from "@/lib/email/send";

export type AdminState = { error?: string; ok?: string } | null;

async function requireAdmin() {
  if (!isAdminAuthorization((await headers()).get("authorization"))) {
    throw new Error("Unauthorized");
  }
}

export async function changeStock(_: AdminState, form: FormData): Promise<AdminState> {
  await requireAdmin();
  const variantId = Number(form.get("variantId"));
  const mode = form.get("mode") === "set" ? "set" : "add";
  const qty = Math.trunc(Number(form.get("quantity")));
  const note = String(form.get("note") ?? "").slice(0, 200);
  if (!Number.isFinite(qty)) return { error: "Enter a number" };

  try {
    if (mode === "add") {
      if (qty === 0) return { error: "Enter how many to add (negative to remove)" };
      const after = await adjustStock(variantId, qty, qty > 0 ? "restock" : "adjustment", note);
      refresh();
      return { ok: `${qty > 0 ? "+" : ""}${qty} → ${after} on hand` };
    }
    if (qty < 0) return { error: "Stock count can't be negative" };
    const [v] = await db.select({ onHand: variants.stockOnHand }).from(variants).where(eq(variants.id, variantId));
    if (!v) return { error: "Variant not found" };
    if (v.onHand === qty) return { ok: "Already correct" };
    await adjustStock(variantId, qty - v.onHand, "adjustment", note || "Stock count");
    refresh();
    return { ok: `Set to ${qty}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't update stock" };
  }
}

// Only http(s): z.url() alone also accepts javascript: and data: links.
const webUrl = () => z.url({ protocol: /^https?$/ });

const SILHOUETTES = ["tee", "hoodie", "jacket", "pants", "shorts", "cap", "bag"] as const;
const pesos = z.coerce
  .number({ error: "Enter a price" })
  .positive("Price must be more than zero")
  .transform((n) => Math.round(n * 100));

const productFields = z.object({
  name: z.string().trim().min(2, "Name is too short"),
  price: pesos,
  description: z.string().trim().max(2000).default(""),
  silhouette: z.enum(SILHOUETTES),
  imageUrl: z
    .string()
    .trim()
    .transform((s) => s || null)
    .pipe(
      z
        .union([z.string().regex(/^\/[\w\-./]+$/), webUrl()], { error: "Use a full URL or a site path like /products/tee.jpg" })
        .nullable(),
    ),
  colorHex: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i, "Pick a drawing colour")
    .transform((s) => s.toUpperCase()),
});

/** An uploaded photo wins over the URL field. Returns the path to store, or an error. */
async function photoFrom(form: FormData, url: string | null): Promise<{ url: string | null } | { error: string }> {
  const file = form.get("photo");
  if (!(file instanceof File) || file.size === 0) return { url };
  try {
    return { url: await saveUpload(file) };
  } catch (e) {
    if (e instanceof MediaError) return { error: e.message };
    throw e;
  }
}

export async function createProduct(_: AdminState, form: FormData): Promise<AdminState> {
  await requireAdmin();
  const parsed = productFields.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const sizes = [...new Set(String(form.get("sizes") ?? "").split(/[,\s]+/).map((s) => s.trim().toUpperCase()).filter(Boolean))];
  const initial = Math.max(0, Math.trunc(Number(form.get("initialStock") ?? 0)) || 0);
  if (!sizes.length) return { error: "Add at least one size" };

  const { name, price, description, silhouette, colorHex } = parsed.data;
  const photo = await photoFrom(form, parsed.data.imageUrl);
  if ("error" in photo) return photo;
  const imageUrl = photo.url;
  const imageBg = await photoBackground(imageUrl);
  let slug = slugify(name);
  const [{ n }] = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM products WHERE slug LIKE ${slug + "%"}`);
  if (n > 0) slug = `${slug}-${n + 1}`;

  const id = await db.transaction(async (tx) => {
    const [p] = await tx
      .insert(products)
      .values({ name, slug, priceCents: price, description, silhouette, imageUrl, imageBg, colorHex })
      .returning();
    const prefix = slug.toUpperCase().replace(/-/g, "").slice(0, 8);
    for (const [position, size] of sizes.entries()) {
      const [v] = await tx
        .insert(variants)
        .values({
          productId: p.id,
          sku: `${prefix}-${size}-${p.id}`,
          size,
          position,
          stockOnHand: initial,
        })
        .returning();
      if (initial > 0) {
        await tx.insert(stockMovements).values({
          variantId: v.id,
          delta: initial,
          balanceAfter: initial,
          reason: "initial",
          note: "Opening stock",
        });
      }
    }
    return p.id;
  });
  redirect(`/admin/products/${id}`);
}

export async function updateProduct(_: AdminState, form: FormData): Promise<AdminState> {
  await requireAdmin();
  const id = Number(form.get("id"));
  const parsed = productFields.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, price, description, silhouette, colorHex } = parsed.data;
  const before = await db.query.products.findFirst({ where: eq(products.id, id), columns: { imageUrl: true } });
  if (!before) return { error: "Product not found" };
  const photo = await photoFrom(form, parsed.data.imageUrl);
  if ("error" in photo) return photo;
  const imageUrl = photo.url;
  const imageBg = await photoBackground(imageUrl);
  await db
    .update(products)
    .set({ name, priceCents: price, description, silhouette, imageUrl, imageBg, colorHex, active: form.get("active") === "on" })
    .where(eq(products.id, id));
  // Drop the old upload once nothing points at it.
  if (before.imageUrl !== imageUrl) await deleteUpload(before.imageUrl);
  refresh();
  return { ok: "Saved" };
}

export async function addVariant(_: AdminState, form: FormData): Promise<AdminState> {
  await requireAdmin();
  const productId = Number(form.get("productId"));
  const size = String(form.get("size") ?? "").trim().toUpperCase();
  const stock = Math.max(0, Math.trunc(Number(form.get("stock") ?? 0)) || 0);
  if (!size) return { error: "Enter a size" };
  const p = await db.query.products.findFirst({ where: eq(products.id, productId) });
  if (!p) return { error: "Product not found" };
  try {
    await db.transaction(async (tx) => {
      const [{ max }] = await tx.execute<{ max: number }>(
        sql`SELECT coalesce(max(position), -1)::int AS max FROM variants WHERE product_id = ${productId}`,
      );
      const [v] = await tx
        .insert(variants)
        .values({
          productId,
          sku: `${p.slug.toUpperCase().replace(/-/g, "").slice(0, 8)}-${size}-${p.id}`,
          size,
          position: max + 1,
          stockOnHand: stock,
        })
        .returning();
      if (stock > 0) {
        await tx.insert(stockMovements).values({
          variantId: v.id,
          delta: stock,
          balanceAfter: stock,
          reason: "initial",
          note: "Opening stock",
        });
      }
    });
  } catch {
    return { error: `Size ${size} already exists` };
  }
  refresh();
  return { ok: `Added size ${size}` };
}

export async function renameSize(_: AdminState, form: FormData): Promise<AdminState> {
  await requireAdmin();
  const variantId = Number(form.get("variantId"));
  const size = String(form.get("size") ?? "").trim().toUpperCase();
  if (!size) return { error: "Enter a size" };
  const v = await db.query.variants.findFirst({ where: eq(variants.id, variantId) });
  if (!v) return { error: "Size not found" };
  if (v.size === size) return null;
  try {
    await db.update(variants).set({ size }).where(eq(variants.id, variantId));
  } catch {
    return { error: `Size ${size} already exists` };
  }
  refresh();
  return { ok: `Renamed to ${size}` };
}

export async function removeSize(_: AdminState, form: FormData): Promise<AdminState> {
  await requireAdmin();
  const variantId = Number(form.get("variantId"));
  // Past orders point at the variant, so a size that has sold can't be deleted.
  const [ordered] = await db.select({ id: orderItems.id }).from(orderItems).where(eq(orderItems.variantId, variantId)).limit(1);
  if (ordered) return { error: "This size has orders, so it can't be removed. Count it to 0 instead." };
  await db.delete(variants).where(eq(variants.id, variantId));
  refresh();
  return null;
}

// ── Gallery ─────────────────────────────────────────────────────────────────

/** One photo per call, so each request stays well under host body-size limits. */
export async function addGalleryPhoto(form: FormData): Promise<AdminState> {
  await requireAdmin();
  const file = form.get("photo");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a photo" };
  let imageUrl: string;
  try {
    imageUrl = await saveUpload(file);
  } catch (e) {
    if (e instanceof MediaError) return { error: `${file.name}: ${e.message}` };
    throw e;
  }
  await db.insert(galleryPhotos).values({
    imageUrl,
    alt: String(form.get("alt") ?? "").trim().slice(0, 300),
    position: sql`(SELECT coalesce(max(position), -1) + 1 FROM gallery_photos)`,
  });
  refresh();
  return { ok: "Added" };
}

export async function updateGalleryAlt(_: AdminState, form: FormData): Promise<AdminState> {
  await requireAdmin();
  const alt = String(form.get("alt") ?? "").trim().slice(0, 300);
  await db.update(galleryPhotos).set({ alt }).where(eq(galleryPhotos.id, Number(form.get("id"))));
  refresh();
  return { ok: "Saved" };
}

export async function removeGalleryPhoto(_: AdminState, form: FormData): Promise<AdminState> {
  await requireAdmin();
  const [row] = await db.delete(galleryPhotos).where(eq(galleryPhotos.id, Number(form.get("id")))).returning();
  if (row) await deleteUpload(row.imageUrl);
  refresh();
  return null;
}

// ── Testimonials ────────────────────────────────────────────────────────────

const testimonialFields = z.object({
  quote: z.string().trim().min(3, "Add the quote").max(600, "Keep the quote under 600 characters"),
  name: z.string().trim().min(1, "Add a name").max(80),
  detail: z.string().trim().max(120).default(""),
});

export async function addTestimonial(_: AdminState, form: FormData): Promise<AdminState> {
  await requireAdmin();
  const parsed = testimonialFields.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await db.insert(testimonials).values({
    ...parsed.data,
    position: sql`(SELECT coalesce(max(position), -1) + 1 FROM testimonials)`,
  });
  refresh();
  return { ok: "Added" };
}

export async function updateTestimonial(_: AdminState, form: FormData): Promise<AdminState> {
  await requireAdmin();
  const parsed = testimonialFields.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await db
    .update(testimonials)
    .set({ ...parsed.data, visible: form.get("visible") === "on" })
    .where(eq(testimonials.id, Number(form.get("id"))));
  refresh();
  return { ok: "Saved" };
}

export async function removeTestimonial(_: AdminState, form: FormData): Promise<AdminState> {
  await requireAdmin();
  await db.delete(testimonials).where(eq(testimonials.id, Number(form.get("id"))));
  refresh();
  return null;
}

// ── Hero banner ─────────────────────────────────────────────────────────────

const heroFields = z.object({
  headline: z.string().trim().min(1, "Add a headline").max(80, "Keep the headline under 80 characters"),
  subhead: z.string().trim().max(200, "Keep the line under the headline short (200 characters max)"),
  ctaLabel: z.string().trim().max(40, "Keep the button text short"),
  ctaHref: z
    .string()
    .trim()
    .transform((s) => s || "#shop")
    .pipe(
      z.union([z.string().regex(/^[#/][\w\-./?=&#]*$/), webUrl()], {
        error: "Button link must be #shop, a site path like /products/tee, or a full URL",
      }),
    ),
  imageUrl: productFields.shape.imageUrl,
  alt: z.string().trim().max(300),
});

export async function updateHero(_: AdminState, form: FormData): Promise<AdminState> {
  await requireAdmin();
  const parsed = heroFields.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const file = form.get("photo");
  const hasPhoto = Boolean(parsed.data.imageUrl) || (file instanceof File && file.size > 0);
  // Checked before uploading, so a rejected save doesn't leave an orphaned photo behind.
  if (hasPhoto && !parsed.data.alt) return { error: "Describe the photo for people using screen readers" };
  const before = await getHero();
  const photo = await photoFrom(form, parsed.data.imageUrl);
  if ("error" in photo) return photo;
  const values = { ...parsed.data, imageUrl: photo.url, updatedAt: new Date() };
  await db.insert(hero).values({ id: 1, ...values }).onConflictDoUpdate({ target: hero.id, set: values });
  if (before.imageUrl !== values.imageUrl) await deleteUpload(before.imageUrl);
  refresh();
  return { ok: "Saved" };
}

// ── Email ───────────────────────────────────────────────────────────────────

/** Sends a short test message, so the mailer can be checked without a real order. */
export async function sendTestEmail(_: AdminState, form: FormData): Promise<AdminState> {
  await requireAdmin();
  const to = z.email().safeParse(String(form.get("to") ?? "").trim());
  if (!to.success) return { error: "Enter an email address" };
  const via = mailer();
  if (!via) return { error: "No mailer is set up yet. Add GMAIL_USER and GMAIL_APP_PASSWORD, then redeploy." };
  try {
    await sendEmail({
      to: to.data,
      subject: "RESIST test email",
      text: "If you can read this, order confirmation emails are working.",
      html: "<p>If you can read this, order confirmation emails are working.</p>",
    });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    if (/535|Username and Password not accepted|Invalid login/i.test(detail)) {
      return { error: "Gmail rejected the login. Check GMAIL_USER and that GMAIL_APP_PASSWORD is an app password, not your normal password." };
    }
    return { error: `Couldn't send: ${detail.slice(0, 200)}` };
  }
  return { ok: `Sent to ${to.data} via ${via === "gmail" ? "Gmail" : "Resend"}. Check that inbox (and spam).` };
}

// ── Shipping ────────────────────────────────────────────────────────────────

// Empty means free; z.coerce would also turn "" into 0, but say so explicitly.
const shippingFee = z.preprocess(
  (v) => (String(v ?? "").trim() === "" ? 0 : Number(v)),
  z
    .number({ error: "Enter the fee in pesos, e.g. 120" })
    .min(0, "The fee can't be negative")
    .max(10000, "That fee looks too high (₱10,000 max)")
    .transform((n) => Math.round(n * 100)),
);

/** Applies to orders placed from now on; existing orders keep the fee they were charged. */
export async function updateShippingFee(_: AdminState, form: FormData): Promise<AdminState> {
  await requireAdmin();
  const parsed = shippingFee.safeParse(String(form.get("fee") ?? ""));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const values = { shippingFeeCents: parsed.data, updatedAt: new Date() };
  await db.insert(storeSettings).values({ id: 1, ...values }).onConflictDoUpdate({ target: storeSettings.id, set: values });
  refresh();
  return { ok: parsed.data ? `Saved. New orders pay ${money(parsed.data)} shipping.` : "Saved. Shipping is now free." };
}

// ── Offline sales and channels ──────────────────────────────────────────────

const optionalPesos = (label: string) =>
  z.preprocess(
    (v) => (String(v ?? "").trim() === "" ? undefined : Number(v)),
    z
      .number({ error: `Enter the ${label} in pesos` })
      .min(0, `The ${label} can't be negative`)
      .transform((n) => Math.round(n * 100))
      .optional(),
  );

const saleFields = z.object({
  channelId: z.coerce.number({ error: "Pick where the sale happened" }).int().positive("Pick where the sale happened"),
  paymentMethod: z.enum(PAYMENT_METHODS, { error: "Pick how they paid" }),
  amount: optionalPesos("amount paid"),
  shipping: optionalPesos("shipping"),
  customerName: z.string().trim().max(80).default(""),
  phone: z.string().trim().max(30).default(""),
  note: z.string().trim().max(300).default(""),
  soldOn: z.string().trim().default(""),
});

/** "2026-10-14" → a time on that day in Manila; today means right now. Future dates are refused. */
function soldAtFrom(day: string): Date | { error: string } {
  if (!day) return new Date();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { error: "Pick the date of the sale" };
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
  if (day > today) return { error: "The sale date can't be in the future" };
  if (day === today) return new Date();
  const at = new Date(`${day}T12:00:00+08:00`);
  return Number.isNaN(at.getTime()) ? { error: "Pick the date of the sale" } : at;
}

export async function recordSale(_: AdminState, form: FormData): Promise<AdminState> {
  await requireAdmin();
  const parsed = saleFields.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const variantIds = form.getAll("variantId").map(Number);
  const quantities = form.getAll("quantity").map(Number);
  const lines = variantIds
    .map((variantId, i) => ({ variantId, quantity: quantities[i] }))
    .filter((l) => l.variantId > 0);
  const soldAt = soldAtFrom(parsed.data.soldOn);
  if ("error" in soldAt) return soldAt;

  let result;
  try {
    result = await recordOfflineSale({
      channelId: parsed.data.channelId,
      lines,
      paymentMethod: parsed.data.paymentMethod,
      amountCents: parsed.data.amount,
      shippingCents: parsed.data.shipping,
      customerName: parsed.data.customerName,
      phone: parsed.data.phone,
      note: parsed.data.note,
      soldAt,
    });
  } catch (e) {
    if (e instanceof SaleInputError) return { error: e.message };
    if (e instanceof InsufficientStockError) {
      const names = await db.query.variants.findMany({
        where: inArray(variants.id, e.shortages.map((s) => s.variantId)),
        with: { product: true },
      });
      return {
        error: e.shortages
          .map((s) => {
            const v = names.find((n) => n.id === s.variantId);
            return `${v ? `${v.product.name} (size ${v.size})` : "An item"}: only ${s.available} on hand`;
          })
          .join("; ")
          .concat(". If the shelf count is wrong, fix it on the Stock page first."),
      };
    }
    throw e;
  }
  redirect(`/admin/orders/${result.order.id}?recorded=1`);
}

const channelName = z.string().trim().min(1, "Give the channel a name").max(40, "Keep the name under 40 characters");

async function nameTaken(name: string, exceptId?: number) {
  const [row] = await db
    .select({ id: salesChannels.id })
    .from(salesChannels)
    .where(sql`lower(${salesChannels.name}) = lower(${name})`);
  return Boolean(row && row.id !== exceptId) || name.toLowerCase() === WEBSITE.toLowerCase();
}

export async function addChannel(_: AdminState, form: FormData): Promise<AdminState> {
  await requireAdmin();
  const name = channelName.safeParse(form.get("name"));
  if (!name.success) return { error: name.error.issues[0].message };
  if (await nameTaken(name.data)) return { error: `There's already a channel called ${name.data}` };
  await db.insert(salesChannels).values({
    name: name.data,
    position: sql`(SELECT coalesce(max(position), -1) + 1 FROM sales_channels)`,
  });
  refresh();
  return { ok: `Added ${name.data}` };
}

/** Renames a channel or hides it from the Record sale form. Past sales keep their channel either way. */
export async function updateChannel(_: AdminState, form: FormData): Promise<AdminState> {
  await requireAdmin();
  const id = Number(form.get("id"));
  const name = channelName.safeParse(form.get("name"));
  if (!name.success) return { error: name.error.issues[0].message };
  if (await nameTaken(name.data, id)) return { error: `There's already a channel called ${name.data}` };
  await db
    .update(salesChannels)
    .set({ name: name.data, active: form.get("active") === "on" })
    .where(eq(salesChannels.id, id));
  refresh();
  return { ok: "Saved" };
}
