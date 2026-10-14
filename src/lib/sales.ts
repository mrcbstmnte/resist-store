import { asc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { salesChannels } from '@/db/schema';

export const PAYMENT_METHODS = ['Cash', 'GCash', 'Maya', 'Bank transfer', 'Card', 'Other'] as const;

/** Orders without a channel came through the site. */
export const WEBSITE = 'Website';

export function listChannels() {
  return db.select().from(salesChannels).orderBy(asc(salesChannels.position), asc(salesChannels.id));
}

export function activeChannels() {
  return db
    .select()
    .from(salesChannels)
    .where(eq(salesChannels.active, true))
    .orderBy(asc(salesChannels.position), asc(salesChannels.id));
}

export type ChannelSummary = { channelId: number | null; name: string; orders: number; units: number; revenueCents: number };

/** Paid orders, units and pesos per channel over the last `days` days, website first. */
export async function salesByChannel(days = 30): Promise<ChannelSummary[]> {
  const rows = await db.execute<{ channel_id: number | null; name: string | null; orders: number; units: number; revenue: number }>(sql`
    SELECT o.channel_id, c.name,
      count(*)::int AS orders,
      coalesce(sum(i.units), 0)::int AS units,
      coalesce(sum(o.total_cents), 0)::int AS revenue
    FROM orders o
    LEFT JOIN sales_channels c ON c.id = o.channel_id
    LEFT JOIN (SELECT order_id, sum(quantity) AS units FROM order_items GROUP BY order_id) i ON i.order_id = o.id
    WHERE o.status = 'paid' AND o.paid_at >= now() - make_interval(days => ${days})
    GROUP BY o.channel_id, c.name, c.position
    ORDER BY (o.channel_id IS NOT NULL), c.position, c.name`);
  return rows.map((r) => ({
    channelId: r.channel_id,
    name: r.name ?? WEBSITE,
    orders: r.orders,
    units: r.units,
    revenueCents: r.revenue,
  }));
}
