import Link from "next/link";
import { Suspense } from "react";
import { inventoryOverview, type StockFilter } from "@/lib/admin-data";
import { money } from "@/lib/format";
import { StockForm } from "./stock-form";

export default function StockPage({ searchParams }: PageProps<"/admin">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded bg-thread/50" />}>
      <Stock searchParams={searchParams} />
    </Suspense>
  );
}

const FILTERS: { key: StockFilter; label: string }[] = [
  { key: "all", label: "All variants" },
  { key: "low", label: "Running low" },
  { key: "out", label: "Sold out" },
];

async function Stock({ searchParams }: { searchParams: PageProps<"/admin">["searchParams"] }) {
  const sp = await searchParams;
  const filter: StockFilter = sp.show === "low" || sp.show === "out" ? sp.show : "all";
  const { groups, totals, orders } = await inventoryOverview(filter);

  const stats = [
    { label: "Units on hand", value: totals.onHand.toLocaleString() },
    { label: "Held in open checkouts", value: totals.reserved.toLocaleString() },
    { label: "Running low", value: totals.low, tone: totals.low ? "text-low" : "" },
    { label: "Sold out", value: totals.out, tone: totals.out ? "text-out" : "" },
    { label: `Paid today (${orders.paid_today} order${orders.paid_today === 1 ? "" : "s"})`, value: money(orders.revenue_today) },
  ];

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="display text-5xl">Stock</h1>
        <p className="text-sm text-ink-soft">
          Available = on hand − held. Held units return automatically when a checkout expires.
        </p>
      </div>

      {orders.oversold > 0 && (
        <p role="alert" className="mt-6 rounded-md bg-out-bg px-4 py-3 text-sm font-semibold text-out">
          {orders.oversold} paid order{orders.oversold > 1 ? "s were" : " was"} paid after its hold expired and the units
          had sold. <Link href="/admin/orders?show=oversold" className="underline underline-offset-4">Review oversold orders</Link>
        </p>
      )}

      <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-thread bg-thread sm:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className="bg-paper px-4 py-3">
            <dt className="text-xs text-ink-soft">{s.label}</dt>
            <dd className={`num mt-1 text-xl font-semibold ${s.tone ?? ""}`}>{s.value}</dd>
          </div>
        ))}
      </dl>

      <nav className="mt-8 flex flex-wrap gap-2" aria-label="Filter variants">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === "all" ? "/admin" : `/admin?show=${f.key}`}
            aria-current={filter === f.key ? "page" : undefined}
            className={`rounded-full border px-3 py-1 text-sm font-semibold ${
              filter === f.key ? "border-ink bg-ink text-paper" : "border-thread bg-paper hover:border-ink"
            }`}
          >
            {f.label}
            {f.key === "low" && ` (${totals.low})`}
            {f.key === "out" && ` (${totals.out})`}
          </Link>
        ))}
      </nav>

      {groups.length === 0 ? (
        <p className="mt-10 text-ink-soft">
          {filter === "all" ? (
            <>
              No products yet. <Link href="/admin/products/new" className="font-semibold text-accent underline">Add your first product</Link>.
            </>
          ) : (
            "Nothing here — every variant is above its low-stock line."
          )}
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-md border border-thread bg-paper">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-left text-xs text-ink-soft">
              <tr className="border-b border-thread">
                <th className="px-4 py-2 font-semibold">Size</th>
                <th className="px-3 py-2 font-semibold">SKU</th>
                <th className="px-3 py-2 text-right font-semibold">On hand</th>
                <th className="px-3 py-2 text-right font-semibold">Held</th>
                <th className="px-3 py-2 text-right font-semibold">Available</th>
                <th className="px-4 py-2 text-right font-semibold">Update stock</th>
              </tr>
            </thead>
            {groups.map(({ product, rows }) => (
              <tbody key={product.id} className="border-b border-thread last:border-0">
                <tr className="bg-panel">
                  <th colSpan={6} className="px-4 py-2 text-left">
                    <Link href={`/admin/products/${product.id}`} className="font-semibold hover:text-accent">
                      {product.name}
                    </Link>
                    {!product.active && <span className="ml-2 text-xs font-normal text-ink-soft">Hidden from store</span>}
                  </th>
                </tr>
                {rows.map((r) => (
                  <tr key={r.variant.id} className="border-t border-thread/60 align-top">
                    <td className="px-4 py-2.5">
                      {r.variant.size}
                    </td>
                    <td className="num px-3 py-2.5 text-xs text-ink-soft">{r.variant.sku}</td>
                    <td className="num px-3 py-2.5 text-right">{r.onHand}</td>
                    <td className="num px-3 py-2.5 text-right text-ink-soft">{r.reserved || "–"}</td>
                    <td className="num px-3 py-2.5 text-right">
                      <span
                        className={`inline-block min-w-9 rounded-full px-2 py-0.5 text-center font-semibold ${
                          r.state === "out" ? "bg-out-bg text-out" : r.state === "low" ? "bg-low-bg text-low" : ""
                        }`}
                        title={r.state === "low" ? `At or below ${r.variant.lowStockThreshold}` : undefined}
                      >
                        {r.available}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <StockForm variantId={r.variant.id} onHand={r.onHand} />
                    </td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      )}
    </>
  );
}
