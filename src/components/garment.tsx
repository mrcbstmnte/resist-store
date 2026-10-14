import type { Silhouette } from "@/db/schema";
import { DyeFill, printFor } from "./dye";

// Flat-lay garment outlines on a 200×200 grid. Filled with a procedural
// all-over print in the variant colour, so the catalog reads like the real
// sublimated active shirts until product photos are uploaded.
const PATHS: Record<Silhouette, { body: string; detail?: string }> = {
  tee: {
    body: "M70 28 Q100 44 130 28 L172 48 L160 84 L142 76 L142 176 L58 176 L58 76 L40 84 L28 48 Z",
    detail: "M84 31 Q100 50 116 31",
  },
  hoodie: {
    body: "M74 34 Q78 10 100 10 Q122 10 126 34 L168 52 L180 150 L156 154 L146 92 L146 180 L54 180 L54 92 L44 154 L20 150 L32 52 Z",
    detail: "M82 36 Q100 60 118 36 M72 132 L128 132 L122 162 L78 162 Z",
  },
  jacket: {
    body: "M70 24 L100 40 L130 24 L170 44 L182 160 L156 162 L148 92 L148 182 L52 182 L52 92 L44 162 L18 160 L30 44 Z",
    detail: "M100 40 L100 182 M62 112 L88 112 L88 136 L62 136 Z M112 112 L138 112 L138 136 L112 136 Z M70 24 L88 66 L100 40 M130 24 L112 66 L100 40",
  },
  pants: {
    body: "M62 16 L138 16 L150 186 L110 186 L100 74 L90 186 L50 186 Z",
    detail: "M62 30 L138 30 M100 30 L100 74",
  },
  shorts: {
    body: "M54 50 L146 50 L160 146 L110 152 L100 100 L90 152 L40 146 Z",
    detail: "M54 64 L146 64",
  },
  bag: {
    body: "M40 78 L160 78 L170 182 L30 182 Z",
    detail: "M72 78 Q72 22 100 22 Q128 22 128 78 M84 78 Q84 36 100 36 Q116 36 116 78",
  },
  cap: {
    body: "M40 120 Q40 56 100 54 Q160 56 160 120 Z M40 120 Q100 108 186 128 Q176 144 140 136 Q90 124 40 132 Z",
    detail: "M100 54 L100 120 M70 62 Q62 90 64 120 M130 62 Q138 90 136 120",
  },
};

export function Garment({
  silhouette,
  color,
  seed = 1,
  className,
  title,
}: {
  silhouette: Silhouette;
  color: string;
  seed?: number;
  className?: string;
  title?: string;
}) {
  const p = PATHS[silhouette] ?? PATHS.tee;
  return (
    <svg viewBox="0 0 200 200" className={className} role="img" aria-label={title}>
      <DyeFill color={color} seed={seed} style={printFor(seed)} clip={p.body} />
      <path d={p.body} fill="none" stroke="rgba(0,0,0,.55)" strokeWidth="1.2" strokeLinejoin="round" />
      {p.detail && (
        <path d={p.detail} fill="none" stroke="rgba(255,255,255,.55)" strokeWidth="1.2" strokeLinecap="round" />
      )}
    </svg>
  );
}
