'use client';

import { useActionState } from 'react';
import { addTestimonial, removeTestimonial, updateTestimonial, type AdminState } from '../actions';
import type { Testimonial } from '@/db/schema';

function Fields({ t, idPrefix }: { t?: Testimonial; idPrefix: string }) {
  return (
    <>
      <div>
        <label className="label" htmlFor={`${idPrefix}-quote`}>
          Quote
        </label>
        <textarea
          id={`${idPrefix}-quote`}
          name="quote"
          rows={3}
          required
          maxLength={600}
          defaultValue={t?.quote}
          placeholder="What the customer said, in their words"
          className="field"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor={`${idPrefix}-name`}>
            Name
          </label>
          <input id={`${idPrefix}-name`} name="name" required maxLength={80} defaultValue={t?.name} placeholder="e.g. Ana R." className="field" />
        </div>
        <div>
          <label className="label" htmlFor={`${idPrefix}-detail`}>
            Detail <span className="font-normal text-ink-soft">(optional)</span>
          </label>
          <input
            id={`${idPrefix}-detail`}
            name="detail"
            maxLength={120}
            defaultValue={t?.detail}
            placeholder="e.g. Bacolod City, or the piece they bought"
            className="field"
          />
        </div>
      </div>
    </>
  );
}

function Status({ state }: { state: AdminState }) {
  return (
    <p role="status" className={`text-sm font-semibold ${state?.error ? 'text-out' : 'text-ok'}`}>
      {state?.error ?? state?.ok}
    </p>
  );
}

export function AddTestimonialForm() {
  const [state, action, pending] = useActionState<AdminState, FormData>(addTestimonial, null);
  return (
    <form action={action} className="grid gap-4 rounded-md border border-dashed border-thread bg-paper p-5">
      <h2 className="font-bold">Add a testimonial</h2>
      <Fields idPrefix="new" />
      <p className="text-xs text-ink-soft">
        Only use real reviews, with the customer’s permission. First name and last initial is usually enough.
      </p>
      <div className="flex items-center gap-4">
        <button className="btn" disabled={pending}>
          {pending ? 'Adding…' : 'Add testimonial'}
        </button>
        <Status state={state} />
      </div>
    </form>
  );
}

export function TestimonialItem({ t, index }: { t: Testimonial; index: number }) {
  const [saved, save, saving] = useActionState<AdminState, FormData>(updateTestimonial, null);
  const [, remove, removing] = useActionState<AdminState, FormData>(removeTestimonial, null);
  return (
    <li className={`rounded-md border border-thread bg-paper p-5 ${t.visible ? '' : 'opacity-70'}`}>
      <form action={save} className="grid gap-4">
        <input type="hidden" name="id" value={t.id} />
        <div className="flex items-center justify-between gap-3">
          <span className="num text-sm font-bold text-ink-soft">#{index + 1}</span>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" name="visible" defaultChecked={t.visible} className="h-4 w-4 accent-[var(--color-accent)]" />
            Show on homepage
          </label>
        </div>
        <Fields t={t} idPrefix={`t${t.id}`} />
        <div className="flex flex-wrap items-center gap-4">
          <button className="btn-quiet" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          <Status state={saved} />
        </div>
      </form>
      <form
        action={remove}
        className="mt-3"
        onSubmit={(e) => {
          if (!confirm(`Delete the testimonial from ${t.name}?`)) e.preventDefault();
        }}
      >
        <input type="hidden" name="id" value={t.id} />
        <button className="text-sm font-semibold text-out hover:underline" disabled={removing}>
          {removing ? 'Deleting…' : 'Delete'}
        </button>
      </form>
    </li>
  );
}
