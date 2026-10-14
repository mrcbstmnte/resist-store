import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getOrder } from "@/lib/orders";
import { money } from "@/lib/format";
import { addressLines } from "@/lib/address";

export const metadata: Metadata = { title: "Your order", robots: { index: false } };

export default function OrderPage(props: PageProps<"/orders/[id]">) {
  return (
    <Suspense fallback={<div className="mt-10 h-48 animate-pulse rounded bg-thread/60" />}>
      <Order {...props} />
    </Suspense>
  );
}

const COPY = {
  paid: { title: "Thank you. It's on its way soon.", body: "Payment received. We'll email you when your order ships." },
  pending: {
    title: "Confirming your payment…",
    body: "This usually takes a few seconds. This page refreshes on its own.",
  },
  expired: {
    title: "This checkout expired.",
    body: "We didn't receive payment in time, so the items were released. Nothing was charged.",
  },
  cancelled: { title: "Payment cancelled.", body: "Nothing was charged." },
} as const;

async function Order({ params }: PageProps<"/orders/[id]">) {
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) notFound();
  const copy = COPY[order.displayStatus];

  return (
    <div className="mx-auto max-w-xl pt-10">
      {order.displayStatus === "pending" && <meta httpEquiv="refresh" content="4" />}
      <p className="num text-sm text-ink-soft">Order {order.reference}</p>
      <h1 className="display mt-2 text-5xl sm:text-6xl">{copy.title}</h1>
      <p className="mt-4 text-lg text-ink-soft">{copy.body}</p>

      <ul className="mt-8 divide-y divide-thread border-y border-thread">
        {order.items.map((i) => (
          <li key={i.id} className="num flex justify-between gap-4 py-3">
            <span>
              {i.quantity} × {i.productName}{" "}
              <span className="text-ink-soft">({i.variantLabel})</span>
            </span>
            <span>{money(i.unitPriceCents * i.quantity)}</span>
          </li>
        ))}
        <li className="num flex justify-between py-3 font-semibold">
          <span>Total</span>
          <span>{money(order.totalCents)}</span>
        </li>
      </ul>

      <dl className="mt-6 grid gap-1 text-sm sm:grid-cols-[8rem_1fr]">
        <dt className="text-ink-soft">Deliver to</dt>
        <dd className="whitespace-pre-line">
          {[order.name, ...addressLines(order), order.phone].filter(Boolean).join("\n")}
        </dd>
        <dt className="text-ink-soft">Receipt to</dt>
        <dd>{order.email}</dd>
      </dl>

      <Link href="/#shop" className="btn mt-10">
        Keep shopping
      </Link>
    </div>
  );
}
