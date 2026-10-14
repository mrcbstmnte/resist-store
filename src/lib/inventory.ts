import { and, eq, inArray, sql } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { orderItems, orders, salesChannels, stockMovements, variants } from "@/db/schema";
import { shippingFeeFor } from "./shipping";
import { randomBytes } from "node:crypto";

/**
 * Stock model
 * ───────────
 * on_hand   = physical units (only changes on payment, restock, or manual adjustment)
 * reserved  = Σ qty of items in orders that are `pending` AND not yet expired
 * available = on_hand − reserved
 *
 * Reservations are derived, never stored, so an abandoned checkout releases its
 * stock automatically when `expires_at` passes — no background job required.
 * Writers serialize per-variant with SELECT … FOR UPDATE.
 */

export const RESERVATION_MINUTES = Number(process.env.RESERVATION_MINUTES ?? 30);

export class InsufficientStockError extends Error {
  constructor(
    public shortages: { variantId: number; requested: number; available: number }[],
  ) {
    super("Some items no longer have enough stock");
  }
}

const activeReservation = sql`${orders.status} = 'pending' AND ${orders.expiresAt} > now()`;

/** Reserved units per variant (only non-expired pending orders count). */
async function reservedFor(conn: Tx | typeof db, variantIds?: number[]) {
  const rows = await conn
    .select({
      variantId: orderItems.variantId,
      reserved: sql<number>`coalesce(sum(${orderItems.quantity}), 0)::int`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(
      variantIds
        ? and(activeReservation, inArray(orderItems.variantId, variantIds))
        : activeReservation,
    )
    .groupBy(orderItems.variantId);
  return new Map(rows.map((r) => [r.variantId, r.reserved]));
}

export type StockLevel = { onHand: number; reserved: number; available: number };

export async function stockLevels(variantIds?: number[]): Promise<Map<number, StockLevel>> {
  if (variantIds && variantIds.length === 0) return new Map();
  const [vs, reserved] = await Promise.all([
    db
      .select({ id: variants.id, onHand: variants.stockOnHand })
      .from(variants)
      .where(variantIds ? inArray(variants.id, variantIds) : undefined),
    reservedFor(db, variantIds),
  ]);
  return new Map(
    vs.map((v) => {
      const r = reserved.get(v.id) ?? 0;
      return [v.id, { onHand: v.onHand, reserved: r, available: Math.max(0, v.onHand - r) }];
    }),
  );
}

function newReference() {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const bytes = randomBytes(6);
  return "RST-" + Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export type Customer = import("./address").Delivery;
export type Line = { variantId: number; quantity: number };

/** Atomically checks availability and creates a pending order that holds stock. */
export async function createPendingOrder(customer: Customer, lines: Line[]) {
  const merged = new Map<number, number>();
  for (const l of lines) {
    if (l.quantity > 0) merged.set(l.variantId, (merged.get(l.variantId) ?? 0) + l.quantity);
  }
  if (merged.size === 0) throw new Error("Cart is empty");
  const ids = [...merged.keys()].sort((a, b) => a - b);

  return db.transaction(async (tx) => {
    // Lock in id order so concurrent checkouts can't deadlock.
    await tx.execute(
      sql`SELECT id FROM variants WHERE id IN ${ids} ORDER BY id FOR UPDATE`,
    );
    const locked = await tx.query.variants.findMany({
      where: inArray(variants.id, ids),
      with: { product: true },
      orderBy: variants.id,
    });
    const reserved = await reservedFor(tx, ids);

    const shortages: InsufficientStockError["shortages"] = [];
    for (const id of ids) {
      const v = locked.find((x) => x.id === id);
      const requested = merged.get(id)!;
      const available = v && v.product.active ? v.stockOnHand - (reserved.get(id) ?? 0) : 0;
      if (requested > available) shortages.push({ variantId: id, requested, available: Math.max(0, available) });
    }
    if (shortages.length) throw new InsufficientStockError(shortages);

    const items = locked.map((v) => ({
      variantId: v.id,
      productName: v.product.name,
      variantLabel: `Size ${v.size}`,
      unitPriceCents: v.product.priceCents,
      quantity: merged.get(v.id)!,
    }));
    const shippingCents = await shippingFeeFor(customer, tx);
    const totalCents = items.reduce((s, i) => s + i.unitPriceCents * i.quantity, 0) + shippingCents;

    const [order] = await tx
      .insert(orders)
      .values({
        ...customer,
        reference: newReference(),
        shippingCents,
        totalCents,
        expiresAt: sql`now() + make_interval(mins => ${RESERVATION_MINUTES})`,
      })
      .returning();
    const inserted = await tx
      .insert(orderItems)
      .values(items.map((i) => ({ ...i, orderId: order.id })))
      .returning();
    return { order, items: inserted };
  });
}

export async function attachCheckoutSession(orderId: string, sessionId: string) {
  await db.update(orders).set({ checkoutSessionId: sessionId }).where(eq(orders.id, orderId));
}

/**
 * Converts a reservation into a sale. Idempotent: webhooks may be delivered
 * more than once. If payment lands after the reservation lapsed and the units
 * were sold elsewhere, stock goes negative and the order is flagged `oversold`
 * so staff can resolve it — we never silently drop a paid order.
 */
export async function markOrderPaid(lookup: { orderId?: string; checkoutSessionId?: string; reference?: string }) {
  return db.transaction(async (tx) => {
    const where = lookup.orderId
      ? sql`id = ${lookup.orderId}`
      : lookup.checkoutSessionId
        ? sql`checkout_session_id = ${lookup.checkoutSessionId}`
        : sql`reference = ${lookup.reference ?? ""}`;
    const found = await tx.execute<{ id: string; status: string }>(
      sql`SELECT id, status FROM orders WHERE ${where} FOR UPDATE`,
    );
    const row = found[0];
    if (!row) return { ok: false as const, reason: "not_found" };
    if (row.status === "paid") return { ok: true as const, orderId: row.id, alreadyPaid: true };

    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, row.id));
    const ids = [...new Set(items.map((i) => i.variantId))].sort((a, b) => a - b);
    await tx.execute(sql`SELECT id FROM variants WHERE id IN ${ids} ORDER BY id FOR UPDATE`);

    let oversold = false;
    for (const item of items) {
      const [v] = await tx
        .update(variants)
        .set({ stockOnHand: sql`${variants.stockOnHand} - ${item.quantity}` })
        .where(eq(variants.id, item.variantId))
        .returning({ stockOnHand: variants.stockOnHand });
      if (v.stockOnHand < 0) oversold = true;
      await tx.insert(stockMovements).values({
        variantId: item.variantId,
        delta: -item.quantity,
        balanceAfter: v.stockOnHand,
        reason: "sale",
        orderId: row.id,
      });
    }
    await tx
      .update(orders)
      .set({ status: "paid", paidAt: new Date(), oversold })
      .where(eq(orders.id, row.id));
    return { ok: true as const, orderId: row.id, alreadyPaid: false, oversold };
  });
}

/** Releases a pending reservation immediately (e.g. shopper hit "back"). */
export async function cancelPendingOrder(orderId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return;
  await db
    .update(orders)
    .set({ status: "cancelled" })
    .where(and(eq(orders.id, orderId), eq(orders.status, "pending")));
}

/** Cosmetic: relabels lapsed reservations so the orders list reads correctly. */
export async function expireStaleOrders() {
  await db
    .update(orders)
    .set({ status: "expired" })
    .where(and(eq(orders.status, "pending"), sql`${orders.expiresAt} <= now()`));
}

export async function adjustStock(
  variantId: number,
  delta: number,
  reason: "restock" | "adjustment" | "initial",
  note = "",
) {
  if (!Number.isInteger(delta) || delta === 0) throw new Error("Quantity must be a non-zero whole number");
  return db.transaction(async (tx) => {
    const [v] = await tx.execute<{ stock_on_hand: number }>(
      sql`SELECT stock_on_hand FROM variants WHERE id = ${variantId} FOR UPDATE`,
    );
    if (!v) throw new Error("Variant not found");
    const next = v.stock_on_hand + delta;
    if (next < 0) throw new Error(`Only ${v.stock_on_hand} on hand; can't remove ${-delta}`);
    await tx.update(variants).set({ stockOnHand: next }).where(eq(variants.id, variantId));
    await tx.insert(stockMovements).values({ variantId, delta, balanceAfter: next, reason, note });
    return next;
  });
}

export class SaleInputError extends Error {}

export type OfflineSale = {
  channelId: number;
  lines: Line[];
  paymentMethod: string;
  /** What the customer actually paid. Defaults to list prices plus shipping; less than that is recorded as a discount. */
  amountCents?: number;
  shippingCents?: number;
  customerName?: string;
  phone?: string;
  note?: string;
  soldAt?: Date;
};

/**
 * Records a sale made outside the website (in person, Facebook, a pop-up…) as a paid
 * order on its channel, and takes the units off the shelf in the same transaction, the
 * same way a paid website order does. The units are already gone, so this checks against
 * stock on hand rather than what the website can still sell. Returns the variants whose
 * website checkouts in progress now hold more than is left, so staff can follow up.
 */
export async function recordOfflineSale(sale: OfflineSale) {
  const merged = new Map<number, number>();
  for (const l of sale.lines) {
    if (!Number.isInteger(l.quantity) || l.quantity < 1) throw new SaleInputError("Quantities must be whole numbers of 1 or more");
    merged.set(l.variantId, (merged.get(l.variantId) ?? 0) + l.quantity);
  }
  if (merged.size === 0) throw new SaleInputError("Add at least one item");
  const shippingCents = sale.shippingCents ?? 0;
  if (!Number.isInteger(shippingCents) || shippingCents < 0) throw new SaleInputError("Shipping can't be negative");
  const ids = [...merged.keys()].sort((a, b) => a - b);

  return db.transaction(async (tx) => {
    const channel = await tx.query.salesChannels.findFirst({ where: eq(salesChannels.id, sale.channelId) });
    if (!channel) throw new SaleInputError("Pick where the sale happened");

    await tx.execute(sql`SELECT id FROM variants WHERE id IN ${ids} ORDER BY id FOR UPDATE`);
    const locked = await tx.query.variants.findMany({
      where: inArray(variants.id, ids),
      with: { product: true },
      orderBy: variants.id,
    });
    if (locked.length !== ids.length) throw new SaleInputError("One of the items no longer exists");

    const shortages: InsufficientStockError["shortages"] = [];
    for (const v of locked) {
      const requested = merged.get(v.id)!;
      if (requested > v.stockOnHand) shortages.push({ variantId: v.id, requested, available: Math.max(0, v.stockOnHand) });
    }
    if (shortages.length) throw new InsufficientStockError(shortages);

    const items = locked.map((v) => ({
      variantId: v.id,
      productName: v.product.name,
      variantLabel: `Size ${v.size}`,
      unitPriceCents: v.product.priceCents,
      quantity: merged.get(v.id)!,
    }));
    const listCents = items.reduce((s, i) => s + i.unitPriceCents * i.quantity, 0) + shippingCents;
    const totalCents = sale.amountCents ?? listCents;
    if (!Number.isInteger(totalCents) || totalCents < 0) throw new SaleInputError("Amount paid can't be negative");
    if (totalCents > listCents) throw new SaleInputError("Amount paid is more than the items and shipping add up to");

    const soldAt = sale.soldAt ?? new Date();
    const [order] = await tx
      .insert(orders)
      .values({
        reference: newReference(),
        status: "paid",
        channelId: channel.id,
        paymentMethod: sale.paymentMethod,
        name: sale.customerName?.trim() || "Walk-in customer",
        email: "",
        phone: sale.phone?.trim() ?? "",
        addressLine1: "",
        barangay: "",
        city: "",
        province: "",
        postalCode: "",
        shippingCents,
        discountCents: listCents - totalCents,
        totalCents,
        note: sale.note?.trim() ?? "",
        paidAt: soldAt,
        expiresAt: soldAt,
      })
      .returning();
    const inserted = await tx
      .insert(orderItems)
      .values(items.map((i) => ({ ...i, orderId: order.id })))
      .returning();

    const onHandAfter = new Map<number, number>();
    for (const item of items) {
      const [v] = await tx
        .update(variants)
        .set({ stockOnHand: sql`${variants.stockOnHand} - ${item.quantity}` })
        .where(eq(variants.id, item.variantId))
        .returning({ stockOnHand: variants.stockOnHand });
      onHandAfter.set(item.variantId, v.stockOnHand);
      await tx.insert(stockMovements).values({
        variantId: item.variantId,
        delta: -item.quantity,
        balanceAfter: v.stockOnHand,
        reason: "sale",
        orderId: order.id,
        note: channel.name,
      });
    }

    const reserved = await reservedFor(tx, ids);
    const overHeld = items
      .filter((i) => (reserved.get(i.variantId) ?? 0) > onHandAfter.get(i.variantId)!)
      .map((i) => `${i.productName} (${i.variantLabel})`);

    return { order, items: inserted, channel, overHeld };
  });
}
