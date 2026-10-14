import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { getOrder } from "@/lib/orders";
import { money } from "@/lib/format";
import { mockCancel, mockPay } from "@/app/actions";
import { paymentMode } from "@/lib/paymongo";

export default function MockCheckout(props: PageProps<"/checkout/mock/[id]">) {
  return (
    <Suspense>
      <Mock {...props} />
    </Suspense>
  );
}

async function Mock({ params }: PageProps<"/checkout/mock/[id]">) {
  if (paymentMode() !== "mock") notFound();
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) notFound();
  if (order.displayStatus !== "pending") redirect(`/orders/${order.id}`);

  return (
    <div className="mx-auto max-w-md pt-10">
      <p className="rounded-md bg-low-bg px-4 py-3 text-sm font-semibold text-low">
        Test payment page. Add a PayMongo secret key to send shoppers to the real checkout.
      </p>
      <h1 className="display mt-8 text-5xl">Pay {money(order.totalCents)}</h1>
      <p className="mt-2 text-ink-soft">Order {order.reference}</p>
      <ul className="mt-6 divide-y divide-thread border-y border-thread text-sm">
        {order.items.map((i) => (
          <li key={i.id} className="num flex justify-between py-3">
            <span>
              {i.quantity} × {i.productName} <span className="text-ink-soft">({i.variantLabel})</span>
            </span>
            <span>{money(i.unitPriceCents * i.quantity)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-8 flex flex-wrap gap-3">
        <form action={mockPay}>
          <input type="hidden" name="orderId" value={order.id} />
          <button className="btn">Simulate successful payment</button>
        </form>
        <form action={mockCancel}>
          <input type="hidden" name="orderId" value={order.id} />
          <button className="btn-quiet h-full px-5">Cancel payment</button>
        </form>
      </div>
    </div>
  );
}
