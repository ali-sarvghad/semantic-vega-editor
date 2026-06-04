export interface NormalizedSpecResult {
  spec: unknown;
  rewrites: string[];
}

const VEGA_DATASETS_BASE = 'https://cdn.jsdelivr.net/npm/vega-datasets@2/data/';

function cloneAndRewrite(value: any, rewrites: string[]): any {
  if (Array.isArray(value)) return value.map((item) => cloneAndRewrite(item, rewrites));

  if (value && typeof value === 'object') {
    const next: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      if (key === 'url' && typeof child === 'string' && child.startsWith('data/')) {
        const rewritten = `${VEGA_DATASETS_BASE}${child.slice('data/'.length)}`;
        next[key] = rewritten;
        rewrites.push(`${child} → ${rewritten}`);
      } else {
        next[key] = cloneAndRewrite(child, rewrites);
      }
    }
    return next;
  }

  return value;
}

export function normalizeSpecDataUrls(spec: unknown): NormalizedSpecResult {
  const rewrites: string[] = [];
  return { spec: cloneAndRewrite(spec, rewrites), rewrites };
}
