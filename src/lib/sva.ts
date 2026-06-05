import * as vegaLite from 'vega-lite';
import type { CohortLabels, VisualCohort } from './cohorting';
import type { SpecKind } from './specAnalysis';
import { normalizeSpecDataUrls } from './specDataUrls';

export interface SvaRehydrationEntry {
  semanticElementId: string | null;
  cohortId?: string | null;
  containerId?: string | null;
  svgTag: string;
  domPath: number[];
  selector: string;
  indexInSelector: number;
  textContent?: string | null;
  attributes: Record<string, string>;
}

export interface SemanticVegaArtifact {
  artifactType: 'semantic-vega-artifact';
  artifactName: 'Semantic Vega Artifact';
  version: '0.2';
  id: string;
  title: string;
  createdAt: string;
  source: {
    language: SpecKind;
    spec: unknown;
    normalizedSpec: unknown;
    dataUrlRewrites: string[];
  };
  compiled: {
    language: 'vega';
    spec: unknown | null;
    error?: string;
  };
  rendering: {
    renderer: 'svg';
    sourceSvg: string;
    ssvg: string;
    snapshotPolicy: {
      staticSsvgIncluded: boolean;
      useForRuntimeRehydration: boolean;
      runtimeRehydrationSource: 'rehydration-map';
    };
  };
  semantics: {
    cohorts: Array<{
      id: string;
      title: string;
      type: string;
      suggestedRole: string;
      authoredRole: string | null;
      roleSource: 'author' | null;
      authorable: boolean;
      memberCount: number;
      elementIds: string[];
      rootIds: string[];
      parentId: string | null;
      childIds: string[];
      evidence: string;
    }>;
    labels: CohortLabels;
  };
  rehydration: {
    version: '0.1';
    targetRenderer: 'svg';
    targetRuntime: 'vega-svg-runtime';
    strategy: 'dom-path-primary-selector-index-fallback';
    required: true;
    applyAfterRender: true;
    reapplyOnDomMutation: true;
    rootAttributes: Record<string, string>;
    metadataJson: unknown | null;
    elements: SvaRehydrationEntry[];
    containers: SvaRehydrationEntry[];
    validation: {
      sourceSemanticElementCount: number;
      rehydratableElementCount: number;
      rehydratableContainerCount: number;
      warnings: string[];
    };
  };
  interactions: {
    params: unknown[];
    signals: unknown[];
    selections: unknown[];
    eventStreams: unknown[];
    effects: unknown[];
  };
  widgets: {
    controls: unknown[];
  };
  runtime: {
    requiredLibraries: {
      vega: string;
      vegaLite: string;
      vegaEmbed: string;
      semanticVegaRuntime: string;
    };
    embedOptions: {
      renderer: 'svg';
      actions: boolean;
    };
  };
  embedding: {
    version: '0.1';
    mode: 'semantic-vega-runtime';
    required: true;
    runtimeUrl: string;
    protocol: string[];
    minimalHtmlSnippet: string;
    notes: string[];
  };
}

export interface CreateSvaInput {
  title: string;
  specText: string;
  kind: SpecKind;
  sourceSvg: string;
  ssvg: string;
  cohorts: VisualCohort[];
  labels: CohortLabels;
}

