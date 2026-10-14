"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { addToCart, type FormState } from "@/app/actions";
import { Garment } from "@/components/garment";
import type { Silhouette } from "@/db/schema";

type V = { id: number; size: string; available: number };

export function VariantPicker({
  product,
  variants,
  sizes,
}: {
  product: {
    id: number;
    name: string;
    silhouette: Silhouette;
    imageUrl: string | null;
    colorHex: string;
    price: string;
    description: string;
  };
  variants: V[];
  sizes: string[];
}) {
  const onlySize = sizes.length === 1 ? sizes[0] : undefined;
  const [size, setSize] = useState<string | undefined>(onlySize);
  const [state, action, pending] = useActionState<FormState, FormData>(addToCart, null);

  const variantFor = (s: string) => variants.find((v) => v.size === s);
  const selected = size ? variantFor(size) : undefined;
  const available = selected?.available ?? 0;

  return (
    <div className="grid gap-8 md:grid-cols-[1.15fr_1fr] md:gap-12">
      <div
        className={`relative aspect-[4/5] overflow-hidden rounded-[4px] ${product.imageUrl ? "bg-white" : "track grain"}`}
      >
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.imageUrl} alt={product.name} className="h-full w-full object-contain" />
        ) : (
          <Garment
            silhouette={product.silhouette}
            color={product.colorHex}
            seed={product.id}
            title={product.name}
            className="absolute inset-[8%] -rotate-6 drop-shadow-[0_14px_20px_rgb(0_0_0/0.4)]"
          />
        )}
      </div>

      <div className="md:pt-6">
        <h1 className="display text-6xl sm:text-7xl">{product.name}</h1>
        <p className="num mt-3 text-xl">{product.price}</p>
        <p className="mt-5 max-w-[56ch] leading-relaxed text-ink-soft">{product.description}</p>

        <form action={action} className="mt-8 space-y-7">
          <fieldset>
            <legend className="label">Size</legend>
            <div className="num flex flex-wrap gap-2">
              {sizes.map((s) => {
                const v = variantFor(s);
                const out = !v || v.available === 0;
                return (
                  <label key={s} className={out ? "cursor-not-allowed" : "cursor-pointer"}>
                    <input
                      type="radio"
                      name="size"
                      value={s}
                      disabled={out}
                      checked={size === s}
                      onChange={() => setSize(s)}
                      className="peer sr-only"
                    />
                    <span className="flex h-11 min-w-14 items-center justify-center rounded-full border border-thread bg-panel px-4 font-semibold peer-checked:border-ink peer-checked:bg-ink peer-checked:text-paper peer-disabled:text-ink-soft/50 peer-disabled:line-through peer-focus-visible:outline-2 peer-focus-visible:outline-accent">
                      {s}
                    </span>
                  </label>
                );
              })}
            </div>
            <p className="mt-3 min-h-5 text-sm" aria-live="polite">
              {!size ? (
                <span className="text-ink-soft">Choose a size.</span>
              ) : available === 0 ? (
                <span className="font-semibold text-out">Sold out in this size.</span>
              ) : available <= 3 ? (
                <span className="font-semibold text-low">Only {available} left.</span>
              ) : (
                <span className="text-ok">In stock, ships in 2–4 days.</span>
              )}
            </p>
          </fieldset>

          <input type="hidden" name="variantId" value={selected?.id ?? ""} />
          <input type="hidden" name="quantity" value="1" />
          <div className="flex flex-wrap items-center gap-4">
            <button className="btn min-w-48" disabled={pending || !selected || available === 0}>
              {pending ? "Adding…" : "Add to bag"}
            </button>
            {state?.ok && (
              <p className="text-sm font-semibold" role="status">
                {state.ok}.{" "}
                <Link href="/cart" className="text-accent underline underline-offset-4">
                  View bag
                </Link>
              </p>
            )}
            {state?.error && (
              <p className="text-sm font-semibold text-out" role="alert">
                {state.error}
              </p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
