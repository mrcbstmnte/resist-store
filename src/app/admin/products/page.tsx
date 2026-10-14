import { connection } from "next/server";
import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { productList } from "@/lib/admin-data";
import { money } from "@/lib/format";
import { Garment } from "@/components/garment";

export const metadata: Metadata = { title: "Products" };

export default function ProductsPage() {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="display text-5xl">Products</h1>
        <Link href="/admin/products/new" className="btn">
          Add product
        </Link>
      </div>
      <Suspense fallback={<div className="mt-6 h-96 animate-pulse rounded bg-thread/50" />}>
        <List />
      </Suspense>
    </>
  );
}

async function List() {
  await connection(); // always read live stock, never at build time
  const list = await productList();
  if (list.length === 0) return <p className="mt-8 text-ink-soft">No products yet. Add one to start selling.</p>;
  return (
    <ul className="mt-6 divide-y divide-thread rounded-md border border-thread bg-paper">
      {list.map((p) => (
        <li key={p.id}>
          <Link href={`/admin/products/${p.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-panel">
            {p.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.imageUrl} alt="" className="h-12 w-12 shrink-0 rounded bg-white object-contain" />
            ) : (
              <Garment silhouette={p.silhouette} seed={p.id} color={p.colorHex} className="h-12 w-12 shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {p.name}
                {!p.active && <span className="ml-2 text-xs font-normal text-ink-soft">Hidden from store</span>}
              </p>
              <p className="text-sm text-ink-soft">
                {p.sizes} size{p.sizes === 1 ? "" : "s"}
              </p>
            </div>
            <div className="num text-right text-sm">
              <p>{money(p.priceCents)}</p>
              <p className={p.available === 0 ? "font-semibold text-out" : "text-ink-soft"}>{p.available} available</p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
