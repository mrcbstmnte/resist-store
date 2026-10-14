"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { galleryPhotos, orderItems, products, stockMovements, testimonials, variants } from "@/db/schema";
import { isAdminAuthorization } from "@/lib/admin-auth";
import { adjustStock } from "@/lib/inventory";
import { slugify } from "@/lib/format";
import { MediaError, deleteUpload, saveUpload } from "@/lib/media";

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
        .union([z.string().regex(/^\/[\w\-./]+$/), z.url()], { error: "Use a full URL or a site path like /products/tee.jpg" })
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
  let slug = slugify(name);
  const [{ n }] = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM products WHERE slug LIKE ${slug + "%"}`);
  if (n > 0) slug = `${slug}-${n + 1}`;

  const id = await db.transaction(async (tx) => {
    const [p] = await tx
      .insert(products)
      .values({ name, slug, priceCents: price, description, silhouette, imageUrl, colorHex })
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
  await db
    .update(products)
    .set({ name, priceCents: price, description, silhouette, imageUrl, colorHex, active: form.get("active") === "on" })
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
