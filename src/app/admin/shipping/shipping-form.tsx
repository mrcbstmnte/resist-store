'use client';

import { useActionState } from 'react';
import { updateShippingFee, type AdminState } from '../actions';

export function ShippingForm({ feePesos }: { feePesos: number }) {
  const [state, action, pending] = useActionState<AdminState, FormData>(updateShippingFee, null);
  return (
    <form action={action} className="mt-6 grid max-w-md gap-4 rounded-md border border-thread bg-panel p-5">
      <div>
        <label className="label" htmlFor="fee">
          Shipping fee (₱)
        </label>
        <input
          id="fee"
          name="fee"
          type="number"
          inputMode="decimal"
          min={0}
          max={10000}
          step="0.01"
          defaultValue={feePesos}
          className="field num"
        />
        <p className="mt-1 text-xs text-ink-soft">Set to 0 for free shipping.</p>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <button className="btn" disabled={pending}>
          {pending ? 'Saving…' : 'Save'}
        </button>
        <p role="status" className={`text-sm font-semibold ${state?.error ? 'text-out' : 'text-ok'}`}>
          {state?.error ?? state?.ok}
        </p>
      </div>
    </form>
  );
}
