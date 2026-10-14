import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getOrder(id: string) {
  if (!UUID.test(id)) return null;
  const order = await db.query.orders.findFirst({
    where: eq(orders.id, id),
    with: { items: { with: { variant: { with: { product: true } } } } },
  });
  if (!order) return null;
  const lapsed = order.status === "pending" && order.expiresAt <= new Date();
  return { ...order, displayStatus: lapsed ? ("expired" as const) : order.status };
}
