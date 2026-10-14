'use client';

import { useActionState } from 'react';
import { addChannel, updateChannel, type AdminState } from '../actions';

function Status({ state }: { state: AdminState }) {
  return (
    <p role="status" className={`text-sm font-semibold ${state?.error ? 'text-out' : 'text-ok'}`}>
      {state?.error ?? state?.ok}
    </p>
  );
}

export function AddChannelForm() {
  const [state, action, pending] = useActionState<AdminState, FormData>(addChannel, null);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3 rounded-md border border-dashed border-thread bg-paper p-5">
      <div className="min-w-0 flex-1">
        <label className="label" htmlFor="new-channel">
          Add a channel
        </label>
        <input id="new-channel" name="name" required maxLength={40} placeholder="e.g. Shopee, or a consignment shop" className="field" />
      </div>
      <button className="btn" disabled={pending}>
        {pending ? 'Adding…' : 'Add'}
      </button>
      <div className="basis-full">
        <Status state={state} />
      </div>
    </form>
  );
}

export function ChannelItem({ id, name, active }: { id: number; name: string; active: boolean }) {
  const [state, action, pending] = useActionState<AdminState, FormData>(updateChannel, null);
  return (
    <li className={`rounded-md border border-thread bg-paper p-4 ${active ? '' : 'opacity-70'}`}>
      <form action={action} className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="id" value={id} />
        <label className="sr-only" htmlFor={`channel-${id}`}>
          Channel name
        </label>
        <input id={`channel-${id}`} name="name" required maxLength={40} defaultValue={name} className="field min-w-0 flex-1" />
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" name="active" defaultChecked={active} className="h-4 w-4 accent-[var(--color-accent)]" />
          Show in Record sale
        </label>
        <button className="btn-quiet" disabled={pending}>
          {pending ? 'Saving…' : 'Save'}
        </button>
        <div className="basis-full empty:hidden">
          <Status state={state} />
        </div>
      </form>
    </li>
  );
}
