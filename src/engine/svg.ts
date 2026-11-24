export const SVG_NS = 'http://www.w3.org/2000/svg';

export function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
  parent?: Element,
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  parent?.appendChild(el);
  return el;
}

export const MONO = 'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace';

let ctx: CanvasRenderingContext2D | null = null;
const widths = new Map<string, number>();

/** Pixel width of a string, measured with an off-screen canvas and cached. */
export function textWidth(text: string, size: number, weight = 400): number {
  const key = `${weight}|${size}|${text}`;
  const hit = widths.get(key);
  if (hit !== undefined) return hit;
  ctx ??= document.createElement('canvas').getContext('2d');
  let w = text.length * size * 0.6;
  if (ctx) {
    ctx.font = `${weight} ${size}px ${MONO}`;
    w = ctx.measureText(text).width;
  }
  widths.set(key, w);
  return w;
}

document.fonts?.addEventListener('loadingdone', () => widths.clear());
