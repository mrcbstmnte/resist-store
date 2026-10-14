import { testimonials } from '@/content/home';
import { visibleTestimonials } from '@/lib/testimonials';

/** Customer reviews, managed in /admin/testimonials. Hidden until one is visible. */
export async function Testimonials() {
  const items = await visibleTestimonials();
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="testimonials-title" className="pt-20">
      <h2 id="testimonials-title" className="display mb-6 text-4xl sm:text-5xl">
        {testimonials.title}
      </h2>
      <ul className="grid gap-4 md:grid-cols-3">
        {items.map((t) => (
          <li key={t.id}>
            <figure className="flex h-full flex-col justify-between gap-6 rounded-[4px] border border-thread bg-panel p-6">
              <blockquote className="text-lg font-medium leading-snug">
                <span aria-hidden="true" className="display mb-2 block text-6xl text-accent">
                  &ldquo;
                </span>
                {t.quote}
              </blockquote>
              <figcaption className="text-sm">
                <span className="font-bold">{t.name}</span>
                {t.detail && <span className="block text-ink-soft">{t.detail}</span>}
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </section>
  );
}
