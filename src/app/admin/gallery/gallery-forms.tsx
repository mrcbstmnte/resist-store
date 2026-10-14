'use client';

import { useActionState, useRef, useState } from 'react';
import { addGalleryPhoto, removeGalleryPhoto, updateGalleryAlt, type AdminState } from '../actions';
import { shrink } from '@/lib/shrink-image';

/** Uploads several photos, one request each, so a big batch never hits a body-size limit. */
export function GalleryUploader() {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  async function upload() {
    const files = [...(input.current?.files ?? [])];
    if (!files.length) return;
    setErrors([]);
    const failed: string[] = [];
    for (const [i, file] of files.entries()) {
      setProgress(`Uploading ${i + 1} of ${files.length}…`);
      const form = new FormData();
      form.set('photo', await shrink(file));
      try {
        const res = await addGalleryPhoto(form);
        if (res?.error) failed.push(res.error);
      } catch {
        failed.push(`${file.name}: upload failed`);
      }
    }
    setErrors(failed);
    setProgress(failed.length === files.length ? null : `Added ${files.length - failed.length} photo${files.length - failed.length === 1 ? '' : 's'}`);
    if (input.current) input.current.value = '';
  }

  const busy = progress?.startsWith('Uploading') ?? false;

  return (
    <div className="rounded-md border border-dashed border-thread bg-paper p-5">
      <label className="label" htmlFor="gallery-photos">
        Add photos
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={input}
          id="gallery-photos"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          onChange={upload}
          className="block text-sm file:mr-3 file:rounded-full file:border-0 file:bg-ink file:px-4 file:py-2 file:text-sm file:font-bold file:text-paper hover:file:bg-accent"
        />
        <p role="status" className="text-sm font-semibold text-ok">
          {progress}
        </p>
      </div>
      <p className="mt-2 text-xs text-ink-soft">
        Pick one or more JPG, PNG or WebP photos. They’re added to the end of the carousel.
      </p>
      {errors.length > 0 && (
        <ul role="alert" className="mt-2 space-y-0.5 text-sm font-semibold text-out">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function GalleryItem({ id, imageUrl, alt, index }: { id: number; imageUrl: string; alt: string; index: number }) {
  const [saved, save, saving] = useActionState<AdminState, FormData>(updateGalleryAlt, null);
  const [removed, remove, removing] = useActionState<AdminState, FormData>(removeGalleryPhoto, null);
  return (
    <li className="overflow-hidden rounded-md border border-thread bg-paper">
      <div className="relative aspect-[5/7] bg-thread/40">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt={alt} className="h-full w-full object-cover" />
        <span className="num absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-xs font-bold text-white">
          {index + 1}
        </span>
      </div>
      <div className="space-y-2 p-3">
        <form action={save} className="space-y-1.5">
          <input type="hidden" name="id" value={id} />
          <label className="text-xs font-semibold text-ink-soft" htmlFor={`alt-${id}`}>
            Description (for screen readers)
          </label>
          <textarea id={`alt-${id}`} name="alt" rows={2} defaultValue={alt} placeholder="e.g. Runners in RESIST tees at the finish line" className="field text-sm" />
          <div className="flex items-center justify-between gap-2">
            <button className="btn-quiet" disabled={saving}>
              Save
            </button>
            <span role="status" className="text-xs font-semibold text-ok">
              {saved?.ok}
            </span>
          </div>
        </form>
        <form
          action={remove}
          onSubmit={(e) => {
            if (!confirm('Remove this photo from the gallery?')) e.preventDefault();
          }}
        >
          <input type="hidden" name="id" value={id} />
          <button className="text-sm font-semibold text-out hover:underline" disabled={removing}>
            {removing ? 'Removing…' : 'Remove'}
          </button>
          {removed?.error && <p className="text-xs text-out">{removed.error}</p>}
        </form>
      </div>
    </li>
  );
}
