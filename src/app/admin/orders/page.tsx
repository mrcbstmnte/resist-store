import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { recentOrders } from "@/lib/admin-data";
import { dateTime, money } from "@/lib/format";
import { STATUS_LABEL, STATUS_STYLE } from "@/lib/order-status";
import { mailer } from "@/lib/email/send";
import { EmailCheck } from "./email-check";
import { listChannels, salesByChannel, WEBSITE } from "@/lib/sales";

export const metadata: Metadata = { title: "Orders" };

export default function OrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="display text-5xl">Orders</h1>
        <div className="flex items-center gap-4">
          <Link href="/admin/channels" className="text-sm font-semibold text-ink-soft underline underline-offset-2 hover:text-ink">
            Channels
          </Link>
          <Link href="/admin/orders/new" className="btn">
            Record a sale
          </Link>
        </div>
      </div>
      <Suspense fallback={<div className="mt-6 h-96 animate-pulse rounded bg-thread/50" />}>
        <Orders searchParams={searchParams} />
      </Suspense>
      <EmailCheck via={mailer()} defaultTo={process.env.GMAIL_USER?.trim() ?? ""} />
    </>
  );
}

async function Orders({ searchParams }: { searchParams: PageProps<"/admin/orders">["searchParams"] }) {
  const sp = await searchParams;
  const [all, channels, summary] = await Promise.all([recentOrders(), listChannels(), salesByChannel(30)]);
  let list = all;
  if (sp.show === "oversold") list = list.filter((o) => o.oversold);
  if (sp.show === "paid") list = list.filter((o) => o.status === "paid");
  const channel = typeof sp.channel === "string" ? sp.channel : "";
  if (channel === "website") list = list.filter((o) => o.channelId === null);
  else if (channel) list = list.filter((o) => String(o.channelId) === channel);

  const filters = [
    { value: "", label: "All" },
    { value: "website", label: WEBSITE },
    ...channels.map((c) => ({ value: String(c.id), label: c.name })),
  ];

  return (
    <>
      <SalesSummary rows={summary} />
      <nav aria-label="Filter by channel" className="mt-6 flex flex-wrap gap-2 text-sm">
        {filters.map((f) => (
          <Link
            key={f.value}
            href={f.value ? `/admin/orders?channel=${f.value}` : "/admin/orders"}
            aria-current={f.value === channel ? "page" : undefined}
            className="rounded-full border border-thread px-3 py-1 font-semibold hover:border-ink aria-[current]:border-ink aria-[current]:bg-ink aria-[current]:text-paper"
          >
            {f.label}
          </Link>
        ))}
      </nav>
      {list.length === 0 ? (
        <p className="mt-6 text-ink-soft">
          {all.length === 0 ? "No orders yet. Website orders and sales you record will appear here." : "No orders from this channel yet."}
        </p>
      ) : (
        <OrderTable list={list} />
      )}
    </>
  );
}

function SalesSummary({ rows }: { rows: Awaited<ReturnType<typeof salesByChannel>> }) {
  const total = rows.reduce((s, r) => s + r.revenueCents, 0);
  return (
    <section aria-labelledby="summary-title" className="mt-6">
      <h2 id="summary-title" className="text-sm font-semibold text-ink-soft">
        Paid sales, last 30 days
      </h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-ink-soft">None yet.</p>
      ) : (
        <ul className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {rows.map((r) => (
            <li key={r.channelId ?? "website"} className="rounded-md border border-thread bg-paper p-3">
              <p className="text-sm font-semibold">{r.name}</p>
              <p className="num mt-1 text-xl font-bold">{money(r.revenueCents)}</p>
              <p className="num text-xs text-ink-soft">
                {r.units} unit{r.units === 1 ? "" : "s"} · {r.orders} order{r.orders === 1 ? "" : "s"}
                {total > 0 && ` · ${Math.round((r.revenueCents / total) * 100)}%`}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function OrderTable({ list }: { list: Awaited<ReturnType<typeof recentOrders>> }) {
  return (
    <div className="mt-4 overflow-x-auto rounded-md border border-thread bg-paper">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="text-left text-xs text-ink-soft">
          <tr className="border-b border-thread">
            <th className="px-4 py-2 font-semibold">Order</th>
            <th className="px-3 py-2 font-semibold">Date</th>
            <th className="px-3 py-2 font-semibold">Channel</th>
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
              <td className="num px-3 py-2.5 text-ink-soft">{dateTime(o.channelId ? (o.paidAt ?? o.createdAt) : o.createdAt)}</td>
              <td className="px-3 py-2.5">
                {o.channel?.name ?? WEBSITE}
                {o.recordedBy && <span className="block text-xs text-ink-soft">by {o.recordedBy}</span>}
              </td>
              <td className="px-3 py-2.5">
                {o.name} <span className="text-ink-soft">{o.email || o.phone}</span>
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
