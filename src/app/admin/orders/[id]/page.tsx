import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getOrder } from "@/lib/orders";
import { dateTime, money } from "@/lib/format";
import { addressLines } from "@/lib/address";
import { STATUS_LABEL, STATUS_STYLE } from "@/lib/order-status";
import { stockLevels } from "@/lib/inventory";
import { WEBSITE } from "@/lib/sales";

export default function AdminOrder(props: PageProps<"/admin/orders/[id]">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded bg-thread/50" />}>
      <Detail {...props} />
    </Suspense>
  );
}

async function Detail({ params, searchParams }: PageProps<"/admin/orders/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const o = await getOrder(id);
  if (!o) notFound();
  const offline = o.channelId !== null;
  const address = addressLines(o).filter(Boolean);
  // Right after recording a sale: flag sizes where website checkouts now hold more than is left.
  const levels = sp.recorded ? await stockLevels(o.items.map((i) => i.variantId)) : null;
  const overHeld = levels ? o.items.filter((i) => (levels.get(i.variantId)?.reserved ?? 0) > (levels.get(i.variantId)?.onHand ?? 0)) : [];
  return (
    <div className="max-w-3xl">
      <Link href="/admin/orders" className="text-sm font-semibold text-ink-soft hover:text-ink">
        All orders
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="display num text-5xl">{o.reference}</h1>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[o.displayStatus]}`}>
          {STATUS_LABEL[o.displayStatus]}
        </span>
        {o.oversold && (
          <span className="rounded-full bg-out-bg px-2.5 py-1 text-xs font-semibold text-out">Oversold</span>
        )}
      </div>
      {sp.recorded && (
        <p role="status" className="mt-4 rounded-md bg-paper px-4 py-3 text-sm font-semibold text-ok">
          Sale recorded. The items are off the shelf.{" "}
          <Link href="/admin/orders/new" className="underline underline-offset-2">
            Record another
          </Link>
        </p>
      )}
      {overHeld.length > 0 && (
        <p className="mt-4 rounded-md bg-low-bg px-4 py-3 text-sm text-low">
          A website checkout in progress is holding more than is now left of{" "}
          {overHeld.map((i) => `${i.productName} (${i.variantLabel})`).join(", ")}. If that shopper pays, the order will be
          marked oversold.
        </p>
      )}
      {o.oversold && (
        <p className="mt-4 rounded-md bg-out-bg px-4 py-3 text-sm text-out">
          Payment arrived after this order&apos;s hold expired, and some units had already sold. Stock for those variants is
          below zero. Restock them or refund the customer from the PayMongo dashboard.
        </p>
      )}

      <dl className="mt-6 grid gap-x-6 gap-y-2 rounded-md border border-thread bg-paper p-4 text-sm sm:grid-cols-[9rem_1fr]">
        <dt className="text-ink-soft">Channel</dt>
        <dd>{o.channel?.name ?? WEBSITE}</dd>
        <dt className="text-ink-soft">{offline ? "Recorded" : "Placed"}</dt>
        <dd className="num">{dateTime(o.createdAt)}</dd>
        {o.paidAt && (
          <>
            <dt className="text-ink-soft">Paid</dt>
            <dd className="num">{dateTime(o.paidAt)}</dd>
          </>
        )}
        {o.displayStatus === "pending" && (
          <>
            <dt className="text-ink-soft">Hold expires</dt>
            <dd className="num">{dateTime(o.expiresAt)}</dd>
          </>
        )}
        <dt className="text-ink-soft">Customer</dt>
        <dd>
          {o.name}
          {o.email && (
            <>
              , <a href={`mailto:${o.email}`} className="underline underline-offset-2">{o.email}</a>
            </>
          )}
          {o.phone && `, ${o.phone}`}
        </dd>
        {address.length > 0 && (
          <>
            <dt className="text-ink-soft">Ship to</dt>
            <dd className="whitespace-pre-line">{address.join("\n")}</dd>
          </>
        )}
        {offline ? (
          <>
            <dt className="text-ink-soft">Paid with</dt>
            <dd>{o.paymentMethod}</dd>
          </>
        ) : (
          <>
            <dt className="text-ink-soft">PayMongo session</dt>
            <dd className="num break-all text-xs">{o.checkoutSessionId ?? "None (test payment)"}</dd>
          </>
        )}
        {o.note && (
          <>
            <dt className="text-ink-soft">Note</dt>
            <dd>{o.note}</dd>
          </>
        )}
      </dl>

      <table className="mt-6 w-full rounded-md border border-thread bg-paper text-sm">
        <thead className="text-left text-xs text-ink-soft">
          <tr className="border-b border-thread">
            <th className="px-4 py-2 font-semibold">Item</th>
            <th className="px-3 py-2 font-semibold">SKU</th>
            <th className="px-3 py-2 text-right font-semibold">Qty</th>
            <th className="px-4 py-2 text-right font-semibold">Total</th>
          </tr>
        </thead>
        <tbody>
          {o.items.map((i) => (
            <tr key={i.id} className="border-t border-thread/60">
              <td className="px-4 py-2.5">
                {i.productName} <span className="text-ink-soft">({i.variantLabel})</span>
              </td>
              <td className="num px-3 py-2.5 text-xs text-ink-soft">{i.variant.sku}</td>
              <td className="num px-3 py-2.5 text-right">{i.quantity}</td>
              <td className="num px-4 py-2.5 text-right">{money(i.unitPriceCents * i.quantity)}</td>
            </tr>
          ))}
          <tr className="border-t border-thread">
            <td className="px-4 py-2.5" colSpan={3}>
              Shipping
            </td>
            <td className="num px-4 py-2.5 text-right">{o.shippingCents ? money(o.shippingCents) : "Free"}</td>
          </tr>
          {o.discountCents > 0 && (
            <tr className="border-t border-thread">
              <td className="px-4 py-2.5" colSpan={3}>
                Discount
              </td>
              <td className="num px-4 py-2.5 text-right">−{money(o.discountCents)}</td>
            </tr>
          )}
          <tr className="border-t border-thread font-semibold">
            <td className="px-4 py-2.5" colSpan={3}>
              Total
            </td>
            <td className="num px-4 py-2.5 text-right">{money(o.totalCents)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
