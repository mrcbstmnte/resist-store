import Link from 'next/link';
import { DyePanel } from '@/components/dye';
import { getHero } from '@/lib/hero';
import { HeroPhoto } from './hero-photo';

/** Full-bleed banner, edited in /admin/hero. Without a photo it shows a drawn print. */
export async function Hero() {
  const { headline, subhead, ctaLabel, ctaHref, imageUrl, alt } = await getHero();
  return (
    <HeroFrame>
      {imageUrl ? (
        <HeroPhoto src={imageUrl} alt={alt} />
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

function HeroFrame({ children, busy = false }: { children?: React.ReactNode; busy?: boolean }) {
  return (
    <section className="pt-2 sm:pt-4" aria-busy={busy || undefined}>
      <div className="grain relative overflow-hidden rounded-[4px] bg-panel">{children}</div>
    </section>
  );
}

/** Same box and layout as the banner, so the page doesn't jump while it loads. */
export function HeroSkeleton() {
  return (
    <HeroFrame busy>
      <div className="skeleton absolute inset-0" />
      <div className="relative flex min-h-[30rem] flex-col justify-end gap-6 p-5 sm:min-h-[36rem] sm:p-10" aria-hidden="true">
        <div className="grid max-w-[34rem] gap-3">
          <div className="h-[clamp(3.5rem,11vw,8.5rem)] w-full rounded-[3px] bg-ink/10" />
          <div className="h-[clamp(3.5rem,11vw,8.5rem)] w-3/4 rounded-[3px] bg-ink/10" />
          <div className="h-[clamp(3.5rem,11vw,8.5rem)] w-1/2 rounded-[3px] bg-ink/10" />
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="grid w-72 max-w-full gap-2">
            <div className="h-4 rounded-full bg-ink/10" />
            <div className="h-4 w-2/3 rounded-full bg-ink/10" />
          </div>
          <div className="h-12 w-40 rounded-full bg-ink/10" />
        </div>
      </div>
    </HeroFrame>
  );
}
