'use client';

import Link from 'next/link';
import { startTransition, useActionState, useState } from 'react';
import { recordSale, type AdminState } from '../../actions';
import { money } from '@/lib/format';

export type ItemOption = {
  variantId: number;
  product: string;
  size: string;
  onHand: number;
  priceCents: number;
  hidden: boolean;
};

type Row = { key: number; variantId: number | null; quantity: number };

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());

export function RecordSaleForm({
  channels,
  items,
  paymentMethods,
}: {
  channels: { id: number; name: string }[];
  items: ItemOption[];
  paymentMethods: string[];
}) {
  const [state, action, pending] = useActionState<AdminState, FormData>(recordSale, null);
  const [rows, setRows] = useState<Row[]>([{ key: 0, variantId: null, quantity: 1 }]);
  const [shipping, setShipping] = useState('');

  const byId = new Map(items.map((i) => [i.variantId, i]));
  const products = [...new Set(items.map((i) => i.product))];
  const itemsCents = rows.reduce((s, r) => s + (r.variantId ? byId.get(r.variantId)!.priceCents * r.quantity : 0), 0);
  const listCents = itemsCents + Math.round((Number(shipping) || 0) * 100);

  const update = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  if (channels.length === 0) {
    return (
      <p className="mt-6 rounded-md border border-thread bg-paper p-5 text-sm">
        No channels are switched on. <Link href="/admin/channels" className="font-semibold underline">Add or show a channel</Link> first.
      </p>
    );
  }

  return (
    <form
      // Submitting by hand skips React's automatic form reset, so a rejected sale keeps what was entered.
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
      className="mt-6 grid gap-6 rounded-md border border-thread bg-panel p-5"
    >
      <div className="grid gap-5 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="channelId">
            Where
          </label>
          <select id="channelId" name="channelId" required defaultValue="" className="field">
            <option value="" disabled>
              Pick a channel
            </option>
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <Link href="/admin/channels" className="mt-1 inline-block text-xs font-semibold text-ink-soft underline">
            Edit channels
          </Link>
        </div>
        <div>
          <label className="label" htmlFor="paymentMethod">
            Paid with
          </label>
          <select id="paymentMethod" name="paymentMethod" required defaultValue="" className="field">
            <option value="" disabled>
              Pick one
            </option>
            {paymentMethods.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="soldOn">
            Date
          </label>
          <input id="soldOn" name="soldOn" type="date" max={today()} defaultValue={today()} className="field num" />
        </div>
      </div>

      <fieldset>
        <legend className="label">Items</legend>
        <ul className="grid gap-3">
          {rows.map((r, i) => {
            const picked = r.variantId ? byId.get(r.variantId) : undefined;
            const over = picked ? r.quantity > picked.onHand : false;
            return (
              <li key={r.key} className="grid gap-2 sm:grid-cols-[1fr_6rem_auto] sm:items-start">
                <div>
                  <label className="sr-only" htmlFor={`item-${r.key}`}>
                    Item {i + 1}
                  </label>
                  <select
                    id={`item-${r.key}`}
                    name="variantId"
                    required
                    value={r.variantId ?? ''}
                    onChange={(e) => update(r.key, { variantId: Number(e.target.value) || null })}
                    className="field"
                  >
                    <option value="" disabled>
                      Pick a product and size
                    </option>
                    {products.map((name) => (
                      <optgroup key={name} label={name}>
                        {items
                          .filter((o) => o.product === name)
                          .map((o) => (
                            <option key={o.variantId} value={o.variantId} disabled={o.onHand <= 0}>
                              {o.product}, size {o.size} ({o.onHand} on hand{o.hidden ? ', hidden from site' : ''})
                            </option>
                          ))}
                      </optgroup>
                    ))}
                  </select>
                  {over && <p className="mt-1 text-xs font-semibold text-out">Only {picked!.onHand} on hand.</p>}
                </div>
                <div>
                  <label className="sr-only" htmlFor={`qty-${r.key}`}>
                    Quantity for item {i + 1}
                  </label>
                  <input
                    id={`qty-${r.key}`}
                    name="quantity"
                    type="number"
                    min={1}
                    max={picked?.onHand}
                    required
                    value={r.quantity}
                    onChange={(e) => update(r.key, { quantity: Math.max(1, Math.trunc(Number(e.target.value)) || 1) })}
                    className="field num"
                  />
                </div>
                <div className="flex h-full items-center gap-3">
                  <span className="num w-24 text-right text-sm">{picked ? money(picked.priceCents * r.quantity) : ''}</span>
                  {rows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                      className="text-sm font-semibold text-out hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          onClick={() => setRows((rs) => [...rs, { key: Math.max(...rs.map((x) => x.key)) + 1, variantId: null, quantity: 1 }])}
          className="btn-quiet mt-3"
        >
          Add another item
        </button>
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="shipping">
            Shipping charged (₱) <span className="font-normal text-ink-soft">(optional)</span>
          </label>
          <input
            id="shipping"
            name="shipping"
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            value={shipping}
            onChange={(e) => setShipping(e.target.value)}
            placeholder="0"
            className="field num"
          />
        </div>
        <div>
          <label className="label" htmlFor="amount">
            Amount paid (₱)
          </label>
          <input
            id="amount"
            name="amount"
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            placeholder={(listCents / 100).toFixed(2)}
            className="field num"
          />
          <p className="mt-1 text-xs text-ink-soft">
            Leave empty if they paid the full {money(listCents)}. Enter less to record a discount.
          </p>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="customerName">
            Customer <span className="font-normal text-ink-soft">(optional)</span>
          </label>
          <input id="customerName" name="customerName" maxLength={80} placeholder="e.g. Ben C." className="field" />
        </div>
        <div>
          <label className="label" htmlFor="phone">
            Phone or handle <span className="font-normal text-ink-soft">(optional)</span>
          </label>
          <input id="phone" name="phone" maxLength={30} placeholder="0917… or @handle" className="field" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="note">
          Note <span className="font-normal text-ink-soft">(optional)</span>
        </label>
        <input id="note" name="note" maxLength={300} placeholder="e.g. Fun run booth, paid half by GCash" className="field" />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button className="btn" disabled={pending}>
          {pending ? 'Recording…' : 'Record sale'}
        </button>
        <p role="status" className="text-sm font-semibold text-out">
          {state?.error}
        </p>
      </div>
    </form>
  );
}
