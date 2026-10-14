"use client";

import { useActionState } from "react";
import { PhotoField } from "./photo-field";
import { addVariant, createProduct, removeSize, renameSize, updateProduct, type AdminState } from "../actions";

const SILHOUETTES = [
  ["tee", "T-shirt"],
  ["hoodie", "Hoodie"],
  ["jacket", "Jacket"],
  ["pants", "Pants"],
  ["shorts", "Shorts"],
  ["cap", "Cap"],
  ["bag", "Bag"],
] as const;

type Initial = {
  id: number;
  name: string;
  price: number;
  description: string;
  silhouette: string;
  imageUrl: string | null;
  colorHex: string;
  active: boolean;
};

export function ProductForm({ initial }: { initial?: Initial }) {
  const [state, action, pending] = useActionState<AdminState, FormData>(
    initial ? updateProduct : createProduct,
    null,
  );
  return (
    <form action={action} className="grid max-w-2xl gap-5">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <div className="grid gap-5 sm:grid-cols-[1fr_10rem]">
        <div>
          <label className="label" htmlFor="name">Name</label>
          <input id="name" name="name" required defaultValue={initial?.name} className="field" />
        </div>
        <div>
          <label className="label" htmlFor="price">Price (₱)</label>
          <input id="price" name="price" type="number" step="0.01" min="1" required defaultValue={initial?.price} className="field num" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="description">Description</label>
        <textarea id="description" name="description" rows={3} defaultValue={initial?.description} className="field" />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="silhouette">Garment type</label>
          <select id="silhouette" name="silhouette" defaultValue={initial?.silhouette ?? "tee"} className="field">
            {SILHOUETTES.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="colorHex">Drawing colour</label>
          <input
            id="colorHex"
            name="colorHex"
            type="color"
            defaultValue={initial?.colorHex ?? "#888888"}
            className="h-11 w-20 cursor-pointer rounded-md border border-thread bg-panel p-1"
          />
          <p className="mt-1 text-xs text-ink-soft">
            Tints the drawn garment until a photo is added. For another colourway, add it as a separate product.
          </p>
        </div>
      </div>
      <PhotoField key={initial?.imageUrl ?? ""} initialUrl={initial?.imageUrl ?? null} />

      {!initial && (
        <>
          <div className="grid gap-5 sm:grid-cols-[1fr_10rem]">
            <div>
              <label className="label" htmlFor="sizes">Sizes</label>
              <input id="sizes" name="sizes" required placeholder="S, M, L, XL" className="field" />
              <p className="mt-1 text-xs text-ink-soft">Use OS for one-size items.</p>
            </div>
            <div>
              <label className="label" htmlFor="initialStock">Opening stock each</label>
              <input id="initialStock" name="initialStock" type="number" min="0" defaultValue={0} className="field num" />
            </div>
          </div>
        </>
      )}

      {initial && (
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" name="active" defaultChecked={initial.active} className="h-4 w-4 accent-[var(--color-accent)]" />
          Show in store
        </label>
      )}

      <div className="flex items-center gap-4">
        <button className="btn" disabled={pending}>
          {pending ? "Saving…" : initial ? "Save changes" : "Create product"}
        </button>
        <p role="status" className={`text-sm font-semibold ${state?.error ? "text-out" : "text-ok"}`}>
          {state?.error ?? state?.ok}
        </p>
      </div>
    </form>
  );
}

export function AddVariantForm({ productId }: { productId: number }) {
  const [state, action, pending] = useActionState<AdminState, FormData>(addVariant, null);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="productId" value={productId} />
      <div>
        <label className="label" htmlFor="v-size">Size</label>
        <input id="v-size" name="size" required placeholder="XXL" className="field w-24" />
      </div>
      <div>
        <label className="label" htmlFor="v-stock">Opening stock</label>
        <input id="v-stock" name="stock" type="number" min="0" defaultValue={0} className="field num w-28" />
      </div>
      <button className="btn-quiet h-[2.6rem] px-4" disabled={pending}>
        Add size
      </button>
      <p role="status" className={`w-full text-sm font-semibold ${state?.error ? "text-out" : "text-ok"}`}>
        {state?.error ?? state?.ok}
      </p>
    </form>
  );
}

export function SizeCell({ variantId, size }: { variantId: number; size: string }) {
  const [renamed, rename, renaming] = useActionState<AdminState, FormData>(renameSize, null);
  const [removed, remove, removing] = useActionState<AdminState, FormData>(removeSize, null);
  const error = renamed?.error ?? removed?.error;
  return (
    <div>
      <div className="flex items-center gap-1.5">
        <form action={rename} className="flex items-center gap-1.5">
          <input type="hidden" name="variantId" value={variantId} />
          <input
            key={size}
            name="size"
            defaultValue={size}
            required
            aria-label="Size"
            className="w-20 rounded-md border border-thread bg-paper px-2 py-1 text-sm font-semibold uppercase"
          />
          <button className="text-xs font-semibold text-ink-soft hover:text-ink" disabled={renaming}>
            Rename
          </button>
        </form>
        <form
          action={remove}
          onSubmit={(e) => {
            if (!confirm(`Remove size ${size}? Its stock history is deleted too.`)) e.preventDefault();
          }}
        >
          <input type="hidden" name="variantId" value={variantId} />
          <button className="text-xs font-semibold text-out hover:underline" disabled={removing}>
            Remove
          </button>
        </form>
      </div>
      {error && <p role="alert" className="mt-1 max-w-56 text-xs font-semibold text-out">{error}</p>}
    </div>
  );
}
