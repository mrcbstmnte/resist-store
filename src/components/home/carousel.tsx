'use client';

import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Horizontal scroll-snap carousel. Swipe, trackpad and keyboard scrolling work
 * natively; the arrow buttons step one slide at a time.
 */
export function Carousel({ label, children }: { label: string; children: ReactNode }) {
  const track = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const update = useCallback(() => {
    const el = track.current;
    if (!el) return;
    setEdges({
      start: el.scrollLeft <= 4,
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4,
    });
  }, []);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, [update]);

  const step = (dir: 1 | -1) => {
    const el = track.current;
    const slide = el?.firstElementChild as HTMLElement | null;
    if (!el || !slide) return;
    const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({ left: dir * (slide.offsetWidth + gap), behavior: smooth ? 'smooth' : 'auto' });
  };

  const slides = Children.toArray(children);

  return (
    <div role="region" aria-roledescription="carousel" aria-label={label}>
      <ul
        ref={track}
        tabIndex={0}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {slides.map((slide, i) => (
          <li
            key={i}
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${slides.length}`}
            className="w-[78%] shrink-0 snap-start sm:w-[45%] lg:w-[31.5%]"
          >
            {slide}
          </li>
        ))}
      </ul>
      <div className="mt-4 flex justify-end gap-2">
        <ArrowButton label="Previous photos" disabled={edges.start} onClick={() => step(-1)} flip />
        <ArrowButton label="Next photos" disabled={edges.end} onClick={() => step(1)} />
      </div>
    </div>
  );
}

function ArrowButton({
  label,
  disabled,
  onClick,
  flip = false,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  flip?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid h-11 w-11 place-items-center rounded-full border border-thread bg-panel transition-colors hover:border-ink disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-thread"
    >
      <svg viewBox="0 0 24 24" className={`h-5 w-5 ${flip ? 'rotate-180' : ''}`} aria-hidden="true">
        <path d="M5 12h14m-6-6 6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