function slug(value: string) {
  return value.toLowerCase().replace(/\.[^.]+$/, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'semantic-vega-artifact';
}

function widgetKind(bind: any) {
  if (!bind) return 'unknown';
  if (typeof bind === 'string') return bind;
  return String(bind.input ?? bind.type ?? 'unknown');
}

function collectVegaLiteParams(spec: any) {
  if (!Array.isArray(spec?.params)) return [];
  return spec.params.map((param: any, index: number) => ({
    id: `param-${param?.name ?? index}`,
    name: String(param?.name ?? `param ${index + 1}`),
    path: `params[${index}]`,
    select: param?.select ?? null,
    bind: param?.bind ?? null,
    value: param?.value ?? null,
    expr: param?.expr ?? null
  }));
}

function collectVegaSignals(spec: any) {
  if (!Array.isArray(spec?.signals)) return [];
  return spec.signals.map((signal: any, index: number) => ({
    id: `signal-${signal?.name ?? index}`,
    name: String(signal?.name ?? `signal ${index + 1}`),
    path: `signals[${index}]`,
    bind: signal?.bind ?? null,
    value: signal?.value ?? null,
    update: signal?.update ?? null,
    on: signal?.on ?? []
  }));
}

function collectWidgets(spec: any, kind: SpecKind) {
  const controls: unknown[] = [];
  if ((kind === 'vega-lite' || kind === 'unknown') && Array.isArray(spec?.params)) {
    spec.params.forEach((param: any, index: number) => {
      if (!param?.bind) return;
      controls.push({
        id: `param-${param.name ?? index}`,
        name: String(param.name ?? `param ${index + 1}`),
        kind: widgetKind(param.bind),
        source: 'vega-lite-param',
        path: `params[${index}].bind`,
        bind: param.bind,
        initialValue: param.value ?? null
      });
    });
  }
  if ((kind === 'vega' || kind === 'unknown') && Array.isArray(spec?.signals)) {
    spec.signals.forEach((signal: any, index: number) => {
      if (!signal?.bind) return;
      controls.push({
        id: `signal-${signal.name ?? index}`,
        name: String(signal.name ?? `signal ${index + 1}`),
        kind: widgetKind(signal.bind),
        source: 'vega-signal',
        path: `signals[${index}].bind`,
        bind: signal.bind,
        initialValue: signal.value ?? null
      });
    });
  }
  return controls;
}

function collectSelections(params: any[]) {
  return params.filter((param: any) => param.select).map((param: any) => ({
    id: param.id,
    name: param.name,
    source: 'vega-lite-param-select',
    select: param.select,
    bind: param.bind,
    path: param.path
  }));
}

function collectEventStreams(params: any[], signals: any[]) {
  const streams: unknown[] = [];
  params.forEach((param: any) => {
    const select = param.select;
    if (!select) return;
    if (typeof select === 'string') {
      streams.push({ id: `${param.id}-select`, source: param.id, event: null, selectType: select });
      return;
    }
    streams.push({
      id: `${param.id}-select`,
      source: param.id,
      event: select.on ?? null,
      clear: select.clear ?? null,
      translate: select.translate ?? null,
      zoom: select.zoom ?? null,
      selectType: select.type ?? null
    });
  });
  signals.forEach((signal: any) => {
    (signal.on || []).forEach((handler: any, index: number) => {
      streams.push({
        id: `${signal.id}-on-${index}`,
        source: signal.id,
        events: handler.events ?? null,
        update: handler.update ?? null,
        force: handler.force ?? null
      });
    });
  });
  return streams;
}

function compileSpec(kind: SpecKind, spec: any) {
  if (kind === 'vega-lite') {
    try {
      return { language: 'vega' as const, spec: (vegaLite as any).compile(spec).spec };
    } catch (error) {
      return { language: 'vega' as const, spec: null, error: error instanceof Error ? error.message : String(error) };
    }
  }
  if (kind === 'vega') return { language: 'vega' as const, spec };
  return { language: 'vega' as const, spec: null, error: 'Unknown spec kind; no compiled Vega spec was generated.' };
}

function elementChildrenForPath(el: Element) {
  return Array.from(el.children).filter((child) => child.tagName.toLowerCase() !== 'metadata');
}

function domPathFromSvg(svg: SVGElement, target: Element) {
  const path: number[] = [];
  let current: Element | null = target;
  while (current && current !== svg) {
    const parent: Element | null = current.parentElement;
    if (!parent) return [];
    const siblings = elementChildrenForPath(parent);
    const index = siblings.indexOf(current);
    if (index < 0) return [];
    path.unshift(index);
    current = parent;
  }
  return path;
}

function cssClassSelector(el: Element | null) {
  if (!el) return '';
  const classes = (el.getAttribute('class') || '').split(/\s+/).filter(Boolean);
  if (!classes.length) return '';
  return classes.map((cls) => `.${cls.replace(/[^a-zA-Z0-9_-]/g, '\\$&')}`).join('');
}

function nearestSelectorScope(el: Element) {
  let current: Element | null = el;
  while (current && current.tagName.toLowerCase() !== 'svg') {
    const cls = current.getAttribute('class') || '';
    if (/\bmark-[^\s]+\b/.test(cls) && /\brole-[^\s]+\b/.test(cls)) return current;
    current = current.parentElement;
  }
  return el.parentElement;
}

function selectorForElement(el: Element) {
  const tag = el.tagName.toLowerCase();
  const scope = nearestSelectorScope(el);
  const scopeSelector = scope && scope !== el ? cssClassSelector(scope) : '';
  if (scopeSelector) return `${scopeSelector} ${tag}`;
  return tag;
}

function p3Attributes(el: Element) {
  const attrs: Record<string, string> = {};
  Array.from(el.attributes).forEach((attr) => {
    if (attr.name.startsWith('p3-')) attrs[attr.name] = attr.value;
  });
  return attrs;
}

function countIndexInSelector(svg: SVGElement, selector: string, target: Element) {
  try {
    const matches = Array.from(svg.querySelectorAll(selector));
    return Math.max(0, matches.indexOf(target));
  } catch {
    return 0;
  }
}

function parseMetadataJson(svg: SVGElement) {
  const metadata = svg.querySelector('metadata[p3-kind="ssvg-metadata"]');
  if (!metadata?.textContent) return null;
  try {
    return JSON.parse(metadata.textContent);
  } catch {
    return { parseError: 'metadata JSON could not be parsed', raw: metadata.textContent };
  }
}

function createRehydrationFromSsvg(ssvg: string) {
  const warnings: string[] = [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(ssvg, 'image/svg+xml');
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    return {
      version: '0.1' as const,
      targetRenderer: 'svg' as const,
      targetRuntime: 'vega-svg-runtime' as const,
      strategy: 'dom-path-primary-selector-index-fallback' as const,
      required: true as const,
      applyAfterRender: true as const,
      reapplyOnDomMutation: true as const,
      rootAttributes: {},
      metadataJson: null,
      elements: [] as SvaRehydrationEntry[],
      containers: [] as SvaRehydrationEntry[],
      validation: {
        sourceSemanticElementCount: 0,
        rehydratableElementCount: 0,
        rehydratableContainerCount: 0,
        warnings: ['Could not parse SSVG for rehydration map generation.']
      }
    };
  }
  const svg = doc.querySelector('svg') as SVGElement | null;
  if (!svg) {
    warnings.push('No root SVG found in SSVG.');
  }
  const rootAttributes = svg ? p3Attributes(svg) : {};
  const metadataJson = svg ? parseMetadataJson(svg) : null;

  const makeEntry = (el: Element): SvaRehydrationEntry => {
    const selector = svg ? selectorForElement(el) : el.tagName.toLowerCase();
    return {
      semanticElementId: el.getAttribute('p3-element-id'),
      cohortId: el.getAttribute('p3-cohort-id'),
      containerId: el.getAttribute('p3-container-id'),
      svgTag: el.tagName.toLowerCase(),
      domPath: svg ? domPathFromSvg(svg, el) : [],
      selector,
      indexInSelector: svg ? countIndexInSelector(svg, selector, el) : 0,
      textContent: el.tagName.toLowerCase() === 'text' ? (el.textContent || '') : null,
      attributes: p3Attributes(el)
    };
  };

  const elements = svg
    ? Array.from(svg.querySelectorAll('[p3-cohort-id]')).map(makeEntry).filter((entry) => Object.keys(entry.attributes).length > 0)
    : [];
  const containers = svg
    ? Array.from(svg.querySelectorAll('[p3-container-id]')).map(makeEntry).filter((entry) => Object.keys(entry.attributes).length > 0)
    : [];

  return {
    version: '0.1' as const,
    targetRenderer: 'svg' as const,
    targetRuntime: 'vega-svg-runtime' as const,
    strategy: 'dom-path-primary-selector-index-fallback' as const,
    required: true as const,
    applyAfterRender: true as const,
    reapplyOnDomMutation: true as const,
    rootAttributes,
    metadataJson,
    elements,
    containers,
    validation: {
      sourceSemanticElementCount: elements.length + containers.length,
      rehydratableElementCount: elements.length,
      rehydratableContainerCount: containers.length,
      warnings
    }
  };
}

function buildEmbeddingSnippet(filename: string) {
  const safeFilename = JSON.stringify(filename);
  return `<div id="vis"></div>\n<script src="https://cdn.jsdelivr.net/npm/vega@5.33.0/build/vega.min.js">\\u003c/script>\n<script src="https://cdn.jsdelivr.net/npm/vega-lite@5.23.0/build/vega-lite.min.js">\\u003c/script>\n<script src="https://cdn.jsdelivr.net/npm/vega-embed@6.29.0/build/vega-embed.min.js">\\u003c/script>\n<script src="https://ali-sarvghad.github.io/semantic-vega/semantic-vega-runtime.js">\\u003c/script>\n<script>SemanticVegaEmbed('#vis', ${safeFilename});\\u003c/script>`;
}

export function createSemanticVegaArtifact(input: CreateSvaInput): SemanticVegaArtifact {
  const sourceSpec = JSON.parse(input.specText);
  const normalized = normalizeSpecDataUrls(sourceSpec);
  const normalizedSpec = normalized.spec as any;
  const params = collectVegaLiteParams(normalizedSpec);
  const signals = collectVegaSignals(normalizedSpec);
  const compiled = compileSpec(input.kind, normalizedSpec);
  const filename = semanticVegaArtifactFilename(input.title);
  const rehydration = createRehydrationFromSsvg(input.ssvg);

  return {
    artifactType: 'semantic-vega-artifact',
    artifactName: 'Semantic Vega Artifact',
    version: '0.2',
    id: `${slug(input.title)}-${Date.now()}`,
    title: input.title || 'Semantic Vega Artifact',
    createdAt: new Date().toISOString(),
    source: {
      language: input.kind,
      spec: sourceSpec,
      normalizedSpec,
      dataUrlRewrites: normalized.rewrites
    },
    compiled,
    rendering: {
      renderer: 'svg',
      sourceSvg: input.sourceSvg,
      ssvg: input.ssvg,
      snapshotPolicy: {
        staticSsvgIncluded: true,
        useForRuntimeRehydration: false,
        runtimeRehydrationSource: 'rehydration-map'
      }
    },
    semantics: {
      cohorts: input.cohorts.map((cohort) => ({
        id: cohort.id,
        title: cohort.title,
        type: cohort.type,
        suggestedRole: cohort.suggestedRole,
        authoredRole: cohort.authorable === false ? null : (input.labels[cohort.id]?.role || null),
        roleSource: cohort.authorable === false || !input.labels[cohort.id]?.role ? null : 'author',
        authorable: cohort.authorable !== false,
        memberCount: cohort.count,
        elementIds: cohort.elementIds,
        rootIds: cohort.rootIds,
        parentId: cohort.parentId || null,
        childIds: cohort.childIds || [],
        evidence: cohort.evidence
      })),
      labels: input.labels
    },
    rehydration,
    interactions: {
      params,
      signals,
      selections: collectSelections(params),
      eventStreams: collectEventStreams(params, signals),
      effects: []
    },
    widgets: {
      controls: collectWidgets(normalizedSpec, input.kind)
    },
    runtime: {
      requiredLibraries: {
        vega: '5.33.0',
        vegaLite: '5.23.0',
        vegaEmbed: '6.29.0',
        semanticVegaRuntime: '0.1'
      },
      embedOptions: {
        renderer: 'svg',
        actions: true
      }
    },
    embedding: {
      version: '0.1',
      mode: 'semantic-vega-runtime',
      required: true,
      runtimeUrl: 'https://ali-sarvghad.github.io/semantic-vega/semantic-vega-runtime.js',
      protocol: [
        'Load the SVA JSON artifact.',
        'Extract compiled.spec if available; otherwise use source.normalizedSpec or source.spec.',
        'Render the visualization with Vega/Vega-Embed using the SVG renderer.',
        'Apply rehydration.elements and rehydration.containers to the live SVG after rendering.',
        'Reapply rehydration after runtime DOM mutations so interactions do not remove semantic attributes.'
      ],
      minimalHtmlSnippet: buildEmbeddingSnippet(filename),
      notes: [
        'Do not embed the SVA by calling vegaEmbed directly on the Vega spec only; that will render a normal SVG and lose Semantic Vega attributes.',
        'Use SemanticVegaEmbed or equivalent logic that applies the SVA rehydration map to the live Vega-rendered SVG.',
        'The static SSVG snapshot is included for archival/debugging; runtime embedding should use the rehydration map.'
      ]
    }
  };
}

export function semanticVegaArtifactFilename(title: string) {
  return `${slug(title)}.sva.json`;
}

export function downloadSemanticVegaArtifact(json: string, filename: string) {
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename || 'semantic-vega-artifact.sva.json';
  anchor.click();
  URL.revokeObjectURL(url);
}


function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export type SvaDownloadKind = 'sva' | 'html' | 'package';

export function embeddableHtmlFilename(svaFilename: string) {
  return (svaFilename || 'semantic-vega-artifact.sva.json').replace(/\.sva\.json$/i, '').replace(/\.json$/i, '') + '.html';
}

export function webEmbedPackageFilename(svaFilename: string) {
  return (svaFilename || 'semantic-vega-artifact.sva.json').replace(/\.sva\.json$/i, '').replace(/\.json$/i, '') + '-web-embed-package.zip';
}

function encodeBase64Utf8(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function decodeBase64Utf8Script() {
  return `function decodeBase64Utf8(value) {
      const binary = atob(value);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      return new TextDecoder().decode(bytes);
    }`;
}

export function buildStandaloneSvaHtml(svaJson: string, svaFilename: string) {
  const parsed = JSON.parse(svaJson) as SemanticVegaArtifact;
  const safeSvaBase64 = encodeBase64Utf8(svaJson);
  const safeRuntime = SEMANTIC_VEGA_RUNTIME.replace(/<\/script/gi, '<\\/script');
  const title = parsed.title || svaFilename || 'Semantic Vega Artifact';
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} · Semantic Vega Embed</title>
  <style>
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; background: #f7fafc; color: #172033; }
    header { padding: 14px 18px; background: #102a43; color: white; box-shadow: 0 8px 24px rgba(15, 23, 42, .16); }
    header h1 { margin: 0; font-size: 16px; }
    header p { margin: 4px 0 0; color: #cbd5e1; font-size: 12px; }
    main { padding: 18px; }
    .card { background: white; border: 1px solid #e5e7eb; border-radius: 16px; box-shadow: 0 14px 36px rgba(15, 23, 42, .08); overflow: hidden; }
    #controls { padding: 12px 14px; display: grid; gap: 10px; border-bottom: 1px solid #e5e7eb; }
    #controls:empty { display: none; }
    #vis { padding: 18px; min-height: 420px; overflow: auto; }
    .error { margin: 14px; padding: 12px; border-radius: 12px; color: #7f1d1d; background: #fee2e2; border: 1px solid #fecaca; white-space: pre-wrap; }
  </style>
</head>
<body>
  <header>
    <h1>Semantic Vega Visualization</h1>
    <p>Embedded from a Semantic Vega Artifact with automatic semantic rehydration.</p>
  </header>
  <main>
    <section class="card">
      <div id="controls" data-semantic-vega-controls></div>
      <div id="vis"></div>
    </section>
  </main>
  <textarea id="semantic-vega-artifact-base64" hidden>${safeSvaBase64}</textarea>
  <script src="https://cdn.jsdelivr.net/npm/vega@5.33.0/build/vega.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/vega-lite@5.23.0/build/vega-lite.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/vega-embed@6.29.0/build/vega-embed.min.js"></script>
  <script>${safeRuntime}</script>
  <script>
    ${decodeBase64Utf8Script()}
    const svaJson = decodeBase64Utf8(document.getElementById('semantic-vega-artifact-base64').value || '');
    const sva = JSON.parse(svaJson);
    SemanticVegaEmbed(document.getElementById('vis'), sva, { actions: true, hover: true, bind: '#controls', defaultStyle: true }).catch(function(error) {
      document.getElementById('vis').innerHTML = '<div class="error"><strong>Render problem</strong>\\n' + String(error && error.message ? error.message : error) + '</div>';
    });
  </script>
</body>
</html>`;
}

function crc32(bytes: Uint8Array) {
  let crc = -1;
  for (let i = 0; i < bytes.length; i += 1) {
    crc ^= bytes[i];
    for (let j = 0; j < 8; j += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ -1) >>> 0;
}

function u16(value: number) {
  return [value & 255, (value >>> 8) & 255];
}

function u32(value: number) {
  return [value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255];
}

function buildStoredZip(files: Array<{ name: string; content: string }>) {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  files.forEach((file) => {
    const nameBytes = encoder.encode(file.name.replace(/\\/g, '/'));
    const contentBytes = encoder.encode(file.content);
    const crc = crc32(contentBytes);
    const localHeader = new Uint8Array([
      ...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(crc), ...u32(contentBytes.length), ...u32(contentBytes.length), ...u16(nameBytes.length), ...u16(0)
    ]);
    chunks.push(localHeader, nameBytes, contentBytes);
    const centralHeader = new Uint8Array([
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(crc), ...u32(contentBytes.length), ...u32(contentBytes.length), ...u16(nameBytes.length), ...u16(0), ...u16(0),
      ...u16(0), ...u16(0), ...u32(0), ...u32(offset)
    ]);
    central.push(centralHeader, nameBytes);
    offset += localHeader.length + nameBytes.length + contentBytes.length;
  });

  const centralOffset = offset;
  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array([
    ...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length),
    ...u32(centralSize), ...u32(centralOffset), ...u16(0)
  ]);
  return new Blob([...chunks, ...central, end], { type: 'application/zip' });
}

export function buildWebEmbedPackageZip(svaJson: string, svaFilename: string) {
  const cleanSvaFilename = svaFilename || 'semantic-vega-artifact.sva.json';
  const indexHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Semantic Vega Embed</title>
  <style>
    body { margin: 0; background: #f7fafc; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    header { padding: 14px 18px; background: #102a43; color: white; }
    header h1 { margin: 0; font-size: 16px; }
    main { padding: 18px; }
    #controls { margin-bottom: 12px; }
    #vis { background: white; border: 1px solid #e5e7eb; border-radius: 14px; padding: 18px; overflow: auto; }
  </style>
</head>
<body>
  <header><h1>Semantic Vega Visualization</h1></header>
  <main>
    <div id="controls" data-semantic-vega-controls></div>
    <div id="vis"></div>
  </main>
  <script src="https://cdn.jsdelivr.net/npm/vega@5.33.0/build/vega.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/vega-lite@5.23.0/build/vega-lite.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/vega-embed@6.29.0/build/vega-embed.min.js"></script>
  <script src="semantic-vega-runtime.js"></script>
  <script>SemanticVegaEmbed('#vis', ${JSON.stringify(cleanSvaFilename)}, { actions: true, hover: true, bind: '#controls', defaultStyle: true });</script>
</body>
</html>`;
  const readme = `Semantic Vega Web Embed Package\n\nFiles:\n- index.html: ready-to-use web page.\n- ${cleanSvaFilename}: Semantic Vega Artifact.\n- semantic-vega-runtime.js: runtime that renders Vega and rehydrates the live SVG with semantic attributes.\n\nUpload all files together to the same folder on your website, then open index.html.\nDo not replace SemanticVegaEmbed with plain vegaEmbed; plain vegaEmbed will render the chart but will not attach Semantic Vega attributes.\n`;
  return buildStoredZip([
    { name: 'index.html', content: indexHtml },
    { name: cleanSvaFilename, content: svaJson },
    { name: 'semantic-vega-runtime.js', content: semanticVegaRuntimeSource() },
    { name: 'README.txt', content: readme }
  ]);
}

export function downloadStandaloneSvaHtml(svaJson: string, svaFilename: string) {
  downloadBlob(new Blob([buildStandaloneSvaHtml(svaJson, svaFilename)], { type: 'text/html;charset=utf-8' }), embeddableHtmlFilename(svaFilename));
}

export function downloadWebEmbedPackage(svaJson: string, svaFilename: string) {
  downloadBlob(buildWebEmbedPackageZip(svaJson, svaFilename), webEmbedPackageFilename(svaFilename));
}

export function downloadSvaByKind(kind: SvaDownloadKind, svaJson: string, svaFilename: string) {
  if (kind === 'html') return downloadStandaloneSvaHtml(svaJson, svaFilename);
  if (kind === 'package') return downloadWebEmbedPackage(svaJson, svaFilename);
  return downloadSemanticVegaArtifact(svaJson, svaFilename);
}

function escapeForScript(value: string) {
  return value
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function escapeForJsonScriptTag(value: string) {
  return value
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

const SEMANTIC_VEGA_RUNTIME = String.raw`
(function (global) {
  function elementChildrenForPath(el) {
    return Array.prototype.filter.call(el.children || [], function (child) {
      return String(child.tagName || '').toLowerCase() !== 'metadata';
    });
  }
  function resolveDomPath(svg, path, expectedTag) {
    var current = svg;
    if (!Array.isArray(path)) return null;
    for (var i = 0; i < path.length; i += 1) {
      var children = elementChildrenForPath(current);
      current = children[path[i]];
      if (!current) return null;
    }
    if (expectedTag && current && String(current.tagName || '').toLowerCase() !== String(expectedTag).toLowerCase()) return null;
    return current || null;
  }
  function resolveSelectorIndex(svg, entry) {
    if (!entry || !entry.selector) return null;
    try {
      var candidates = svg.querySelectorAll(entry.selector);
      var candidate = candidates[Math.max(0, Number(entry.indexInSelector) || 0)];
      if (candidate && entry.svgTag && String(candidate.tagName || '').toLowerCase() !== String(entry.svgTag).toLowerCase()) return null;
      return candidate || null;
    } catch (error) {
      return null;
    }
  }
  function setAttributes(el, attributes) {
    if (!el || !attributes) return 0;
    var count = 0;
    Object.keys(attributes).forEach(function (name) {
      if (!name || !name.indexOf || name.indexOf('p3-') !== 0) return;
      var value = attributes[name];
      if (value === null || value === undefined) return;
      if (el.getAttribute(name) !== String(value)) {
        el.setAttribute(name, String(value));
        count += 1;
      }
    });
    return count;
  }
  function normalizeSvgPaintUrlReferences(svg) {
    if (!svg) return;
    var localPaintIds = {};
    Array.prototype.forEach.call(svg.querySelectorAll('linearGradient[id], radialGradient[id], pattern[id]'), function (el) {
      var id = el.getAttribute('id');
      if (id) localPaintIds[id] = true;
    });
    function hasPaintIds() {
      for (var key in localPaintIds) return true;
      return false;
    }
    if (!hasPaintIds()) return;
    function extractUrlRefId(value) {
      if (!value) return null;
      var match = String(value).match(/url\(\s*['"]?[^)]*#([^)'"\s]+)['"]?\s*\)/);
      return match && match[1] ? match[1] : null;
    }
    function hasLocalPaintRef(value) {
      var id = extractUrlRefId(value);
      return !!(id && localPaintIds[id]);
    }
    function normalizePaintRef(value) {
      if (!value) return value;
      return String(value).replace(/url\(\s*['"]?[^)]*#([^)'"\s]+)['"]?\s*\)/g, function (full, id) {
        return localPaintIds[id] ? 'url(#' + id + ')' : full;
      });
    }
    function syncPaintPair(el, svgAttr, p3Attr) {
      var currentSvg = el.getAttribute(svgAttr);
      var normalizedSvg = normalizePaintRef(currentSvg);
      if (normalizedSvg && normalizedSvg !== currentSvg) el.setAttribute(svgAttr, normalizedSvg);
      var currentP3 = el.getAttribute(p3Attr);
      var normalizedP3 = normalizePaintRef(currentP3);
      if (normalizedP3 && normalizedP3 !== currentP3) el.setAttribute(p3Attr, normalizedP3);
      var finalSvg = el.getAttribute(svgAttr);
      var finalP3 = el.getAttribute(p3Attr);
      if (hasLocalPaintRef(finalSvg) && !hasLocalPaintRef(finalP3) && finalSvg) {
        el.setAttribute(p3Attr, finalSvg);
      }
    }
    Array.prototype.forEach.call(svg.querySelectorAll('*'), function (el) {
      ['filter', 'clip-path', 'mask'].forEach(function (attr) {
        var current = el.getAttribute(attr);
        var normalized = normalizePaintRef(current);
        if (normalized && normalized !== current) el.setAttribute(attr, normalized);
      });
      syncPaintPair(el, 'fill', 'p3-paint-fill');
      syncPaintPair(el, 'stroke', 'p3-paint-stroke');
      var style = el.getAttribute('style');
      var normalizedStyle = normalizePaintRef(style);
      if (normalizedStyle && normalizedStyle !== style) el.setAttribute('style', normalizedStyle);
    });
  }
  function ensureMetadata(svg, metadataJson) {
    if (!svg || !metadataJson || svg.querySelector('metadata[p3-kind="ssvg-metadata"]')) return;
    var metadata = document.createElementNS('http://www.w3.org/2000/svg', 'metadata');
    metadata.setAttribute('p3-kind', 'ssvg-metadata');
    metadata.setAttribute('type', 'application/json');
    metadata.textContent = JSON.stringify(metadataJson, null, 2);
    svg.insertBefore(metadata, svg.firstChild || null);
  }
  function applyEntries(svg, entries) {
    var applied = 0;
    var missed = [];
    (entries || []).forEach(function (entry) {
      var target = resolveDomPath(svg, entry.domPath, entry.svgTag) || resolveSelectorIndex(svg, entry);
      if (!target) {
        missed.push(entry.semanticElementId || entry.containerId || entry.cohortId || entry.selector || 'unknown-entry');
        return;
      }
      applied += setAttributes(target, entry.attributes);
    });
    return { applied: applied, missed: missed };
  }
  function applySemanticVegaRehydration(svg, sva) {
    if (!svg || !sva || !sva.rehydration) return { applied: 0, missed: ['missing-svg-or-rehydration'] };
    var rehydration = sva.rehydration;
    setAttributes(svg, rehydration.rootAttributes || {});
    ensureMetadata(svg, rehydration.metadataJson);
    var containerResult = applyEntries(svg, rehydration.containers || []);
    var elementResult = applyEntries(svg, rehydration.elements || []);
    var missed = containerResult.missed.concat(elementResult.missed);
    normalizeSvgPaintUrlReferences(svg);
    svg.setAttribute('p3-live-rehydrated', 'true');
    svg.setAttribute('p3-live-rehydrated-at', new Date().toISOString());
    svg.setAttribute('p3-live-rehydration-missed', String(missed.length));
    return { applied: containerResult.applied + elementResult.applied, missed: missed };
  }
  async function loadSva(svaUrlOrObject) {
    if (typeof svaUrlOrObject === 'string') {
      var response = await fetch(svaUrlOrObject);
      if (!response.ok) throw new Error('Could not load SVA: ' + response.status + ' ' + response.statusText);
      return response.json();
    }
    return svaUrlOrObject;
  }
  function chooseSpec(sva) {
    return (sva.compiled && sva.compiled.spec) || (sva.source && (sva.source.normalizedSpec || sva.source.spec));
  }
  async function SemanticVegaEmbed(container, svaUrlOrObject, options) {
    if (!global.vegaEmbed) throw new Error('SemanticVegaEmbed requires vegaEmbed to be loaded first.');
    var sva = await loadSva(svaUrlOrObject);
    var root = typeof container === 'string' ? document.querySelector(container) : container;
    if (!root) throw new Error('SemanticVegaEmbed container not found.');
    var spec = chooseSpec(sva);
    if (!spec) throw new Error('SVA does not contain a renderable Vega/Vega-Lite specification.');
    var embedOptions = Object.assign({}, (sva.runtime && sva.runtime.embedOptions) || {}, options || {}, { renderer: 'svg' });
    if (!embedOptions.bind) embedOptions.bind = root.querySelector('[data-semantic-vega-controls]') || undefined;
    var result = await global.vegaEmbed(root, spec, embedOptions);
    var scheduled = false;
    function rehydrate() {
      var svg = root.querySelector('svg');
      return applySemanticVegaRehydration(svg, sva);
    }
    var first = rehydrate();
    var observer = new MutationObserver(function () {
      if (scheduled) return;
      scheduled = true;
      setTimeout(function () {
        scheduled = false;
        rehydrate();
      }, 0);
    });
    observer.observe(root, { childList: true, subtree: true });
    return { sva: sva, vegaResult: result, view: result.view, rehydrate: rehydrate, observer: observer, initialRehydration: first, getSvg: function () { return root.querySelector('svg'); } };
  }
  global.SemanticVegaEmbed = SemanticVegaEmbed;
  global.SemanticVegaRuntime = { embed: SemanticVegaEmbed, applySemanticVegaRehydration: applySemanticVegaRehydration };
})(window);
`;

export function semanticVegaRuntimeSource() {
  return SEMANTIC_VEGA_RUNTIME.trim() + '\n';
}

export function buildSvaInspectionHtml(sva: SemanticVegaArtifact, svaJson: string, filename: string) {
  const safeSvaBase64 = encodeBase64Utf8(svaJson);
  const safeFilename = escapeForScript(JSON.stringify(filename));
  const safeRuntime = SEMANTIC_VEGA_RUNTIME.replace(/<\/script/gi, '<\\/script');
  const safeRuntimeSourceJson = escapeForScript(JSON.stringify(semanticVegaRuntimeSource()));
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${sva.title} · Semantic Vega Artifact</title>
  <style>
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; background: #f6f7fb; color: #172033; }
    header { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 18px; background: #111827; color: white; box-shadow: 0 8px 24px rgba(15, 23, 42, .16); }
    header h1 { font-size: 16px; margin: 0; letter-spacing: .01em; }
    header p { margin: 3px 0 0; color: #cbd5e1; font-size: 12px; }
    button { border: 0; border-radius: 10px; padding: 9px 12px; font-weight: 700; cursor: pointer; background: #2563eb; color: white; box-shadow: 0 8px 18px rgba(37, 99, 235, .22); }
    .dialog-backdrop { position: fixed; inset: 0; z-index: 40; display: none; place-items: center; padding: 24px; background: rgba(15,23,42,.42); backdrop-filter: blur(4px); }
    .dialog-backdrop.open { display: grid; }
    .download-dialog { width: min(620px, calc(100vw - 48px)); background: white; color: #172033; border-radius: 18px; border: 1px solid #e5e7eb; box-shadow: 0 28px 80px rgba(15,23,42,.28); overflow: visible; }
    .download-dialog header { background: white; color: #172033; box-shadow: none; border-bottom: 1px solid #e5e7eb; padding: 18px 20px 14px; }
    .download-dialog h2 { margin: 0; font-size: 18px; }
    .download-dialog p { margin: 5px 0 0; color: #64748b; font-size: 13px; }
    .download-options { display: grid; gap: 10px; padding: 16px 20px; }
    .download-option { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 12px; padding: 14px; border: 1px solid #e2e8f0; border-radius: 14px; background: #f8fafc; cursor: pointer; }
    .download-option:has(input:checked) { border-color: #14b8a6; background: #ecfeff; box-shadow: inset 0 0 0 1px rgba(20,184,166,.35); }
    .download-option input { accent-color: #0f766e; }
    .download-option span.option-copy { display: grid; gap: 3px; }
    .download-option strong { color: #0f172a; font-size: 14px; }
    .download-option small { color: #64748b; line-height: 1.35; }
    .info-dot { position: relative; display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 999px; border: 1px solid #94a3b8; background: white; color: #0f766e; font-size: 13px; font-weight: 800; }
    .info-tooltip { position: absolute; right: 0; bottom: calc(100% + 10px); z-index: 120; width: 280px; padding: 10px 11px; border-radius: 10px; background: #0f172a; color: #e5e7eb; box-shadow: 0 14px 36px rgba(15,23,42,.28); font-size: 12px; font-weight: 500; line-height: 1.4; opacity: 0; visibility: hidden; transform: translateY(4px); transition: opacity .12s ease, transform .12s ease, visibility .12s ease; pointer-events: none; }
    .info-dot:hover .info-tooltip, .info-dot:focus .info-tooltip { opacity: 1; visibility: visible; transform: translateY(0); }
    .dialog-actions { display: flex; justify-content: flex-end; gap: 10px; padding: 14px 20px 18px; border-top: 1px solid #e5e7eb; }
    .secondary { background: #f1f5f9; color: #334155; box-shadow: none; }
    .primary-download { background: #0f766e; box-shadow: 0 8px 18px rgba(15,118,110,.22); }
    main { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 16px; padding: 16px; }
    .card { background: white; border: 1px solid #e5e7eb; border-radius: 16px; box-shadow: 0 14px 36px rgba(15, 23, 42, .08); overflow: hidden; }
    .card h2 { font-size: 14px; margin: 0; padding: 12px 14px; border-bottom: 1px solid #e5e7eb; background: #fafafa; }
    #controls { padding: 12px 14px; display: grid; gap: 10px; border-bottom: 1px solid #e5e7eb; }
    #controls:empty { display: none; }
    #vis { padding: 18px; min-height: 420px; overflow: auto; }
    #summary { padding: 12px 14px; display: grid; gap: 10px; font-size: 13px; }
    .pill { display: inline-flex; align-items: center; width: max-content; border-radius: 999px; background: #eef2ff; color: #3730a3; padding: 5px 9px; font-size: 12px; font-weight: 700; }
    .ok { color: #166534; }
    .warn { color: #92400e; }
    details { border-top: 1px solid #e5e7eb; }
    summary { cursor: pointer; padding: 12px 14px; font-weight: 700; }
    pre { margin: 0; padding: 12px 14px; max-height: 360px; overflow: auto; background: #0f172a; color: #dbeafe; font-size: 11px; line-height: 1.45; }
    .error { margin: 14px; padding: 12px; border-radius: 12px; color: #7f1d1d; background: #fee2e2; border: 1px solid #fecaca; white-space: pre-wrap; }
    @media (max-width: 900px) { main { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>Semantic Vega Artifact Inspector</h1>
      <p>${sva.title} · live Vega rendering with Semantic Vega rehydration</p>
    </div>
    <button id="openDownloadDialog">Download SVA</button>
  </header>
  <div id="downloadDialog" class="dialog-backdrop" role="presentation">
    <section class="download-dialog" role="dialog" aria-modal="true" aria-labelledby="downloadDialogTitle">
      <header>
        <h2 id="downloadDialogTitle">Download Semantic Vega Artifact</h2>
        <p>Choose the format that best matches how you will reuse this visualization.</p>
      </header>
      <div class="download-options">
        <label class="download-option"><input type="radio" name="downloadKind" value="sva"><span class="option-copy"><strong>SVA JSON</strong><small>For tools, archives, or pages that already load Semantic Vega Artifacts.</small></span><span class="info-dot" tabindex="0">i<span class="info-tooltip">Downloads only the .sva.json file. Use this when another system already includes the Semantic Vega runtime. Plain vegaEmbed alone will not preserve semantic labels.</span></span></label>
        <label class="download-option"><input type="radio" name="downloadKind" value="html" checked><span class="option-copy"><strong>Embeddable HTML page</strong><small>A single ready-to-open page with the SVA embedded inside it.</small></span><span class="info-dot" tabindex="0">i<span class="info-tooltip">Downloads one HTML file that contains the SVA and automatically renders it as an interactive semantic visualization. This is the easiest option for a page that works without separate files.</span></span></label>
        <label class="download-option"><input type="radio" name="downloadKind" value="package"><span class="option-copy"><strong>Web embed package</strong><small>A zip folder with an HTML page, SVA file, runtime file, and README.</small></span><span class="info-dot" tabindex="0">i<span class="info-tooltip">Downloads a zip package for uploading to a website. Keep the files together in the same folder and open index.html. The included runtime handles rendering and semantic rehydration.</span></span></label>
      </div>
      <div class="dialog-actions"><button id="cancelDownload" class="secondary">Cancel</button><button id="confirmDownload" class="primary-download">Download</button></div>
    </section>
  </div>
  <main>
    <section class="card">
      <h2>Interactive semantic visualization preview</h2>
      <div id="controls" data-semantic-vega-controls></div>
      <div id="vis"></div>
    </section>
    <aside class="card">
      <h2>Artifact summary</h2>
      <div id="summary"></div>
      <details>
        <summary>Embed instructions</summary>
        <pre id="embedSnippet"></pre>
      </details>
      <details>
        <summary>View SVA JSON</summary>
        <pre id="svaSource"></pre>
      </details>
    </aside>
  </main>
  <textarea id="semantic-vega-artifact-base64" hidden>${safeSvaBase64}</textarea>
  <script src="https://cdn.jsdelivr.net/npm/vega@5.33.0/build/vega.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/vega-lite@5.23.0/build/vega-lite.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/vega-embed@6.29.0/build/vega-embed.min.js"></script>
  <script>${safeRuntime}</script>
  <script>
    ${decodeBase64Utf8Script()}
    const svaJson = decodeBase64Utf8(document.getElementById('semantic-vega-artifact-base64').value || '');
    const sva = JSON.parse(svaJson);
    const svaBase64 = document.getElementById('semantic-vega-artifact-base64').value || '';
    const filename = ${safeFilename};

    const runtimeSource = ${safeRuntimeSourceJson};

    function saveBlob(blob, downloadName) {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = downloadName;
      anchor.click();
      URL.revokeObjectURL(url);
    }

    function baseName() {
      return (filename || 'semantic-vega-artifact.sva.json').replace(/\.sva\.json$/i, '').replace(/\.json$/i, '');
    }

    function downloadSva() {
      saveBlob(new Blob([svaJson], { type: 'application/json;charset=utf-8' }), filename);
    }

    function standaloneHtml() {
      return '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8" />\n<meta name="viewport" content="width=device-width, initial-scale=1" />\n<title>Semantic Vega Embed</title>\n<style>body{margin:0;background:#f7fafc;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}header{padding:14px 18px;background:#102a43;color:white}main{padding:18px}#controls{margin-bottom:12px}#vis{background:white;border:1px solid #e5e7eb;border-radius:14px;padding:18px;overflow:auto}.error{margin:14px;padding:12px;border-radius:12px;color:#7f1d1d;background:#fee2e2;border:1px solid #fecaca;white-space:pre-wrap}</style>\n</head>\n<body>\n<header><h1>Semantic Vega Visualization</h1></header>\n<main><div id="controls" data-semantic-vega-controls></div><div id="vis"></div></main>\n<textarea id="semantic-vega-artifact-base64" hidden>' + svaBase64 + '</textarea>\n<script src="https://cdn.jsdelivr.net/npm/vega@5.33.0/build/vega.min.js">\\u003c/script>\n<script src="https://cdn.jsdelivr.net/npm/vega-lite@5.23.0/build/vega-lite.min.js">\\u003c/script>\n<script src="https://cdn.jsdelivr.net/npm/vega-embed@6.29.0/build/vega-embed.min.js">\\u003c/script>\n<script>' + runtimeSource.replace(/<\\/script/gi, '<\\\\/script') + '\\u003c/script>\n<script>function decodeBase64Utf8(value){const binary=atob(value);const bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i+=1)bytes[i]=binary.charCodeAt(i);return new TextDecoder().decode(bytes)}const sva=JSON.parse(decodeBase64Utf8(document.getElementById("semantic-vega-artifact-base64").value));SemanticVegaEmbed("#vis",sva,{actions:true,hover:true,bind:"#controls",defaultStyle:true}).catch(function(error){document.getElementById("vis").innerHTML="<div class=\\\"error\\\"><strong>Render problem</strong>\\n"+String(error&&error.message?error.message:error)+"</div>"});\\u003c/script>\n</body>\n</html>';
    }

    function crc32(bytes) {
      let crc = -1;
      for (let i = 0; i < bytes.length; i += 1) {
        crc ^= bytes[i];
        for (let j = 0; j < 8; j += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
      }
      return (crc ^ -1) >>> 0;
    }
    function u16(v) { return [v & 255, (v >>> 8) & 255]; }
    function u32(v) { return [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]; }
    function zipBlob(files) {
      const encoder = new TextEncoder();
      const chunks = [];
      const central = [];
      let offset = 0;
      files.forEach((file) => {
        const nameBytes = encoder.encode(file.name);
        const contentBytes = encoder.encode(file.content);
        const crc = crc32(contentBytes);
        const localHeader = new Uint8Array([...u32(0x04034b50),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),...u32(crc),...u32(contentBytes.length),...u32(contentBytes.length),...u16(nameBytes.length),...u16(0)]);
        chunks.push(localHeader, nameBytes, contentBytes);
        const centralHeader = new Uint8Array([...u32(0x02014b50),...u16(20),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),...u32(crc),...u32(contentBytes.length),...u32(contentBytes.length),...u16(nameBytes.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(offset)]);
        central.push(centralHeader, nameBytes);
        offset += localHeader.length + nameBytes.length + contentBytes.length;
      });
      const centralOffset = offset;
      const centralSize = central.reduce((sum, part) => sum + part.length, 0);
      const end = new Uint8Array([...u32(0x06054b50),...u16(0),...u16(0),...u16(files.length),...u16(files.length),...u32(centralSize),...u32(centralOffset),...u16(0)]);
      return new Blob([...chunks, ...central, end], { type: 'application/zip' });
    }

    function webPackage() {
      const index = '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Semantic Vega Embed</title><style>body{margin:0;background:#f7fafc;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}header{padding:14px 18px;background:#102a43;color:white}main{padding:18px}#controls{margin-bottom:12px}#vis{background:white;border:1px solid #e5e7eb;border-radius:14px;padding:18px;overflow:auto}</style></head><body><header><h1>Semantic Vega Visualization</h1></header><main><div id="controls" data-semantic-vega-controls></div><div id="vis"></div></main><script src="https://cdn.jsdelivr.net/npm/vega@5.33.0/build/vega.min.js">\\u003c/script><script src="https://cdn.jsdelivr.net/npm/vega-lite@5.23.0/build/vega-lite.min.js">\\u003c/script><script src="https://cdn.jsdelivr.net/npm/vega-embed@6.29.0/build/vega-embed.min.js">\\u003c/script><script src="semantic-vega-runtime.js">\\u003c/script><script>SemanticVegaEmbed("#vis",' + JSON.stringify(filename) + ',{actions:true,hover:true,bind:"#controls",defaultStyle:true});\\u003c/script></body></html>';
      const readme = 'Semantic Vega Web Embed Package\n\nUpload all files together to the same folder on your website, then open index.html. Do not replace SemanticVegaEmbed with plain vegaEmbed; plain vegaEmbed will render the chart but will not attach Semantic Vega attributes.\n';
      return zipBlob([{ name: 'index.html', content: index }, { name: filename, content: svaJson }, { name: 'semantic-vega-runtime.js', content: runtimeSource }, { name: 'README.txt', content: readme }]);
    }

    function downloadChoice() {
      const chosen = document.querySelector('input[name="downloadKind"]:checked').value;
      if (chosen === 'sva') return downloadSva();
      if (chosen === 'package') return saveBlob(webPackage(), baseName() + '-web-embed-package.zip');
      return saveBlob(new Blob([standaloneHtml()], { type: 'text/html;charset=utf-8' }), baseName() + '.html');
    }

    const dialog = document.getElementById('downloadDialog');
    document.getElementById('openDownloadDialog').addEventListener('click', () => dialog.classList.add('open'));
    document.getElementById('cancelDownload').addEventListener('click', () => dialog.classList.remove('open'));
    document.getElementById('confirmDownload').addEventListener('click', () => { downloadChoice(); dialog.classList.remove('open'); });
    dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.classList.remove('open'); });
    document.getElementById('svaSource').textContent = svaJson;
    document.getElementById('embedSnippet').textContent = sva.embedding && sva.embedding.minimalHtmlSnippet ? sva.embedding.minimalHtmlSnippet : '';

    function setSummary(extra) {
      const missed = extra && extra.missed ? extra.missed.length : 0;
      document.getElementById('summary').innerHTML = [
        '<span class="pill">' + sva.artifactName + ' v' + sva.version + '</span>',
        '<div><strong>Source:</strong> ' + sva.source.language + '</div>',
        '<div><strong>Cohorts:</strong> ' + sva.semantics.cohorts.length + '</div>',
        '<div><strong>Authored labels:</strong> ' + sva.semantics.cohorts.filter(c => c.authoredRole).length + '</div>',
        '<div><strong>Widgets:</strong> ' + sva.widgets.controls.length + '</div>',
        '<div><strong>Selections:</strong> ' + sva.interactions.selections.length + '</div>',
        '<div><strong>Rehydration entries:</strong> ' + ((sva.rehydration.elements || []).length + (sva.rehydration.containers || []).length) + '</div>',
        '<div class="' + (missed ? 'warn' : 'ok') + '"><strong>Live SVG semantic rehydration:</strong> ' + (missed ? (missed + ' missed entries') : 'complete') + '</div>'
      ].join('');
    }

    async function render() {
      try {
        const result = await SemanticVegaEmbed(document.getElementById('vis'), sva, {
          actions: true,
          hover: true,
          bind: '#controls',
          defaultStyle: true
        });
        setSummary(result.initialRehydration);
      } catch (error) {
        setSummary(null);
        document.getElementById('vis').innerHTML = '<div class="error"><strong>Render problem</strong>\\n' + String(error && error.message ? error.message : error) + '</div>';
      }
    }
    render();
  </script>
</body>
</html>`;
}
