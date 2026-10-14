type Size = { size: string; inStock: boolean };

export function SizeStrip({ sizes }: { sizes: Size[] }) {
  return (
    <ul className="num flex gap-1.5 text-xs" aria-label="Sizes">
      {sizes.map((s) => (
        <li
          key={s.size}
          className={s.inStock ? "text-ink" : "text-ink-soft/60 line-through"}
          aria-label={s.inStock ? s.size : `${s.size}, sold out`}
        >
          {s.size}
        </li>
      ))}
    </ul>
  );
}

