import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { markOrderPaid } from "@/lib/inventory";
import { isCheckoutSessionPaid } from "@/lib/paymongo";
import { sendOrderConfirmation } from "@/lib/notify";
import { clearCart } from "@/lib/cart";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("order") ?? "";
  const order = /^[0-9a-f-]{36}$/i.test(id)
    ? await db.query.orders.findFirst({ where: eq(orders.id, id) })
    : undefined;
  if (!order) return NextResponse.redirect(new URL("/", request.url));

  // Don't trust the redirect itself; confirm with PayMongo if the webhook is late.
  if (order.status !== "paid" && order.checkoutSessionId) {
    if (await isCheckoutSessionPaid(order.checkoutSessionId).catch(() => false)) {
      await markOrderPaid({ orderId: order.id });
      await sendOrderConfirmation(order.id);
    }
  }

  await clearCart();
  return NextResponse.redirect(new URL(`/orders/${order.id}`, request.url));
}
