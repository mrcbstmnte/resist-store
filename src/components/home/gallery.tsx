import { listGallery } from '@/lib/gallery';
import { gallery } from '@/content/home';
import { Carousel } from './carousel';

/** Photo carousel, managed in /admin/gallery. Hidden while the gallery is empty. */
export async function Gallery() {
  const photos = await listGallery();
  if (photos.length === 0) return null;
  return (
    <section aria-labelledby="gallery-title" className="pt-20">
      <h2 id="gallery-title" className="display mb-6 text-4xl sm:text-5xl">
        {gallery.title}
      </h2>
      <Carousel label={gallery.title}>
        {photos.map((p) => (
          <div key={p.id} className="relative aspect-[5/7] overflow-hidden rounded-[3px] bg-panel">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.imageUrl} alt={p.alt} loading="lazy" className="h-full w-full object-cover" />
          </div>
        ))}
      </Carousel>
    </section>
  );
}
