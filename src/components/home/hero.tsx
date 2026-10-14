import Link from 'next/link';
import { hero } from '@/content/home';
import { PhotoFill } from './photo';

/** Full-bleed banner. Set `hero.image` in src/content/home.ts to use a photo. */
export function Hero() {
  return (
    <section className="pt-2 sm:pt-4">
      <div className="grain relative overflow-hidden rounded-[4px] bg-accent-deep">
        <PhotoFill photo={hero} sizes="(min-width: 72rem) 72rem, 100vw" eager printWidth={1200} printHeight={700} />
        <div className="absolute inset-0 bg-gradient-to-tr from-black/70 via-black/20 to-transparent" />
        <div className="relative z-[2] flex min-h-[30rem] flex-col justify-end gap-6 p-5 sm:min-h-[36rem] sm:p-10">
          <h1 className="display max-w-[9ch] text-[clamp(4.5rem,15vw,11rem)] text-white [text-shadow:0_2px_30px_rgb(0_0_0/0.35)]">
            {hero.headline}
          </h1>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <p className="max-w-[40ch] text-lg font-medium text-white">{hero.subhead}</p>
            <Link href={hero.cta.href} className="btn bg-white text-black">
              {hero.cta.label}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
