import type { SpecKind } from './specAnalysis';

export const SEMANTIC_VEGA_PROVENANCE_VERSION = '0.1';
export const DEFAULT_PROVENANCE_EMBED_LIMIT_BYTES = 350_000;

export interface SemanticVegaProvenanceInput {
  sourceSpecType: SpecKind | string;
  sourceSpec?: unknown;
  normalizedSpec?: unknown;
  compiledVegaSpec?: unknown | null;
  dataUrlRewrites?: string[];
  editorVersion?: string;
  artifactTitle?: string;
}

export interface SerializedProvenanceItem {
  key: 'sourceSpec' | 'normalizedSpec' | 'compiledVegaSpec';
  included: boolean;
  format: 'json' | 'omitted';
  byteLength: number;
  hash: string;
  value?: unknown;
  omittedReason?: string;
}

export interface SemanticVegaProvenanceMetadata {
  kind: 'semantic-vega-provenance';
  version: typeof SEMANTIC_VEGA_PROVENANCE_VERSION;
  source: 'Semantic Vega Editor';
  createdAt: string;
  editorVersion: string;
  artifactTitle?: string;
  sourceSpecType: string;
  dataUrlRewrites: string[];
  specs: {
    sourceSpec?: unknown;
    normalizedSpec?: unknown;
    compiledVegaSpec?: unknown;
  };
  specSummary: SerializedProvenanceItem[];
}

export function stableJsonStringify(value: unknown): string {
  const seen = new WeakSet<object>();
  return JSON.stringify(value, (_key, nested) => {
    if (typeof nested === 'bigint') return String(nested);
    if (typeof nested === 'function' || typeof nested === 'symbol' || typeof nested === 'undefined') return undefined;
    if (nested && typeof nested === 'object') {
      if (seen.has(nested as object)) return '[Circular]';
      seen.add(nested as object);
    }
    return nested;
  });
}

export function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

export function encodeBase64Utf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

export function decodeBase64Utf8(value: string): string {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new TextDecoder().decode(bytes);
}

export function hashString(value: string): string {
  // FNV-1a 32-bit; compact and deterministic enough for client-side provenance checks.
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function serializeSpecItem(key: SerializedProvenanceItem['key'], value: unknown, maxBytes: number): SerializedProvenanceItem | null {
  if (value == null) return null;
  const json = stableJsonStringify(value);
  if (!json) return null;
  const byteLength = utf8ByteLength(json);
  const hash = hashString(json);
  if (byteLength > maxBytes) {
    return {
      key,
      included: false,
      format: 'omitted',
      byteLength,
      hash,
      omittedReason: `Serialized ${key} exceeded the ${maxBytes.toLocaleString()} byte embedded-provenance limit.`
    };
  }
  return {
    key,
    included: true,
    format: 'json',
    byteLength,
    hash,
    value
  };
}

export function buildSemanticVegaProvenanceMetadata(input: SemanticVegaProvenanceInput, maxBytes = DEFAULT_PROVENANCE_EMBED_LIMIT_BYTES): SemanticVegaProvenanceMetadata {
  const items = [
    serializeSpecItem('sourceSpec', input.sourceSpec, maxBytes),
    serializeSpecItem('normalizedSpec', input.normalizedSpec, maxBytes),
    serializeSpecItem('compiledVegaSpec', input.compiledVegaSpec, maxBytes)
  ].filter(Boolean) as SerializedProvenanceItem[];
  const specs: SemanticVegaProvenanceMetadata['specs'] = {};
  items.forEach((item) => {
    if (item.included && item.value !== undefined) specs[item.key] = item.value;
  });
  const specSummary = items.map((item) => {
    const { value: _value, ...summary } = item;
    return summary;
  }) as SerializedProvenanceItem[];

  return {
    kind: 'semantic-vega-provenance',
    version: SEMANTIC_VEGA_PROVENANCE_VERSION,
    source: 'Semantic Vega Editor',
    createdAt: new Date().toISOString(),
    editorVersion: input.editorVersion || '1.41',
    artifactTitle: input.artifactTitle,
    sourceSpecType: String(input.sourceSpecType || 'unknown'),
    dataUrlRewrites: input.dataUrlRewrites || [],
    specs,
    specSummary
  };
}

export function recoverSpecsFromSemanticVegaProvenance(metadata: SemanticVegaProvenanceMetadata | any): Record<string, unknown> {
  const recovered: Record<string, unknown> = {};
  if (metadata?.specs && !Array.isArray(metadata.specs)) {
    ['sourceSpec', 'normalizedSpec', 'compiledVegaSpec'].forEach((key) => {
      if (metadata.specs[key] != null) recovered[key] = metadata.specs[key];
    });
    return recovered;
  }
  if (Array.isArray(metadata?.specs)) {
    metadata.specs.forEach((item: any) => {
      if (!item?.included) return;
      if (item.value != null) recovered[item.key] = item.value;
      else if (item.valueBase64) recovered[item.key] = JSON.parse(decodeBase64Utf8(item.valueBase64));
    });
  }
  return recovered;
}
