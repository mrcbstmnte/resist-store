import { asc, desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { orders, products, stockMovements, variants } from "@/db/schema";
import { expireStaleOrders, stockLevels } from "./inventory";
import { sizeRank } from "./format";

export type StockFilter = "all" | "low" | "out";

export async function inventoryOverview(filter: StockFilter) {
  const [rows, levels, kpis] = await Promise.all([
    db.query.products.findMany({
      with: { variants: { orderBy: asc(variants.position) } },
      orderBy: asc(products.id),
    }),
    stockLevels(),
    db.execute<{
      paid_today: number;
      revenue_today: number;
      pending: number;
      oversold: number;
    }>(sql`
      SELECT
        count(*) FILTER (WHERE status = 'paid' AND paid_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Manila') AT TIME ZONE 'Asia/Manila')::int AS paid_today,
        coalesce(sum(total_cents) FILTER (WHERE status = 'paid' AND paid_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Manila') AT TIME ZONE 'Asia/Manila'), 0)::int AS revenue_today,
        count(*) FILTER (WHERE status = 'pending' AND expires_at > now())::int AS pending,
        count(*) FILTER (WHERE oversold)::int AS oversold
      FROM orders`),
  ]);

  const all = rows.flatMap((p) =>
    p.variants.map((v) => {
      const l = levels.get(v.id) ?? { onHand: 0, reserved: 0, available: 0 };
      const state = l.available === 0 ? "out" : l.available <= v.lowStockThreshold ? "low" : "ok";
      return { product: p, variant: v, ...l, state } as const;
    }),
  );

  const products_ = rows
    .map((p) => ({
      product: p,
      rows: all
        .filter((r) => r.product.id === p.id && (filter === "all" || r.state === filter))
        .sort((a, b) => sizeRank(a.variant.size) - sizeRank(b.variant.size)),
    }))
    .filter((g) => g.rows.length > 0);

  return {
    groups: products_,
    totals: {
      onHand: all.reduce((s, r) => s + r.onHand, 0),
      reserved: all.reduce((s, r) => s + r.reserved, 0),
      low: all.filter((r) => r.state === "low").length,
      out: all.filter((r) => r.state === "out").length,
      skus: all.length,
    },
    orders: kpis[0],
  };
}

export async function recentOrders(limit = 100) {
  await expireStaleOrders();
  return db.query.orders.findMany({
    orderBy: desc(orders.createdAt),
    limit,
    with: { items: true },
  });
}

export async function recentMovements(limit = 200) {
  return db.query.stockMovements.findMany({
    orderBy: desc(stockMovements.id),
    limit,
    with: { variant: { with: { product: true } }, order: true },
  });
}

export async function productList() {
  const [rows, levels] = await Promise.all([
    db.query.products.findMany({ with: { variants: true }, orderBy: asc(products.id) }),
    stockLevels(),
  ]);
  return rows.map((p) => ({
    ...p,
    available: p.variants.reduce((s, v) => s + (levels.get(v.id)?.available ?? 0), 0),
    sizes: new Set(p.variants.map((v) => v.size)).size,
  }));
}
