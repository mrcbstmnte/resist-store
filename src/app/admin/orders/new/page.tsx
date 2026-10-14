import Link from 'next/link';
import { Suspense } from 'react';
import { connection } from 'next/server';
import type { Metadata } from 'next';
import { asc } from 'drizzle-orm';
import { db } from '@/db';
import { products, variants } from '@/db/schema';
import { sizeRank } from '@/lib/format';
import { activeChannels, PAYMENT_METHODS } from '@/lib/sales';
import { RecordSaleForm, type ItemOption } from './record-sale-form';

export const metadata: Metadata = { title: 'Record a sale' };

export default function RecordSalePage() {
  return (
    <div className="max-w-3xl">
      <Link href="/admin/orders" className="text-sm font-semibold text-ink-soft hover:text-ink">
        All orders
      </Link>
      <h1 className="display mt-2 text-5xl">Record a sale</h1>
      <p className="mt-2 max-w-prose text-sm text-ink-soft">
        For sales outside the website: in person, through messages, at a pop-up. The items come off the shelf right away,
        the same as a website order, so the stock counts stay the one true number.
      </p>
      <Suspense fallback={<div className="mt-6 h-[32rem] animate-pulse rounded bg-thread/50" />}>
        <Form />
      </Suspense>
    </div>
  );
}

async function Form() {
  await connection();
  const [channels, rows] = await Promise.all([
    activeChannels(),
    db.query.products.findMany({ with: { variants: { orderBy: asc(variants.position) } }, orderBy: asc(products.id) }),
  ]);
  // Hidden products are included: they may still sell at a pop-up after leaving the site.
  const items: ItemOption[] = rows.flatMap((p) =>
    [...p.variants]
      .sort((a, b) => sizeRank(a.size) - sizeRank(b.size))
      .map((v) => ({
        variantId: v.id,
        product: p.name,
        size: v.size,
        onHand: v.stockOnHand,
        priceCents: p.priceCents,
        hidden: !p.active,
      })),
  );
  return <RecordSaleForm channels={channels.map((c) => ({ id: c.id, name: c.name }))} items={items} paymentMethods={[...PAYMENT_METHODS]} />;
}
