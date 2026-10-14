'use client';

import { useActionState } from 'react';
import { sendTestEmail, type AdminState } from '../actions';

const VIA_LABEL = { gmail: 'Gmail', resend: 'Resend' } as const;

export function EmailCheck({ via, defaultTo }: { via: keyof typeof VIA_LABEL | null; defaultTo: string }) {
  const [state, action, pending] = useActionState<AdminState, FormData>(sendTestEmail, null);
  return (
    <section className="mt-10 max-w-3xl rounded-md border border-thread bg-paper p-5">
      <h2 className="font-bold">Order confirmation emails</h2>
      <p className="mt-1 text-sm text-ink-soft">
        {via
          ? `Sending through ${VIA_LABEL[via]}. Customers get an email when their order is paid.`
          : 'Off: no mailer is set up, so customers get no email. See “Order confirmation email” in the README.'}
      </p>
      <form action={action} className="mt-4 flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <label className="label" htmlFor="test-to">
            Send a test to
          </label>
          <input id="test-to" name="to" type="email" required defaultValue={defaultTo} className="field" />
        </div>
        <button className="btn-quiet" disabled={pending || !via}>
          {pending ? 'Sending…' : 'Send test email'}
        </button>
      </form>
      <p role="status" className={`mt-2 text-sm font-semibold ${state?.error ? 'text-out' : 'text-ok'}`}>
        {state?.error ?? state?.ok}
      </p>
    </section>
  );
}
