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
  format: 'base64-json' | 'omitted';
  byteLength: number;
  hash: string;
  valueBase64?: string;
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
  embeddingPolicy: {
    encoding: 'base64-json';
    maxBytesPerSpec: number;
    oversizedSpecAction: 'omit-value-keep-hash-and-size';
    note: string;
  };
  specs: SerializedProvenanceItem[];
  interactionRecovery: {
    statement: string;
    recommendedConsumerAction: string[];
  };
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
    format: 'base64-json',
    byteLength,
    hash,
    valueBase64: encodeBase64Utf8(json)
  };
}

export function buildSemanticVegaProvenanceMetadata(input: SemanticVegaProvenanceInput, maxBytes = DEFAULT_PROVENANCE_EMBED_LIMIT_BYTES): SemanticVegaProvenanceMetadata {
  const specs = [
    serializeSpecItem('sourceSpec', input.sourceSpec, maxBytes),
    serializeSpecItem('normalizedSpec', input.normalizedSpec, maxBytes),
    serializeSpecItem('compiledVegaSpec', input.compiledVegaSpec, maxBytes)
  ].filter(Boolean) as SerializedProvenanceItem[];

  return {
    kind: 'semantic-vega-provenance',
    version: SEMANTIC_VEGA_PROVENANCE_VERSION,
    source: 'Semantic Vega Editor',
    createdAt: new Date().toISOString(),
    editorVersion: input.editorVersion || '1.40',
    artifactTitle: input.artifactTitle,
    sourceSpecType: String(input.sourceSpecType || 'unknown'),
    dataUrlRewrites: input.dataUrlRewrites || [],
    embeddingPolicy: {
      encoding: 'base64-json',
      maxBytesPerSpec: maxBytes,
      oversizedSpecAction: 'omit-value-keep-hash-and-size',
      note: 'Specs are embedded when reasonably small. Oversized specs, usually caused by large inline datasets, are omitted from this compact metadata block but retain hash and byte length.'
    },
    specs,
    interactionRecovery: {
      statement: 'Embedded source and compiled specifications allow post-production tools to recover declarative interaction definitions when the specifications are included.',
      recommendedConsumerAction: [
        'Read metadata[p3-kind="semantic-vega-provenance"].',
        'Decode each included specs[*].valueBase64 as UTF-8 JSON.',
        'Prefer compiledVegaSpec for runtime reconstruction; fall back to normalizedSpec or sourceSpec.',
        'Use SSVG element attributes and SVA rehydration maps to reconnect semantic labels after re-rendering.'
      ]
    }
  };
}

export function recoverSpecsFromSemanticVegaProvenance(metadata: SemanticVegaProvenanceMetadata): Record<string, unknown> {
  const recovered: Record<string, unknown> = {};
  metadata.specs.forEach((item) => {
    if (!item.included || !item.valueBase64) return;
    recovered[item.key] = JSON.parse(decodeBase64Utf8(item.valueBase64));
  });
  return recovered;
}
