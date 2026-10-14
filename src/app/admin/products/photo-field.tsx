'use client';

import { useEffect, useRef, useState } from 'react';
import { shrink } from '@/lib/shrink-image';

/** Upload a photo or paste a URL. An uploaded file wins over the URL. */
export function PhotoField({
  initialUrl,
  emptyText = 'No photo — the drawn garment is shown',
  previewClassName = 'h-36 w-28 bg-white',
  fit = 'contain',
  placeholder = '/products/tee.jpg or https://…',
}: {
  initialUrl: string | null;
  emptyText?: string;
  /** Size (and backdrop) of the preview box, to match where the photo is shown. */
  previewClassName?: string;
  fit?: 'contain' | 'cover';
  placeholder?: string;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(initialUrl ?? '');
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => () => {
    if (filePreview) URL.revokeObjectURL(filePreview);
  }, [filePreview]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    if (!picked) return setFilePreview(null);
    setBusy(true);
    const small = await shrink(picked);
    const dt = new DataTransfer();
    dt.items.add(small);
    e.target.files = dt.files;
    setFilePreview(URL.createObjectURL(small));
    setBusy(false);
  }

  function clear() {
    setUrl('');
    setFilePreview(null);
    if (fileInput.current) fileInput.current.value = '';
  }

  const preview = filePreview ?? (url.trim() || null);

  return (
    <fieldset>
      <legend className="label">
        Photo <span className="font-normal text-ink-soft">(optional)</span>
      </legend>
      <div className="flex flex-wrap items-start gap-4">
        <div className={`grid shrink-0 place-items-center overflow-hidden rounded-md border border-thread ${previewClassName}`}>
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Photo preview" className={`h-full w-full ${fit === 'cover' ? 'object-cover' : 'object-contain'}`} />
          ) : (
            <span className="px-2 text-center text-xs text-ink-soft">{emptyText}</span>
          )}
        </div>
        <div className="grid min-w-0 flex-1 gap-3">
          <div>
            <input
              ref={fileInput}
              id="photo"
              name="photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={onPick}
              className="block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-ink file:px-4 file:py-2 file:text-sm file:font-bold file:text-paper hover:file:bg-accent"
            />
            <p className="mt-1 text-xs text-ink-soft">
              {busy ? 'Preparing photo…' : 'JPG, PNG or WebP. Large photos are resized automatically.'}
            </p>
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-soft" htmlFor="imageUrl">
              …or paste a link
            </label>
            <input
              id="imageUrl"
              name="imageUrl"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              readOnly={!!filePreview}
              placeholder={placeholder}
              className="field mt-1 read-only:opacity-50"
            />
          </div>
          {preview && (
            <button type="button" onClick={clear} className="w-fit text-sm font-semibold text-out hover:underline">
              Remove photo
            </button>
          )}
        </div>
      </div>
    </fieldset>
  );
}
