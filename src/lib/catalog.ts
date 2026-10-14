import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { products, silhouetteEnum, variants } from "@/db/schema";
import { stockLevels } from "./inventory";
import { sizeRank } from "./format";

export async function getCatalog() {
  const [rows, levels] = await Promise.all([
    db.query.products.findMany({
      where: eq(products.active, true),
      with: { variants: { orderBy: asc(variants.position) } },
      orderBy: asc(products.id),
    }),
    stockLevels(),
  ]);
  return rows.map((p) => decorate(p, levels));
}

export async function getProductBySlug(slug: string) {
  const p = await db.query.products.findFirst({
    where: eq(products.slug, slug),
    with: { variants: { orderBy: asc(variants.position) } },
  });
  if (!p || !p.active) return null;
  const levels = await stockLevels(p.variants.map((v) => v.id));
  return decorate(p, levels);
}

type Raw = NonNullable<Awaited<ReturnType<typeof db.query.products.findFirst<{ with: { variants: true } }>>>>;

function decorate(p: Raw, levels: Awaited<ReturnType<typeof stockLevels>>) {
  const vs = p.variants.map((v) => ({ ...v, available: levels.get(v.id)?.available ?? 0 }));
  const sizes = [...new Set(vs.map((v) => v.size))]
    .sort((a, b) => sizeRank(a) - sizeRank(b))
    .map((size) => ({ size, inStock: vs.some((v) => v.size === size && v.available > 0) }));
  return {
    ...p,
    variants: vs,
    sizes,
    totalAvailable: vs.reduce((s, v) => s + v.available, 0),
  };
}

export type CatalogProduct = Awaited<ReturnType<typeof getCatalog>>[number];

export const SORTS = ["category", "name", "price"] as const;
export type Sort = (typeof SORTS)[number];
export type Direction = "asc" | "desc";

/** Reads ?sort=… from the URL; anything unknown falls back to category. */
export const parseSort = (value: unknown): Sort => (SORTS.includes(value as Sort) ? (value as Sort) : "category");
/** Reads ?dir=… from the URL; ascending unless it says desc. */
export const parseDirection = (value: unknown): Direction => (value === "desc" ? "desc" : "asc");

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "en", { sensitivity: "base" });
// Category order follows the garment list: tops and bottoms first, then caps and bags.
const categoryRank = (s: CatalogProduct["silhouette"]) => silhouetteEnum.enumValues.indexOf(s);

/**
 * Name A–Z, price low to high, or grouped by category; `desc` flips the main order.
 * Ties always fall back to name A–Z, so items within a category or price stay easy to scan.
 */
export function sortCatalog<P extends Pick<CatalogProduct, "name" | "priceCents" | "silhouette">>(
  list: P[],
  sort: Sort,
  direction: Direction = "asc",
) {
  const sign = direction === "desc" ? -1 : 1;
  const primary: (a: P, b: P) => number =
    sort === "name"
      ? byName
      : sort === "price"
        ? (a, b) => a.priceCents - b.priceCents
        : (a, b) => categoryRank(a.silhouette) - categoryRank(b.silhouette);
  return [...list].sort((a, b) => sign * primary(a, b) || byName(a, b));
}
