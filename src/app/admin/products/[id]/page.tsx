import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { products, variants } from "@/db/schema";
import { stockLevels } from "@/lib/inventory";
import { AddVariantForm, ProductForm, SizeCell } from "../product-form";
import { StockForm } from "../../stock-form";

export default function EditProduct(props: PageProps<"/admin/products/[id]">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded bg-thread/50" />}>
      <Edit {...props} />
    </Suspense>
  );
}

async function Edit({ params }: PageProps<"/admin/products/[id]">) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const p = await db.query.products.findFirst({
    where: eq(products.id, id),
    with: { variants: { orderBy: asc(variants.position) } },
  });
  if (!p) notFound();
  const levels = await stockLevels(p.variants.map((v) => v.id));

  return (
    <>
      <Link href="/admin/products" className="text-sm font-semibold text-ink-soft hover:text-ink">
        All products
      </Link>
      <div className="mb-8 mt-2 flex flex-wrap items-baseline gap-4">
        <h1 className="display text-5xl">{p.name}</h1>
        {p.active && (
          <Link href={`/products/${p.slug}`} className="text-sm font-semibold text-accent underline underline-offset-4">
            View in store
          </Link>
        )}
      </div>
      <ProductForm
        key={p.id}
        initial={{
          id: p.id,
          name: p.name,
          price: p.priceCents / 100,
          description: p.description,
          silhouette: p.silhouette,
          imageUrl: p.imageUrl,
          colorHex: p.colorHex,
          active: p.active,
        }}
      />

      <h2 className="display mt-14 text-3xl">Sizes</h2>
      <div className="mt-4 overflow-x-auto rounded-md border border-thread bg-paper">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-left text-xs text-ink-soft">
            <tr className="border-b border-thread">
              <th className="px-4 py-2 font-semibold">Size</th>
              <th className="px-3 py-2 font-semibold">SKU</th>
              <th className="px-3 py-2 text-right font-semibold">On hand</th>
              <th className="px-3 py-2 text-right font-semibold">Available</th>
              <th className="px-4 py-2 text-right font-semibold">Update stock</th>
            </tr>
          </thead>
          <tbody>
            {p.variants.map((v) => {
              const l = levels.get(v.id)!;
              return (
                <tr key={v.id} className="border-t border-thread/60 align-top">
                  <td className="px-4 py-2">
                    <SizeCell variantId={v.id} size={v.size} />
                  </td>
                  <td className="num px-3 py-2.5 text-xs text-ink-soft">{v.sku}</td>
                  <td className="num px-3 py-2.5 text-right">{l.onHand}</td>
                  <td className="num px-3 py-2.5 text-right">{l.available}</td>
                  <td className="px-4 py-2">
                    <StockForm variantId={v.id} onHand={l.onHand} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-6">
        <AddVariantForm productId={p.id} />
      </div>
    </>
  );
}
