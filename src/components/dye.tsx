/**
 * Procedural sublimation print: a base colour broken up by dark streaks and
 * bleached highlights, like RESIST's all-over active-shirt prints. Pure SVG
 * (feTurbulence), so it costs nothing to ship and recolours per variant.
 */

export type PrintStyle = "streak" | "marble" | "blot";

const FREQ: Record<PrintStyle, string> = {
  streak: "0.006 0.045", // dragged tie-dye
  marble: "0.022 0.018", // crackled marble
  blot: "0.011 0.011", // big bleach blots
};

export const printFor = (seed: number): PrintStyle =>
  (["streak", "blot", "marble"] as const)[Math.abs(seed) % 3];

function luminance(hex: string) {
  const n = parseInt(hex.replace("#", ""), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

/**
 * Render inside an <svg>. Fills the given box with the print and clips it to `clip`
 * (an SVG path `d`), or fills the whole box when no clip is given.
 */
export function DyeFill({
  color,
  seed = 1,
  style = "streak",
  clip,
  width = 200,
  height = 200,
  intensity = 1,
}: {
  color: string;
  seed?: number;
  style?: PrintStyle;
  clip?: string;
  width?: number;
  height?: number;
  intensity?: number;
}) {
  const key = `${style}-${seed}-${color.replace("#", "")}-${width}x${height}`;
  const light = luminance(color) > 0.6;
  // Pale garments get darker dye; dark ones get bleached highlights.
  const darkAlpha = light ? 0.45 : 0.85;
  const lightAlpha = light ? 0.9 : 0.6;
  return (
    <>
      <defs>
        {clip && (
          <clipPath id={`c-${key}`}>
            <path d={clip} />
          </clipPath>
        )}
        <filter id={`d-${key}`} x="0" y="0" width={width} height={height} filterUnits="userSpaceOnUse">
          <feTurbulence type="fractalNoise" baseFrequency={FREQ[style]} numOctaves={4} seed={seed} />
          <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  9 0 0 0 -4.3" />
        </filter>
        <filter id={`l-${key}`} x="0" y="0" width={width} height={height} filterUnits="userSpaceOnUse">
          <feTurbulence type="fractalNoise" baseFrequency={FREQ[style]} numOctaves={4} seed={seed + 17} />
          <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  10 0 0 0 -5.4" />
        </filter>
      </defs>
      <g clipPath={clip ? `url(#c-${key})` : undefined}>
        <rect width={width} height={height} fill={color} />
        <rect width={width} height={height} filter={`url(#l-${key})`} opacity={lightAlpha * intensity} />
        <rect width={width} height={height} filter={`url(#d-${key})`} opacity={darkAlpha * intensity} />
      </g>
    </>
  );
}

/** A standalone printed rectangle, e.g. for colourway swatches and the hero. */
export function DyePanel({
  color,
  seed,
  style,
  className,
  width = 400,
  height = 400,
}: {
  color: string;
  seed?: number;
  style?: PrintStyle;
  className?: string;
  width?: number;
  height?: number;
}) {
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid slice"
      className={className}
      aria-hidden="true"
    >
      <DyeFill color={color} seed={seed} style={style} width={width} height={height} />
    </svg>
  );
}
