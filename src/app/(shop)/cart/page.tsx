import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { cartDetails } from "@/lib/cart";
import { money } from "@/lib/format";
import { setCartQuantity } from "@/app/actions";
import { Garment } from "@/components/garment";
import { paymentMode } from "@/lib/paymongo";
import { RESERVATION_MINUTES } from "@/lib/inventory";
import { CheckoutForm } from "./checkout-form";

export const metadata: Metadata = { title: "Bag" };

export default function CartPage({ searchParams }: PageProps<"/cart">) {
  return (
    <div className="pt-6">
      <h1 className="display text-6xl">Your bag</h1>
      <Suspense fallback={<div className="mt-8 h-48 animate-pulse rounded bg-thread/60" />}>
        <Cart searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Cart({ searchParams }: { searchParams: PageProps<"/cart">["searchParams"] }) {
  const [{ lines, subtotalCents, count }, sp] = await Promise.all([cartDetails(), searchParams]);
  const cancelled = sp.payment === "cancelled";

  if (lines.length === 0) {
    return (
      <div className="mt-8 max-w-md">
        <p className="text-lg text-ink-soft">Nothing in here yet.</p>
        <Link href="/#shop" className="btn mt-6">
          Browse the range
        </Link>
      </div>
    );
  }

  const blocked = lines.some((l) => l.quantity > l.available);

  return (
    <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_24rem]">
      <section aria-label="Items">
        {cancelled && (
          <p role="status" className="mb-6 rounded-md bg-low-bg px-4 py-3 text-sm font-semibold text-low">
            Payment was cancelled, so nothing was charged. Your bag is just as you left it.
          </p>
        )}
        <ul className="divide-y divide-thread border-y border-thread">
          {lines.map((l) => {
            const over = l.quantity > l.available;
            return (
              <li key={l.variant.id} className="flex gap-4 py-5">
                <Link
                  href={`/products/${l.product.slug}`}
                  className={`relative aspect-[4/5] w-24 shrink-0 overflow-hidden rounded-[3px] ${l.product.imageUrl ? "bg-white" : "track"}`}
                >
                  {l.product.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={l.product.imageUrl} alt="" className="h-full w-full object-contain" />
                  ) : (
                    <Garment silhouette={l.product.silhouette} color={l.product.colorHex} seed={l.product.id} className="absolute inset-[10%] -rotate-6" />
                  )}
                </Link>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 className="font-semibold">{l.product.name}</h2>
                    <span className="num">{money(l.lineCents)}</span>
                  </div>
                  <p className="text-sm text-ink-soft">
                    Size {l.variant.size}
                  </p>
                  {over && (
                    <p className="mt-1 text-sm font-semibold text-out">
                      {l.available === 0 ? "Sold out — remove to continue." : `Only ${l.available} left — lower the quantity.`}
                    </p>
                  )}
                  <div className="mt-auto flex items-center gap-3 pt-3">
                    <QtyButton variantId={l.variant.id} to={l.quantity - 1} label="Decrease quantity">
                      −
                    </QtyButton>
                    <span className="num w-6 text-center font-semibold" aria-label="Quantity">
                      {l.quantity}
                    </span>
                    <QtyButton
                      variantId={l.variant.id}
                      to={l.quantity + 1}
                      label="Increase quantity"
                      disabled={l.quantity >= l.available}
                    >
                      +
                    </QtyButton>
                    <form action={setCartQuantity} className="ml-auto">
                      <input type="hidden" name="variantId" value={l.variant.id} />
                      <input type="hidden" name="quantity" value="0" />
                      <button className="text-sm text-ink-soft underline underline-offset-4 hover:text-ink">Remove</button>
                    </form>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <aside className="h-fit rounded-md bg-panel p-5 lg:sticky lg:top-6">
        <dl className="num space-y-2 text-sm">
          <div className="flex justify-between">
            <dt>Items</dt>
            <dd>{count}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Shipping</dt>
            <dd>Free</dd>
          </div>
          <div className="flex justify-between border-t border-thread pt-3 text-lg font-semibold">
            <dt>Total</dt>
            <dd>{money(subtotalCents)}</dd>
          </div>
        </dl>
        <CheckoutForm disabled={blocked || paymentMode() === "off"} total={money(subtotalCents)} mode={paymentMode()}
          holdMinutes={RESERVATION_MINUTES}
        />
      </aside>
    </div>
  );
}

function QtyButton({
  variantId,
  to,
  label,
  disabled,
  children,
}: {
  variantId: number;
  to: number;
  label: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <form action={setCartQuantity}>
      <input type="hidden" name="variantId" value={variantId} />
      <input type="hidden" name="quantity" value={to} />
      <button
        aria-label={label}
        disabled={disabled}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-thread bg-paper font-semibold hover:border-ink disabled:opacity-40"
      >
        {children}
      </button>
    </form>
  );
}
