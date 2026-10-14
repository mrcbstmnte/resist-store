import Link from 'next/link';
import { DyePanel } from '@/components/dye';
import { getHero } from '@/lib/hero';

/** Full-bleed banner, edited in /admin/hero. Without a photo it shows a drawn print. */
export async function Hero() {
  const { headline, subhead, ctaLabel, ctaHref, imageUrl, alt } = await getHero();
  return (
    <HeroFrame>
      {imageUrl ? (
        // A plain img, so pasted links from any host work as well as uploads.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt={alt} fetchPriority="high" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <DyePanel color="#2340F0" seed={7} style="blot" width={1200} height={700} className="absolute inset-0 h-full w-full" />
      )}
      <div className="absolute inset-0 bg-gradient-to-tr from-black/70 via-black/20 to-transparent" />
      <div className="relative z-[2] flex min-h-[30rem] flex-col justify-end gap-6 p-5 sm:min-h-[36rem] sm:p-10">
        <h1 className="display max-w-[9ch] text-[clamp(4.5rem,15vw,11rem)] text-white [text-shadow:0_2px_30px_rgb(0_0_0/0.35)]">
          {headline}
        </h1>
        {(subhead || ctaLabel) && (
          <div className="flex flex-wrap items-end justify-between gap-4">
            {subhead && <p className="max-w-[40ch] text-lg font-medium text-white">{subhead}</p>}
            {ctaLabel && (
              <Link href={ctaHref} className="btn bg-white text-black">
                {ctaLabel}
              </Link>
            )}
          </div>
        )}
      </div>
    </HeroFrame>
  );
}

function HeroFrame({ children }: { children?: React.ReactNode }) {
  return (
    <section className="pt-2 sm:pt-4">
      <div className="grain relative overflow-hidden rounded-[4px] bg-accent-deep">{children}</div>
    </section>
  );
}

/** Same box as the banner, so the page doesn't jump while it loads. */
export function HeroSkeleton() {
  return (
    <HeroFrame>
      <div className="min-h-[30rem] sm:min-h-[36rem]" />
    </HeroFrame>
  );
}
