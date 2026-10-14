'use client';

import { startTransition, useActionState } from 'react';
import { updateHero, type AdminState } from '../actions';
import { PhotoField } from '../products/photo-field';
import type { Hero } from '@/db/schema';

type HeroFields = Pick<Hero, 'headline' | 'subhead' | 'ctaLabel' | 'ctaHref' | 'imageUrl' | 'alt'>;

export function HeroForm({ hero }: { hero: HeroFields }) {
  const [state, action, pending] = useActionState<AdminState, FormData>(updateHero, null);
  return (
    <form
      // Submitting by hand skips React's automatic form reset, so a rejected save keeps what was typed.
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
      className="mt-6 grid max-w-3xl gap-5 rounded-md border border-thread bg-panel p-5"
    >
      <div>
        <label className="label" htmlFor="headline">
          Headline
        </label>
        <input id="headline" name="headline" required maxLength={80} defaultValue={hero.headline} className="field" />
        <p className="mt-1 text-xs text-ink-soft">Shown huge and in capitals. Three to five words reads best.</p>
      </div>
      <div>
        <label className="label" htmlFor="subhead">
          Line under the headline <span className="font-normal text-ink-soft">(optional)</span>
        </label>
        <textarea id="subhead" name="subhead" rows={2} maxLength={200} defaultValue={hero.subhead} className="field" />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="ctaLabel">
            Button text <span className="font-normal text-ink-soft">(leave empty to hide)</span>
          </label>
          <input id="ctaLabel" name="ctaLabel" maxLength={40} defaultValue={hero.ctaLabel} className="field" />
        </div>
        <div>
          <label className="label" htmlFor="ctaHref">
            Button link
          </label>
          <input id="ctaHref" name="ctaHref" defaultValue={hero.ctaHref} placeholder="#shop" className="field" />
          <p className="mt-1 text-xs text-ink-soft">#shop jumps to the products. A page like /products/… or a full URL works too.</p>
        </div>
      </div>
      <PhotoField
        key={hero.imageUrl ?? ''}
        initialUrl={hero.imageUrl}
        emptyText="No photo — the drawn print is shown"
        previewClassName="aspect-[12/7] w-48 bg-accent-deep"
        fit="cover"
        placeholder="https://… or leave empty"
      />
      <div>
        <label className="label" htmlFor="alt">
          Photo description <span className="font-normal text-ink-soft">(needed with a photo)</span>
        </label>
        <textarea
          id="alt"
          name="alt"
          rows={2}
          maxLength={300}
          defaultValue={hero.alt}
          placeholder="e.g. Runners in RESIST tees crossing the finish line at dawn"
          className="field"
        />
        <p className="mt-1 text-xs text-ink-soft">Read aloud by screen readers. Wide photos work best; the edges may be cropped on phones.</p>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <button className="btn" disabled={pending}>
          {pending ? 'Saving…' : 'Save banner'}
        </button>
        <a href="/" target="_blank" className="text-sm font-semibold underline">
          View homepage
        </a>
        <p role="status" className={`text-sm font-semibold ${state?.error ? 'text-out' : 'text-ok'}`}>
          {state?.error ?? state?.ok}
        </p>
      </div>
    </form>
  );
}
