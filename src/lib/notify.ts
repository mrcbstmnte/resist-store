import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { renderOrderConfirmation } from "./email/order-confirmation";
import { emailEnabled, sendEmail } from "./email/send";

const baseUrl = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

/**
 * Sends the order confirmation at most once. Safe to call from every place an
 * order can become paid (webhook, success redirect, mock pay): the first caller
 * claims the order by stamping `confirmation_sent_at`; if sending fails the
 * claim is released so the next call (e.g. PayMongo's webhook retry) tries again.
 * Never throws — a failed email must not fail a payment.
 */
export async function sendOrderConfirmation(orderId: string): Promise<"sent" | "skipped" | "failed"> {
  if (!emailEnabled()) return "skipped";
  const [claimed] = await db
    .update(orders)
    .set({ confirmationSentAt: sql`now()` })
    .where(and(eq(orders.id, orderId), eq(orders.status, "paid"), isNull(orders.confirmationSentAt)))
    .returning({ id: orders.id });
  if (!claimed) return "skipped";

  try {
    const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId), with: { items: true } });
    if (!order) return "skipped";
    const msg = renderOrderConfirmation(order, `${baseUrl()}/orders/${order.id}`);
    await sendEmail({ to: order.email, ...msg });
    return "sent";
  } catch (e) {
    console.error("[email] order confirmation failed", orderId, e);
    await db.update(orders).set({ confirmationSentAt: null }).where(eq(orders.id, orderId));
    return "failed";
  }
}
