import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getProductBySlug } from "@/lib/catalog";
import { money } from "@/lib/format";
import { VariantPicker } from "./variant-picker";

export async function generateMetadata({ params }: PageProps<"/products/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  return { title: slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) };
}

export default function ProductPage(props: PageProps<"/products/[slug]">) {
  return (
    <Suspense fallback={<div className="mt-8 aspect-[4/5] max-w-lg animate-pulse rounded bg-thread/60" />}>
      <Product {...props} />
    </Suspense>
  );
}

async function Product({ params }: PageProps<"/products/[slug]">) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  return (
    <article className="pt-4">
      <VariantPicker
        product={{
          id: product.id,
          name: product.name,
          silhouette: product.silhouette,
          imageUrl: product.imageUrl,
          imageBg: product.imageBg,
          colorHex: product.colorHex,
          price: money(product.priceCents),
          description: product.description,
        }}
        variants={product.variants.map((v) => ({
          id: v.id,
          size: v.size,
          available: v.available,
        }))}
        sizes={product.sizes.map((s) => s.size)}
      />
    </article>
  );
}
