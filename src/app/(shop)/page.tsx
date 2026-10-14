import Link from "next/link";
import { Suspense } from "react";
import { getCatalog, type CatalogProduct } from "@/lib/catalog";
import { money } from "@/lib/format";
import { Garment } from "@/components/garment";
import { SizeStrip } from "@/components/size-strip";
import { Hero } from "@/components/home/hero";
import { Gallery } from "@/components/home/gallery";
import { Testimonials } from "@/components/home/testimonials";

export default function Home() {
  return (
    <>
      <Hero />
      <Suspense fallback={<CatalogSkeleton />}>
        <Catalog />
      </Suspense>
      <Suspense fallback={null}>
        <Gallery />
      </Suspense>
      <Suspense fallback={null}>
        <Testimonials />
      </Suspense>
    </>
  );
}

async function Catalog() {
  const catalog = await getCatalog();

  return (
    <section id="shop" className="scroll-mt-6 pt-14">
      <h2 className="display mb-6 text-4xl sm:text-5xl">The drop</h2>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3">
        {catalog.map((p) => (
          <ProductTile key={p.id} product={p} />
        ))}
      </ul>
    </section>
  );
}

function ProductTile({ product: p }: { product: CatalogProduct }) {
  const soldOut = p.totalAvailable === 0;
  return (
    <li>
      <Link href={`/products/${p.slug}`} className="group block">
        <div
          className={`relative aspect-[4/5] overflow-hidden rounded-[3px] ${p.imageUrl ? "bg-white" : "track grain"}`}
        >
          {p.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.imageUrl} alt={p.name} className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.03]" />
          ) : (
            <Garment
              silhouette={p.silhouette}
              color={p.colorHex}
              seed={p.id}
              title={p.name}
              className="absolute inset-[10%] z-0 -rotate-6 drop-shadow-[0_10px_14px_rgb(0_0_0/0.35)] transition-transform duration-300 group-hover:-rotate-2"
            />
          )}
          {soldOut && (
            <span className="absolute left-3 top-3 z-[2] rounded-full bg-black px-2.5 py-1 text-xs font-bold text-white">
              Sold out
            </span>
          )}
        </div>
        <div className="mt-3 flex items-baseline justify-between gap-3">
          <h3 className="font-bold [font-stretch:85%] group-hover:text-accent">{p.name}</h3>
          <span className="num shrink-0">{money(p.priceCents)}</span>
        </div>
      </Link>
      <div className="mt-2">
        <SizeStrip sizes={p.sizes} />
      </div>
    </li>
  );
}

function CatalogSkeleton() {
  return (
    <div className="animate-pulse pt-14" aria-busy="true">
      <div className="h-10 w-48 rounded bg-thread/60" />
      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="aspect-[4/5] rounded bg-thread/60" />
        ))}
      </div>
    </div>
  );
}
