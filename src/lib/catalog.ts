import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { products, variants } from "@/db/schema";
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
