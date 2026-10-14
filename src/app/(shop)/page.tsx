import Link from "next/link";
import { Suspense } from "react";
import {
  getCatalog,
  parseDirection,
  parseSort,
  sortCatalog,
  SORTS,
  type CatalogProduct,
  type Direction,
  type Sort,
} from "@/lib/catalog";
import { money } from "@/lib/format";
import { Garment } from "@/components/garment";
import { SizeStrip } from "@/components/size-strip";
import { Hero, HeroSkeleton } from "@/components/home/hero";
import { Gallery } from "@/components/home/gallery";
import { Testimonials } from "@/components/home/testimonials";

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <>
      <Suspense fallback={<HeroSkeleton />}>
        <Hero />
      </Suspense>
      <Suspense fallback={<CatalogSkeleton />}>
        <Catalog searchParams={searchParams} />
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

async function Catalog({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const [catalog, query] = await Promise.all([getCatalog(), searchParams]);
  const sort = parseSort(query.sort);
  const direction = parseDirection(query.dir);

  return (
    <section id="shop" className="scroll-mt-6 pt-14">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <h2 className="display text-4xl sm:text-5xl">The drop</h2>
        <SortControl current={sort} direction={direction} />
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3">
        {sortCatalog(catalog, sort, direction).map((p) => (
          <ProductTile key={p.id} product={p} />
        ))}
      </ul>
    </section>
  );
}

const SORT_LABELS: Record<Sort, string> = { category: "Category", name: "Name", price: "Price" };

const DIRECTION_LABELS: Record<Sort, Record<Direction, string>> = {
  category: { asc: "tees first", desc: "bags first" },
  name: { asc: "A to Z", desc: "Z to A" },
  price: { asc: "low to high", desc: "high to low" },
};

const sortHref = (sort: Sort, direction: Direction) => {
  const q = new URLSearchParams();
  if (sort !== "category") q.set("sort", sort);
  if (direction === "desc") q.set("dir", "desc");
  return q.size ? `/?${q}` : "/";
};

/** Picking a new sort starts ascending; picking the current one again flips it. */
function SortControl({ current, direction }: { current: Sort; direction: Direction }) {
  return (
    <nav aria-label="Sort products" className="flex items-center gap-2 text-sm">
      <span className="text-ink-soft">Sort by</span>
      {SORTS.map((sort) => {
        const on = sort === current;
        const next: Direction = on && direction === "asc" ? "desc" : "asc";
        return (
          <Link
            key={sort}
            href={sortHref(sort, next)}
            scroll={false}
            aria-current={on ? "true" : undefined}
            title={`Sort by ${SORT_LABELS[sort].toLowerCase()}, ${DIRECTION_LABELS[sort][next]}`}
            className="inline-flex items-center gap-1 rounded-full border border-thread px-3 py-1.5 font-bold hover:border-ink aria-[current]:border-ink aria-[current]:bg-ink aria-[current]:text-paper"
          >
            {SORT_LABELS[sort]}
            {on && (
              <>
                <span aria-hidden="true">{direction === "asc" ? "↑" : "↓"}</span>
                <span className="sr-only">({DIRECTION_LABELS[sort][direction]})</span>
              </>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

function ProductTile({ product: p }: { product: CatalogProduct }) {
  const soldOut = p.totalAvailable === 0;
  return (
    <li>
      <Link href={`/products/${p.slug}`} className="group block">
        <div
          className={`relative aspect-[4/5] overflow-hidden rounded-[3px] ${p.imageUrl ? "" : "track grain"}`}
          style={p.imageUrl ? { backgroundColor: p.imageBg ?? "#ffffff" } : undefined}
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
