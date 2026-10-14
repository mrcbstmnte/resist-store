import { Suspense } from 'react';
import { connection } from 'next/server';
import type { Metadata } from 'next';
import { listGallery } from '@/lib/gallery';
import { GalleryItem, GalleryUploader } from './gallery-forms';

export const metadata: Metadata = { title: 'Gallery' };

export default function GalleryPage() {
  return (
    <>
      <h1 className="display text-5xl">Gallery</h1>
      <p className="mt-2 max-w-prose text-sm text-ink-soft">
        Photos in the homepage carousel, in this order. The section is hidden when the gallery is empty.
      </p>
      <div className="mt-6">
        <GalleryUploader />
      </div>
      <Suspense fallback={<div className="mt-6 h-72 animate-pulse rounded bg-thread/50" />}>
        <Photos />
      </Suspense>
    </>
  );
}

async function Photos() {
  await connection();
  const photos = await listGallery();
  if (photos.length === 0) return <p className="mt-8 text-ink-soft">No photos yet.</p>;
  return (
    <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {photos.map((p, i) => (
        <GalleryItem key={p.id} id={p.id} imageUrl={p.imageUrl} alt={p.alt} index={i} />
      ))}
    </ul>
  );
}
