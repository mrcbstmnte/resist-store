'use client';

import { useEffect, useRef, useState } from 'react';

/** The banner photo, with a shimmering skeleton behind it until it has loaded, then a fade-in. */
export function HeroPhoto({ src, alt }: { src: string; alt: string }) {
  const img = useRef<HTMLImageElement>(null);
  const [state, setState] = useState<'loading' | 'loaded' | 'failed'>('loading');

  // A cached photo can finish before React attaches onLoad, so check once on mount too.
  useEffect(() => {
    if (img.current?.complete) setState(img.current.naturalWidth > 0 ? 'loaded' : 'failed');
  }, []);

  return (
    <>
      {state === 'loading' && <div className="skeleton absolute inset-0" aria-hidden="true" />}
      {/* A plain img, so pasted links from any host work as well as uploads. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={img}
        src={src}
        alt={alt}
        fetchPriority="high"
        onLoad={() => setState('loaded')}
        // A broken link shouldn't shimmer forever or show a broken-image icon; the plain panel stays.
        onError={() => setState('failed')}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${state === 'loaded' ? 'opacity-100' : 'opacity-0'}`}
      />
    </>
  );
}
