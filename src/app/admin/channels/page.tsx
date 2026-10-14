import Link from 'next/link';
import { Suspense } from 'react';
import { connection } from 'next/server';
import type { Metadata } from 'next';
import { listChannels } from '@/lib/sales';
import { AddChannelForm, ChannelItem } from './channel-forms';

export const metadata: Metadata = { title: 'Sales channels' };

export default function ChannelsPage() {
  return (
    <div className="max-w-2xl">
      <Link href="/admin/orders" className="text-sm font-semibold text-ink-soft hover:text-ink">
        All orders
      </Link>
      <h1 className="display mt-2 text-5xl">Sales channels</h1>
      <p className="mt-2 max-w-prose text-sm text-ink-soft">
        The places you sell besides the website, picked when you record a sale. Website orders are tracked automatically.
        Hiding a channel removes it from the Record sale form; past sales keep it.
      </p>
      <div className="mt-6">
        <AddChannelForm />
      </div>
      <Suspense fallback={<div className="mt-6 h-64 animate-pulse rounded bg-thread/50" />}>
        <List />
      </Suspense>
    </div>
  );
}

async function List() {
  await connection();
  const channels = await listChannels();
  return (
    <ul className="mt-6 grid gap-3">
      {channels.map((c) => (
        <ChannelItem key={c.id} id={c.id} name={c.name} active={c.active} />
      ))}
    </ul>
  );
}
