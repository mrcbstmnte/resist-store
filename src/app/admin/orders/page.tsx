import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { recentOrders } from "@/lib/admin-data";
import { dateTime, money } from "@/lib/format";
import { STATUS_LABEL, STATUS_STYLE } from "@/lib/order-status";

export const metadata: Metadata = { title: "Orders" };

export default function OrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  return (
    <>
      <h1 className="display text-5xl">Orders</h1>
      <Suspense fallback={<div className="mt-6 h-96 animate-pulse rounded bg-thread/50" />}>
        <Orders searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Orders({ searchParams }: { searchParams: PageProps<"/admin/orders">["searchParams"] }) {
  const sp = await searchParams;
  let list = await recentOrders();
  if (sp.show === "oversold") list = list.filter((o) => o.oversold);
  if (sp.show === "paid") list = list.filter((o) => o.status === "paid");

  if (list.length === 0) {
    return <p className="mt-8 text-ink-soft">No orders yet. They&apos;ll appear here as soon as a shopper checks out.</p>;
  }

  return (
    <div className="mt-6 overflow-x-auto rounded-md border border-thread bg-paper">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="text-left text-xs text-ink-soft">
          <tr className="border-b border-thread">
            <th className="px-4 py-2 font-semibold">Order</th>
            <th className="px-3 py-2 font-semibold">Placed</th>
            <th className="px-3 py-2 font-semibold">Customer</th>
            <th className="px-3 py-2 text-right font-semibold">Items</th>
            <th className="px-3 py-2 text-right font-semibold">Total</th>
            <th className="px-4 py-2 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody>
          {list.map((o) => (
            <tr key={o.id} className="border-t border-thread/60">
              <td className="num px-4 py-2.5 font-semibold">
                <Link href={`/admin/orders/${o.id}`} className="hover:text-accent">
                  {o.reference}
                </Link>
              </td>
              <td className="num px-3 py-2.5 text-ink-soft">{dateTime(o.createdAt)}</td>
              <td className="px-3 py-2.5">
                {o.name} <span className="text-ink-soft">{o.email}</span>
              </td>
              <td className="num px-3 py-2.5 text-right">{o.items.reduce((s, i) => s + i.quantity, 0)}</td>
              <td className="num px-3 py-2.5 text-right">{money(o.totalCents)}</td>
              <td className="px-4 py-2.5">
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[o.status]}`}>
                  {STATUS_LABEL[o.status]}
                </span>
                {o.oversold && <span className="ml-1.5 rounded-full bg-out-bg px-2 py-0.5 text-xs font-semibold text-out">Oversold</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
