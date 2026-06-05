export type CohortType =
  | 'data-mark'
  | 'axis'
  | 'axis-ticks'
  | 'axis-labels'
  | 'axis-gridlines'
  | 'axis-domain'
  | 'axis-title'
  | 'legend'
  | 'legend-entry'
  | 'legend-symbols'
  | 'legend-labels'
  | 'legend-title'
  | 'text-label'
  | 'facet-panel'
  | 'title'
  | 'other';

export interface VisualCohort {
  id: string;
  title: string;
  type: CohortType;
  suggestedRole: string;
  evidence: string;
  elementIds: string[];
  rootIds: string[];
  count: number;
  thumbnailSvg: string;
  overlaySpec?: CohortOverlaySpec;
  /** True when this cohort should appear as a direct author-labeling target.
   *  Composite/container cohorts (whole axes/legends/legend entries) stay in metadata
   *  for hierarchy and context, but do not write user labels onto child elements. */
  authorable?: boolean;
  parentId?: string;
  childIds?: string[];
  /** True for non-authorable structural residue that should still receive compiler-derived p3 attrs on renderable elements. */
  writeCompilerAttributes?: boolean;
  /** True for structural parent/container cohorts that should be kept as hierarchy only, not as element labels. */
  containerOnly?: boolean;
  renderStatus?: 'visible' | 'nonvisible-zero-length' | 'nonvisible-layout-residue' | 'permanent-invisible-interaction-target' | 'permanent-invisible-structural' | 'conditional-visible';
  visibilityMode?: 'visible-now' | 'zero-length' | 'layout-residue' | 'permanent-invisible-interaction-target' | 'permanent-invisible-structural' | 'conditional-visible';
  interactionRole?: 'tooltip-carrier' | 'hit-target' | 'interactive-reveal' | 'none';
  authoringReason?: string;
}

export interface CohortOverlaySnapshot {
  matrix: string;
  isText: boolean;
  fill: string;
  stroke: string;
  opacity: number;
  fillOpacity: number;
  strokeOpacity: number;
  strokeWidth: number;
  strokeDasharray: string;
  textAnchor: string;
  dominantBaseline: string;
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  strokeLinecap: string;
  strokeLinejoin: string;
}

export interface CohortOverlaySpec {
  byId: Record<string, CohortOverlaySnapshot>;
}


export interface CohortVisibilityClassification {
  renderStatus: NonNullable<VisualCohort['renderStatus']>;
  visibilityMode: NonNullable<VisualCohort['visibilityMode']>;
  interactionRole: NonNullable<VisualCohort['interactionRole']>;
  authorable: boolean;
  writeCompilerAttributes: boolean;
  evidence: string;
  authoringReason?: string;
}

interface MarkInteractionVisibilityInfo {
  type: string;
  maybeInteractionRevealed: boolean;
  reasons: string[];
}

interface LatentNonRenderingElementSummary {
  id: string;
  title: string;
  type: CohortType;
  markType?: string | null;
  renderStatus: NonNullable<VisualCohort['renderStatus']>;
  visibilityMode: NonNullable<VisualCohort['visibilityMode']>;
  interactionRole: NonNullable<VisualCohort['interactionRole']>;
  memberCount: number;
  rootIds: string[];
  representativeElementIds: string[];
  evidence: string;
  policy: 'latent-metadata-only';
}


export type CohortLabels = Record<string, { role: string; x?: number; y?: number }>;

export interface ElementDataAnnotation {
  datum?: Record<string, unknown> | unknown;
  encodingChannels?: string[];
  dataFields?: string[];
}

export type ElementDataAnnotations = Record<string, ElementDataAnnotation>;

const SVG_NS = 'http://www.w3.org/2000/svg';

function safeSlug(value: string) {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return slug || 'cohort';
}

function hasClass(el: Element, cls: string) {
  return (el.getAttribute('class') || '').split(/\s+/).includes(cls);
}

function classContains(el: Element, token: string) {
  return (el.getAttribute('class') || '').includes(token);
}

function closestClass(el: Element | null, token: string): Element | null {
  let cur: Element | null = el;
  while (cur) {
    if (classContains(cur, token)) return cur;
    cur = cur.parentElement;
  }
  return null;
}

function closestRoleBoundary(el: Element | null): 'axis' | 'legend' | 'mark' | 'title' | 'none' {
  let cur: Element | null = el;
  while (cur) {
    if (hasClass(cur, 'role-axis')) return 'axis';
    if (hasClass(cur, 'role-legend')) return 'legend';
    if (hasClass(cur, 'role-title')) return 'title';
    if (hasClass(cur, 'role-mark')) return 'mark';
    cur = cur.parentElement;
  }
  return 'none';
}

function attrNumber(el: Element, name: string, fallback: number): number {
  const raw = el.getAttribute(name);
  if (raw == null || raw === '') return fallback;
  const parsed = parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function cssNumber(value: string | null | undefined, fallback: number): number {
  const parsed = parseFloat(value ?? '');
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isHidden(el: Element) {
  const display = el.getAttribute('display');
  const visibility = el.getAttribute('visibility');
  const opacity = el.getAttribute('opacity');
  const ariaHidden = el.getAttribute('aria-hidden');
  return display === 'none' || visibility === 'hidden' || opacity === '0' || ariaHidden === 'true';
}

function isDrawableElement(el: Element) {
  const tag = el.tagName.toLowerCase();
  if (!['path', 'rect', 'line', 'circle', 'ellipse', 'polygon', 'polyline', 'text', 'tspan', 'image'].includes(tag)) return false;
  const cls = el.getAttribute('class') || '';
  if (cls.includes('background') || cls.includes('foreground')) return false;
  if (tag === 'path' && !(el.getAttribute('d') || '').trim()) return false;
  if ((tag === 'text' || tag === 'tspan') && !(el.textContent || '').trim()) return false;
  return true;
}

function hasPaintInk(el: Element): boolean {
  if (isHidden(el)) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === 'image') return true;
  if (tag === 'text' || tag === 'tspan') {
    const fill = el.getAttribute('fill');
    const stroke = el.getAttribute('stroke');
    const opacity = attrNumber(el, 'opacity', 1);
    const fillOpacity = attrNumber(el, 'fill-opacity', 1);
    const strokeOpacity = attrNumber(el, 'stroke-opacity', 1);
    const strokeWidth = attrNumber(el, 'stroke-width', 0);
    return opacity > 0 && ((!paintIsNone(fill) && fillOpacity > 0) || (!paintIsNone(stroke) && strokeOpacity > 0 && strokeWidth > 0));
  }
  const fill = el.getAttribute('fill');
  const stroke = el.getAttribute('stroke');
  const opacity = attrNumber(el, 'opacity', 1);
  const fillOpacity = attrNumber(el, 'fill-opacity', 1);
  const strokeOpacity = attrNumber(el, 'stroke-opacity', 1);
  const strokeWidth = attrNumber(el, 'stroke-width', 0);
  const fillInk = !paintIsNone(fill) && fillOpacity > 0;
  const strokeInk = !paintIsNone(stroke) && strokeOpacity > 0 && strokeWidth > 0;
  return opacity > 0 && (fillInk || strokeInk);
}

function hasComputedPaintInk(el: Element): boolean {
  if (isHidden(el)) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === 'image') return true;
  let computed: CSSStyleDeclaration | null = null;
  try { computed = window.getComputedStyle(el); } catch { computed = null; }
  if (!computed) return hasPaintInk(el);
  const opacity = cssNumber(computed.opacity, 1);
  const fillOpacity = cssNumber(computed.fillOpacity, 1);
  const strokeOpacity = cssNumber(computed.strokeOpacity, 1);
  const strokeWidth = cssNumber(computed.strokeWidth, 0);
  const fillInk = !paintIsNone(computed.fill) && fillOpacity > 0;
  const strokeInk = !paintIsNone(computed.stroke) && strokeOpacity > 0 && strokeWidth > 0;
  return opacity > 0 && (fillInk || strokeInk);
}

function isRenderableElement(el: Element) {
  return isDrawableElement(el) && hasComputedPaintInk(el);
}

function getDrawableIds(root: Element): string[] {
  const ids: string[] = [];
  root.querySelectorAll('*').forEach((el) => {
    if (isDrawableElement(el)) {
      const id = el.getAttribute('p3-element-id');
      if (id) ids.push(id);
    }
  });
  return ids;
}

function getRenderableIds(root: Element): string[] {
  const ids: string[] = [];
  root.querySelectorAll('*').forEach((el) => {
    if (isRenderableElement(el)) {
      const id = el.getAttribute('p3-element-id');
      if (id) ids.push(id);
    }
  });
  return ids;
}


function elementByP3Id(root: Element, id: string): Element | null {
  return root.querySelector(`[p3-element-id="${CSS.escape(id)}"]`);
}

function isZeroLengthLine(el: Element): boolean {
  if (el.tagName.toLowerCase() !== 'line') return false;
  const num = (name: string) => {
    const value = el.getAttribute(name);
    if (value === null || value === '') return 0;
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const dx = num('x2') - num('x1');
  const dy = num('y2') - num('y1');
  return Math.hypot(dx, dy) <= 0.001;
}

function cohortHasVisibleGeometry(svg: SVGSVGElement, ids: string[]): boolean {
  for (const id of ids) {
    const el = elementByP3Id(svg, id);
    if (!el) continue;
    const tag = el.tagName.toLowerCase();
    if (tag === 'line') {
      if (!isZeroLengthLine(el)) return true;
      continue;
    }
    return true;
  }
  return false;
}

function ensureElementIds(svg: SVGSVGElement) {
  let i = 1;
  svg.setAttribute('p3-element-id', 'p3_svg_root');
  svg.querySelectorAll('*').forEach((el) => {
    if (!el.getAttribute('p3-element-id')) {
      el.setAttribute('p3-element-id', `p3_el_${String(i).padStart(5, '0')}`);
      i += 1;
    }
  });
}

function titleFromAxis(axis: Element, index: number) {
  const aria = axis.getAttribute('aria-label') || '';
  if (/x-axis/i.test(aria)) return `X axis ${index + 1}`;
  if (/y-axis/i.test(aria)) return `Y axis ${index + 1}`;
  return `Axis ${index + 1}`;
}

function suggestionFromAxis(axis: Element) {
  const aria = axis.getAttribute('aria-label') || '';
  if (/x-axis/i.test(aria)) return 'x-axis';
  if (/y-axis/i.test(aria)) return 'y-axis';
  return 'axis';
}

function markType(group: Element) {
  const cls = group.getAttribute('class') || '';
  const match = cls.match(/mark-([a-z]+)/);
  return match?.[1] ?? 'mark';
}

function suggestionFromMark(group: Element) {
  const type = markType(group);
  if (type === 'symbol') return 'data-points';
  if (type === 'rect') return 'data-bars';
  if (type === 'line') return 'data-line';
  if (type === 'area') return 'data-area';
  if (type === 'text') return 'data-labels';
  return `${type}-marks`;
}

function visibleText(root: Element, max = 50) {
  const parts: string[] = [];
  root.querySelectorAll('text').forEach((el) => {
    const text = (el.textContent || '').trim();
    if (text) parts.push(text);
  });
  return parts.slice(0, max).join(', ');
}

function buildOverlaySpecForCohort(sourceSvg: SVGSVGElement, selectedIds: string[]): CohortOverlaySpec {
  const byId: Record<string, CohortOverlaySnapshot> = {};
  const ids = Array.isArray(selectedIds) ? selectedIds : [];
  const num = (value: string | null | undefined, fallback: number) => {
    const parsed = parseFloat(value ?? '');
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  function userSpaceMatrixForElement(el: SVGGraphicsElement) {
    try {
      const svgRoot = el.ownerSVGElement ?? sourceSvg;
      const elementScreen = el.getScreenCTM?.();
      const svgScreen = svgRoot.getScreenCTM?.();
      if (!elementScreen || !svgScreen) return null;
      return svgScreen.inverse().multiply(elementScreen);
    } catch {
      return null;
    }
  }

  function matrixToString(matrix: DOMMatrix | null) {
    if (!matrix) return null;
    const values = [matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f];
    if (!values.every(Number.isFinite)) return null;
    return `matrix(${values.map((v) => Number(v.toFixed(6))).join(' ')})`;
  }

  ids.forEach((id) => {
    const el = sourceSvg.querySelector(`[p3-element-id="${CSS.escape(id)}"]`) as SVGGraphicsElement | null;
    if (!el) return;
    const tag = el.tagName.toLowerCase();
    const matrix = matrixToString(userSpaceMatrixForElement(el));
    if (!matrix) return;
    let computed: CSSStyleDeclaration | null = null;
    try { computed = window.getComputedStyle(el); } catch { computed = null; }
    byId[id] = {
      matrix,
      isText: tag === 'text' || tag === 'tspan',
      fill: computed?.fill ?? '',
      stroke: computed?.stroke ?? '',
      opacity: num(computed?.opacity, 1),
      fillOpacity: num(computed?.fillOpacity, 1),
      strokeOpacity: num(computed?.strokeOpacity, 1),
      strokeWidth: num(computed?.strokeWidth, 0),
      strokeDasharray: computed?.strokeDasharray ?? '',
      textAnchor: computed?.textAnchor ?? '',
      dominantBaseline: computed?.dominantBaseline ?? '',
      fontFamily: computed?.fontFamily ?? '',
      fontSize: computed?.fontSize ?? '',
      fontWeight: computed?.fontWeight ?? '',
      strokeLinecap: computed?.strokeLinecap ?? '',
      strokeLinejoin: computed?.strokeLinejoin ?? ''
    };
  });

  return { byId };
}

function setStyleImportant(el: Element, prop: string, value: string) {
  const target = el as HTMLElement | SVGElement;
  try {
    target.style.setProperty(prop, value, 'important');
  } catch {
    const current = el.getAttribute('style') || '';
    const cleaned = current.replace(new RegExp(`(^|;)\\s*${prop}\\s*:[^;]*;?`, 'ig'), ';').replace(/;;+/g, ';').trim();
    el.setAttribute('style', `${cleaned}${cleaned && !cleaned.endsWith(';') ? ';' : ''} ${prop}: ${value} !important;`.trim());
  }
}

function stripTransformsDeep(node: Element) {
  node.removeAttribute('transform');
  node.querySelectorAll('*').forEach((child) => child.removeAttribute('transform'));
}

function paintIsNone(value: string | null | undefined) {
  const text = String(value ?? '').trim().toLowerCase();
  return !text || text === 'none' || text === 'transparent' || text === 'rgba(0, 0, 0, 0)' || text === 'rgba(0,0,0,0)';
}

function applySnapshotAsBlue(clone: SVGElement, snapshot: CohortOverlaySnapshot) {
  const blue = '#2563eb';
  const fillOn = !paintIsNone(snapshot.fill) && snapshot.fillOpacity > 0;
  const strokeOn = !paintIsNone(snapshot.stroke) && snapshot.strokeOpacity > 0 && snapshot.strokeWidth > 0;

  clone.setAttribute('opacity', String(snapshot.opacity));
  setStyleImportant(clone, 'opacity', String(snapshot.opacity));

  if (fillOn) {
    clone.setAttribute('fill', blue);
    clone.setAttribute('fill-opacity', String(snapshot.fillOpacity));
    setStyleImportant(clone, 'fill', blue);
    setStyleImportant(clone, 'fill-opacity', String(snapshot.fillOpacity));
  } else {
    clone.setAttribute('fill', 'none');
    clone.setAttribute('fill-opacity', '0');
    setStyleImportant(clone, 'fill', 'none');
    setStyleImportant(clone, 'fill-opacity', '0');
  }

  if (strokeOn) {
    clone.setAttribute('stroke', blue);
    clone.setAttribute('stroke-opacity', String(snapshot.strokeOpacity));
    clone.setAttribute('stroke-width', String(snapshot.strokeWidth));
    setStyleImportant(clone, 'stroke', blue);
    setStyleImportant(clone, 'stroke-opacity', String(snapshot.strokeOpacity));
    setStyleImportant(clone, 'stroke-width', String(snapshot.strokeWidth));
    if (snapshot.strokeDasharray && snapshot.strokeDasharray !== 'none') {
      clone.setAttribute('stroke-dasharray', snapshot.strokeDasharray);
      setStyleImportant(clone, 'stroke-dasharray', snapshot.strokeDasharray);
    }
    if (snapshot.strokeLinecap) clone.setAttribute('stroke-linecap', snapshot.strokeLinecap);
    if (snapshot.strokeLinejoin) clone.setAttribute('stroke-linejoin', snapshot.strokeLinejoin);
  } else {
    clone.setAttribute('stroke', 'none');
    clone.setAttribute('stroke-opacity', '0');
    setStyleImportant(clone, 'stroke', 'none');
    setStyleImportant(clone, 'stroke-opacity', '0');
  }

  if (snapshot.isText) {
    if (snapshot.textAnchor) clone.setAttribute('text-anchor', snapshot.textAnchor);
    if (snapshot.dominantBaseline) clone.setAttribute('dominant-baseline', snapshot.dominantBaseline);
    if (snapshot.fontFamily) {
      clone.setAttribute('font-family', snapshot.fontFamily);
      setStyleImportant(clone, 'font-family', snapshot.fontFamily);
    }
    if (snapshot.fontSize) {
      clone.setAttribute('font-size', snapshot.fontSize);
      setStyleImportant(clone, 'font-size', snapshot.fontSize);
    }
    if (snapshot.fontWeight) {
      clone.setAttribute('font-weight', snapshot.fontWeight);
      setStyleImportant(clone, 'font-weight', snapshot.fontWeight);
    }
  }

  clone.setAttribute('visibility', 'visible');
  setStyleImportant(clone, 'visibility', 'visible');
}

function recolorContextElement(el: SVGElement, compact: boolean) {
  const tag = el.tagName.toLowerCase();
  if (tag === 'text' || tag === 'tspan') {
    el.setAttribute('fill', '#b00000');
    el.setAttribute('stroke', 'none');
    setStyleImportant(el, 'fill', '#b00000');
    setStyleImportant(el, 'fill-opacity', compact ? '0.18' : '0.252');
    setStyleImportant(el, 'stroke', 'none');
    setStyleImportant(el, 'opacity', '1');
    return;
  }
  if (tag === 'line' || tag === 'path' || tag === 'polyline' || tag === 'polygon') {
    el.setAttribute('stroke', '#b00000');
    setStyleImportant(el, 'stroke', '#b00000');
    setStyleImportant(el, 'stroke-opacity', compact ? '0.025' : '0.03');
  }
  if (tag !== 'line' && tag !== 'polyline') {
    el.setAttribute('fill', '#b00000');
    setStyleImportant(el, 'fill', '#b00000');
    setStyleImportant(el, 'fill-opacity', compact ? '0.02' : '0.03');
  }
  setStyleImportant(el, 'opacity', '1');
}

function buildHighlightedSvg(sourceSvg: SVGSVGElement, selectedIds: string[], label?: { role: string; x?: number; y?: number }, compact = false, overlaySpec?: CohortOverlaySpec) {
  const clone = sourceSvg.cloneNode(true) as SVGSVGElement;
  const selected = new Set(selectedIds);
  const renderTags = new Set(['path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'tspan', 'image']);
  clone.setAttribute('style', 'background-color:white;');

  clone.querySelector('#cohort-highlight-overlay')?.remove();
  const overlay = clone.ownerDocument.createElementNS(SVG_NS, 'g');
  overlay.setAttribute('id', 'cohort-highlight-overlay');
  overlay.setAttribute('pointer-events', 'auto');

  clone.querySelectorAll('*').forEach((el) => {
    const tag = el.tagName.toLowerCase();
    if (!renderTags.has(tag)) return;
    const id = el.getAttribute('p3-element-id');
    const isSelected = Boolean(id && selected.has(id));
    const node = el as SVGElement;
    if (isSelected) {
      node.setAttribute('visibility', 'hidden');
      node.setAttribute('opacity', '0');
      setStyleImportant(node, 'visibility', 'hidden');
      setStyleImportant(node, 'opacity', '0');
      if (!id) return;
      const snapshot = overlaySpec?.byId?.[id];
      if (!snapshot) return;
      const clonedNode = node.cloneNode(true) as SVGElement;
      clonedNode.removeAttribute('id');
      clonedNode.setAttribute('data-cohort-member', 'true');
      clonedNode.setAttribute('pointer-events', 'visiblePainted');
      clonedNode.setAttribute('cursor', 'pointer');
      stripTransformsDeep(clonedNode);
      clonedNode.setAttribute('transform', snapshot.matrix);
      applySnapshotAsBlue(clonedNode, snapshot);
      overlay.appendChild(clonedNode);
    } else {
      recolorContextElement(node, compact);
    }
  });

  clone.appendChild(overlay);

  if (label?.role) {
    const text = document.createElementNS(SVG_NS, 'text');
    text.textContent = label.role;
    text.setAttribute('data-cohort-label', 'true');
    text.setAttribute('x', String(label.x ?? 12));
    text.setAttribute('y', String(label.y ?? 24));
    text.setAttribute('font-family', 'Inter, system-ui, sans-serif');
    text.setAttribute('font-size', compact ? '18' : '14');
    text.setAttribute('font-weight', '700');
    text.setAttribute('fill', '#1d4ed8');
    text.setAttribute('stroke', 'white');
    text.setAttribute('stroke-width', '3');
    text.setAttribute('paint-order', 'stroke');
    clone.appendChild(text);
  }

  return new XMLSerializer().serializeToString(clone);
}

function toDataUrl(svgSource: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgSource)}`;
}


function collectCohortElements(svg: SVGSVGElement, ids: string[]): Element[] {
  return ids.map((id) => elementByP3Id(svg, id)).filter((el): el is Element => Boolean(el));
}

function elementHasVisibleInkForCohorting(el: Element): boolean {
  if (!isDrawableElement(el)) return false;
  if (el.tagName.toLowerCase() === 'line' && isZeroLengthLine(el)) return false;
  return hasComputedPaintInk(el);
}

function splitDrawableIdsByVisibleInk(svg: SVGSVGElement, ids: string[]): { visibleIds: string[]; nonVisibleIds: string[] } {
  const visibleIds: string[] = [];
  const nonVisibleIds: string[] = [];
  ids.forEach((id) => {
    const el = elementByP3Id(svg, id);
    if (!el) return;
    if (elementHasVisibleInkForCohorting(el)) visibleIds.push(id);
    else nonVisibleIds.push(id);
  });
  return { visibleIds, nonVisibleIds };
}

function groupHasAnyVisibleInk(group: Element): boolean {
  return getDrawableIds(group).some((id) => {
    const svg = (group as SVGElement).ownerSVGElement;
    const el = svg ? elementByP3Id(svg, id) : null;
    return Boolean(el && elementHasVisibleInkForCohorting(el));
  });
}

function idsHaveVisibleInk(svg: SVGSVGElement, ids: string[]): boolean {
  return collectCohortElements(svg, ids).some((el) => {
    if (el.tagName.toLowerCase() === 'line' && isZeroLengthLine(el)) return false;
    return isDrawableElement(el) && hasComputedPaintInk(el);
  });
}

function idsHaveDrawableGeometry(svg: SVGSVGElement, ids: string[]): boolean {
  return collectCohortElements(svg, ids).some((el) => {
    if (!isDrawableElement(el)) return false;
    if (el.tagName.toLowerCase() === 'line' && isZeroLengthLine(el)) return false;
    return true;
  });
}

function hasTooltipLikeElement(group: Element): boolean {
  const text = (group.getAttribute('aria-label') || group.getAttribute('aria-roledescription') || '').toLowerCase();
  if (text.includes('tooltip')) return true;
  return Array.from(group.querySelectorAll('title, desc')).some((el) => /tooltip/i.test(el.textContent || ''));
}

function pointerEventsCanReceiveInput(el: Element): boolean {
  const raw = (el.getAttribute('pointer-events') || '').trim().toLowerCase();
  if (raw === 'none') return false;
  try {
    const computed = window.getComputedStyle(el);
    return (computed.pointerEvents || '').toLowerCase() !== 'none';
  } catch {
    return raw !== 'none';
  }
}

function hasInvisibleHitTargetShape(group: Element): boolean {
  // Opacity-0 marks are common in Vega as layout/scaffold marks. Do not classify
  // them as tooltip/hit-target carriers unless they can actually receive input.
  return Array.from(group.querySelectorAll('*')).some((el) => (
    isDrawableElement(el) &&
    !hasComputedPaintInk(el) &&
    pointerEventsCanReceiveInput(el)
  ));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function valueLooksInteractive(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(valueLooksInteractive);
  if (!isPlainObject(value)) return false;
  const keys = Object.keys(value);
  if (keys.some((key) => ['signal', 'test', 'expr'].includes(key))) return true;
  return keys.some((key) => valueLooksInteractive(value[key]));
}

function visualChannelLooksConditional(definition: unknown): boolean {
  if (Array.isArray(definition)) return true;
  if (!isPlainObject(definition)) return false;
  if (valueLooksInteractive(definition)) return true;
  return false;
}

function collectMarkInteractionVisibilityInfo(spec: unknown): Map<string, MarkInteractionVisibilityInfo> {
  const out = new Map<string, MarkInteractionVisibilityInfo>();
  const visualChannels = new Set(['opacity', 'fillOpacity', 'strokeOpacity', 'fill', 'stroke', 'size', 'strokeWidth', 'display', 'visibility']);
  const addReason = (type: string, reason: string) => {
    const bucket = out.get(type) ?? { type, maybeInteractionRevealed: false, reasons: [] };
    bucket.maybeInteractionRevealed = true;
    bucket.reasons.push(reason);
    out.set(type, bucket);
  };
  const scanEncode = (type: string, encode: unknown) => {
    if (!isPlainObject(encode)) return;
    Object.entries(encode).forEach(([phase, phaseValue]) => {
      if (!isPlainObject(phaseValue)) return;
      if (phase === 'hover') addReason(type, 'Vega encode.hover block can change mark appearance during interaction.');
      Object.entries(phaseValue).forEach(([channel, definition]) => {
        if (!visualChannels.has(channel)) return;
        if (visualChannelLooksConditional(definition)) addReason(type, `Visual channel ${channel} uses signal/test/conditional encoding in ${phase}.`);
      });
    });
  };
  const visitMarks = (marks: unknown) => {
    if (!Array.isArray(marks)) return;
    marks.forEach((mark) => {
      if (!isPlainObject(mark)) return;
      const type = typeof mark.type === 'string' ? mark.type : 'mark';
      scanEncode(type, mark.encode);
      visitMarks(mark.marks);
    });
  };
  visitMarks((spec as Record<string, unknown> | null | undefined)?.marks);
  return out;
}

function classifyCohortVisibility(svg: SVGSVGElement, ids: string[], groups: Element[], markTypeName: string | null, interactionInfo: Map<string, MarkInteractionVisibilityInfo>): CohortVisibilityClassification {
  const hasGeometry = idsHaveDrawableGeometry(svg, ids);
  const hasInk = idsHaveVisibleInk(svg, ids);
  if (hasInk) {
    return {
      renderStatus: 'visible',
      visibilityMode: 'visible-now',
      interactionRole: 'none',
      authorable: true,
      writeCompilerAttributes: false,
      evidence: 'Visible rendered ink was detected for this cohort.'
    };
  }
  if (!hasGeometry) {
    return {
      renderStatus: 'nonvisible-zero-length',
      visibilityMode: 'zero-length',
      interactionRole: 'none',
      authorable: false,
      writeCompilerAttributes: false,
      evidence: 'No non-zero visible geometry was found for this cohort.',
      authoringReason: 'Excluded from normal cohorting because all members have zero-length or no visible geometry.'
    };
  }
  const info = markTypeName ? interactionInfo.get(markTypeName) : undefined;
  if (info?.maybeInteractionRevealed) {
    return {
      renderStatus: 'conditional-visible',
      visibilityMode: 'conditional-visible',
      interactionRole: 'interactive-reveal',
      authorable: false,
      writeCompilerAttributes: false,
      evidence: info.reasons.join(' '),
      authoringReason: 'Initially invisible; retained only as compact latent metadata because it may become visible through interaction.'
    };
  }
  const tooltipLike = groups.some(hasTooltipLikeElement) || groups.some(hasInvisibleHitTargetShape);
  return {
    renderStatus: tooltipLike ? 'permanent-invisible-interaction-target' : 'permanent-invisible-structural',
    visibilityMode: tooltipLike ? 'permanent-invisible-interaction-target' : 'permanent-invisible-structural',
    interactionRole: tooltipLike ? 'tooltip-carrier' : 'none',
    authorable: false,
    writeCompilerAttributes: false,
    evidence: tooltipLike
      ? 'Drawable elements exist but have no visible ink; this looks like a permanent invisible tooltip/hit-target mark.'
      : 'Drawable elements exist but have no visible ink and no interaction-reveal evidence was found.',
    authoringReason: tooltipLike
      ? 'Excluded from normal cohorting and retained only as compact latent metadata because it has no visible ink and appears to serve as an invisible tooltip/hit-target carrier.'
      : 'Excluded from normal cohorting because it has no visible ink and no interaction-reveal evidence was found.'
  };
}

function classifyNonVisibleResidue(reason: string): CohortVisibilityClassification {
  return {
    renderStatus: 'nonvisible-layout-residue',
    visibilityMode: 'layout-residue',
    interactionRole: 'none',
    authorable: false,
    writeCompilerAttributes: false,
    evidence: reason,
    authoringReason: 'Excluded from normal cohorting because these drawable elements have no perceivable ink in the current render. They are retained only as latent layout/residue metadata.'
  };
}

function applyVisibilityClassification<T extends Omit<VisualCohort, 'thumbnailSvg'>>(cohort: T, classification: CohortVisibilityClassification): T {
  return {
    ...cohort,
    authorable: classification.authorable,
    writeCompilerAttributes: classification.writeCompilerAttributes || cohort.writeCompilerAttributes,
    renderStatus: classification.renderStatus,
    visibilityMode: classification.visibilityMode,
    interactionRole: classification.interactionRole,
    evidence: cohort.evidence ? `${cohort.evidence} ${classification.evidence}` : classification.evidence,
    authoringReason: classification.authoringReason || cohort.authoringReason
  };
}

function addCohort(cohorts: Omit<VisualCohort, 'thumbnailSvg'>[], seen: Set<string>, sourceSvg: SVGSVGElement, cohort: Omit<VisualCohort, 'thumbnailSvg'>) {
  const ids = Array.from(new Set(cohort.elementIds)).filter(Boolean);
  if (ids.length === 0) return;
  const key = `${cohort.type}:${ids.join('|')}`;
  if (seen.has(key)) return;
  seen.add(key);
  cohorts.push({ ...cohort, elementIds: ids, count: ids.length });
}

function shouldMaterializeAsNormalCohort(cohort: Omit<VisualCohort, 'thumbnailSvg'>): boolean {
  if (cohort.containerOnly === true) return true;
  if (cohort.renderStatus && cohort.renderStatus !== 'visible') return false;
  return cohort.authorable !== false || cohort.writeCompilerAttributes === true;
}

function summarizeLatentNonRenderingCohort(cohort: Omit<VisualCohort, 'thumbnailSvg'>, markTypeName?: string | null): LatentNonRenderingElementSummary {
  return {
    id: cohort.id,
    title: cohort.title,
    type: cohort.type,
    markType: markTypeName ?? null,
    renderStatus: cohort.renderStatus || 'permanent-invisible-structural',
    visibilityMode: cohort.visibilityMode || 'permanent-invisible-structural',
    interactionRole: cohort.interactionRole || 'none',
    memberCount: cohort.elementIds.length,
    rootIds: cohort.rootIds,
    representativeElementIds: cohort.elementIds.slice(0, 6),
    evidence: cohort.evidence,
    policy: 'latent-metadata-only'
  };
}

function appendLatentNonRenderingMetadata(svg: SVGSVGElement, latent: LatentNonRenderingElementSummary[]) {
  const doc = svg.ownerDocument;
  svg.querySelector('metadata[p3-kind="semantic-vega-latent-nonrendering"]')?.remove();
  if (!latent.length) return;
  const metadataEl = doc.createElementNS(SVG_NS, 'metadata');
  metadataEl.setAttribute('p3-kind', 'semantic-vega-latent-nonrendering');
  metadataEl.setAttribute('type', 'application/json');
  metadataEl.textContent = JSON.stringify({
    policy: 'rendered-semantics-v1',
    description: 'Non-rendering marks/scenegraph residue are not materialized as authorable cohorts. Interaction-dependent hidden elements are preserved here as compact latent metadata only.',
    count: latent.length,
    items: latent
  }, null, 2);
  svg.insertBefore(metadataEl, svg.firstChild);
}

function readLatentNonRenderingMetadata(svg: SVGSVGElement): unknown | null {
  const raw = svg.querySelector('metadata[p3-kind="semantic-vega-latent-nonrendering"]')?.textContent;
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function discoverVisualCohorts(svg: SVGSVGElement, compiledSpec?: unknown): { sourceSvg: string; cohorts: VisualCohort[] } {
  ensureElementIds(svg);
  const interactionInfo = collectMarkInteractionVisibilityInfo(compiledSpec);
  const cohorts: Omit<VisualCohort, 'thumbnailSvg'>[] = [];
  const latentNonRendering: LatentNonRenderingElementSummary[] = [];
  const seen = new Set<string>();

  const axisGroups = Array.from(svg.querySelectorAll('g.role-axis')) as Element[];
  axisGroups.forEach((axis, index) => {
    const rootId = axis.getAttribute('p3-element-id') || `axis-${index}`;
    const axisId = `cohort_axis_${index}_${safeSlug(rootId)}`;
    const ids = getRenderableIds(axis);
    const childIds: string[] = [];

    const subparts: Array<[string, CohortType, string, string]> = [
      ['.role-axis-tick', 'axis-ticks', 'axis ticks', 'axis-ticks'],
      ['.role-axis-label', 'axis-labels', 'axis tick labels', 'axis-labels'],
      ['.role-axis-grid', 'axis-gridlines', 'axis gridlines', 'axis-gridlines'],
      ['.role-axis-domain', 'axis-domain', 'axis domain line', 'axis-domain'],
      ['.role-axis-title', 'axis-title', 'axis title', 'axis-title']
    ];
    subparts.forEach(([selector, type, title, suggestion]) => {
      const els = Array.from(axis.querySelectorAll(selector));
      const ids2 = Array.from(new Set(els.flatMap((el) => getRenderableIds(el))));
      if (ids2.length > 0) {
        const childId = `cohort_${type}_${index}_${safeSlug(rootId)}`;
        const hasVisibleGeometry = cohortHasVisibleGeometry(svg, ids2);
        const isNonvisibleTickCohort = type === 'axis-ticks' && !hasVisibleGeometry;
        const axisSubcohort = {
          id: childId,
          title: `${title} · ${titleFromAxis(axis, index)}`,
          type,
          suggestedRole: suggestion,
          evidence: isNonvisibleTickCohort
            ? `Structural zero-length tick placeholders inside ${titleFromAxis(axis, index)}; excluded from normal cohorting under the rendered-semantics policy.`
            : `Subcohort inside ${titleFromAxis(axis, index)}`,
          elementIds: ids2,
          rootIds: els.map((el) => el.getAttribute('p3-element-id') || '').filter(Boolean),
          count: ids2.length,
          authorable: !isNonvisibleTickCohort,
          parentId: axisId,
          writeCompilerAttributes: false,
          renderStatus: isNonvisibleTickCohort ? 'nonvisible-zero-length' as const : 'visible' as const,
          visibilityMode: isNonvisibleTickCohort ? 'zero-length' as const : 'visible-now' as const,
          interactionRole: 'none' as const,
          authoringReason: isNonvisibleTickCohort ? 'Excluded from normal cohorting because all tick members are zero-length lines with no visible blue ink.' : undefined
        };
        if (isNonvisibleTickCohort) {
          latentNonRendering.push(summarizeLatentNonRenderingCohort(axisSubcohort, null));
        } else {
          childIds.push(childId);
          addCohort(cohorts, seen, svg, axisSubcohort);
        }
      }
    });

    addCohort(cohorts, seen, svg, {
      id: axisId,
      title: titleFromAxis(axis, index),
      type: 'axis',
      suggestedRole: suggestionFromAxis(axis),
      evidence: axis.getAttribute('aria-label') || 'Vega role-axis group',
      elementIds: ids,
      rootIds: [rootId],
      count: ids.length,
      authorable: false,
      containerOnly: true,
      childIds
    });
  });

  const legendGroups = Array.from(svg.querySelectorAll('g.role-legend')) as Element[];
  legendGroups.forEach((legend, index) => {
    const rootId = legend.getAttribute('p3-element-id') || `legend-${index}`;
    const legendId = `cohort_legend_${index}_${safeSlug(rootId)}`;
    const aria = legend.getAttribute('aria-label') || '';
    const ids = getRenderableIds(legend);
    const childIds: string[] = [];

    const legendParts: Array<[string, CohortType, string, string, boolean]> = [
      ['.role-legend-entry', 'legend-entry', 'legend entries', 'legend-entry', false],
      ['.role-legend-symbol', 'legend-symbols', 'legend symbols', 'legend-symbols', true],
      ['.role-legend-label', 'legend-labels', 'legend labels', 'legend-labels', true],
      ['.role-legend-title', 'legend-title', 'legend title', 'legend-title', true]
    ];
    legendParts.forEach(([selector, type, title, suggestion, authorable]) => {
      const els = Array.from(legend.querySelectorAll(selector));
      const ids2 = Array.from(new Set(els.flatMap((el) => getRenderableIds(el))));
      if (ids2.length > 0) {
        const childId = `cohort_${type}_${index}_${safeSlug(rootId)}`;
        childIds.push(childId);
        addCohort(cohorts, seen, svg, {
          id: childId,
          title: `${title} · legend ${index + 1}`,
          type,
          suggestedRole: suggestion,
          evidence: `Subcohort inside legend ${index + 1}`,
          elementIds: ids2,
          rootIds: els.map((el) => el.getAttribute('p3-element-id') || '').filter(Boolean),
          count: ids2.length,
          authorable,
          containerOnly: !authorable,
          parentId: legendId
        });
      }
    });

    addCohort(cohorts, seen, svg, {
      id: legendId,
      title: `Legend ${index + 1}`,
      type: 'legend',
      suggestedRole: aria.includes('Year') ? 'year-legend' : 'legend',
      evidence: aria || 'Vega role-legend group',
      elementIds: ids,
      rootIds: [rootId],
      count: ids.length,
      authorable: false,
      containerOnly: true,
      childIds
    });
  });

  const markGroups = Array.from(svg.querySelectorAll('g.role-mark')) as Element[];
  const markBuckets = new Map<string, Element[]>();
  markGroups.forEach((group) => {
    if (closestRoleBoundary(group.parentElement) === 'axis' || closestRoleBoundary(group.parentElement) === 'legend') return;
    const type = markType(group);
    const key = `mark-${type}`;
    markBuckets.set(key, [...(markBuckets.get(key) ?? []), group]);
  });
  Array.from(markBuckets.entries()).forEach(([key, groups], index) => {
    const type = key.replace('mark-', '');
    const allIds = Array.from(new Set(groups.flatMap((group) => getDrawableIds(group))));
    const { visibleIds, nonVisibleIds } = splitDrawableIdsByVisibleInk(svg, allIds);
    const visibleGroups = groups.filter(groupHasAnyVisibleInk);
    const nonVisibleGroups = groups.filter((group) => !groupHasAnyVisibleInk(group));
    const baseId = `cohort_data_${safeSlug(key)}_${index}`;
    const baseTitle = `${type} data marks`;
    const baseType = type === 'text' ? 'text-label' as CohortType : 'data-mark' as CohortType;
    const baseEvidence = `${groups.length} Vega role-mark group(s); class=${groups[0].getAttribute('class') || ''}`;

    if (visibleIds.length > 0) {
      const visibleBase = {
        id: baseId,
        title: baseTitle,
        type: baseType,
        suggestedRole: suggestionFromMark(visibleGroups[0] || groups[0]),
        evidence: nonVisibleIds.length > 0
          ? `${baseEvidence} Visible rendered ink was materialized; ${nonVisibleIds.length} non-visible drawable layout/residue element(s) were excluded from this normal cohort.`
          : baseEvidence,
        elementIds: visibleIds,
        rootIds: (visibleGroups.length ? visibleGroups : groups).map((el) => el.getAttribute('p3-element-id') || '').filter(Boolean),
        count: visibleIds.length,
        authorable: true
      };
      const classified = applyVisibilityClassification(visibleBase, classifyCohortVisibility(svg, visibleIds, visibleGroups.length ? visibleGroups : groups, type, interactionInfo));
      if (shouldMaterializeAsNormalCohort(classified)) {
        addCohort(cohorts, seen, svg, classified);
      } else {
        latentNonRendering.push(summarizeLatentNonRenderingCohort(classified, type));
      }
    }

    if (nonVisibleIds.length > 0) {
      const residueBase = {
        id: `${baseId}_latent-layout-residue`,
        title: `${baseTitle} · non-visible layout residue`,
        type: baseType,
        suggestedRole: suggestionFromMark(nonVisibleGroups[0] || groups[0]),
        evidence: `${baseEvidence} ${nonVisibleIds.length} drawable element(s) have no visible ink in the current render.`,
        elementIds: nonVisibleIds,
        rootIds: (nonVisibleGroups.length ? nonVisibleGroups : groups).map((el) => el.getAttribute('p3-element-id') || '').filter(Boolean),
        count: nonVisibleIds.length,
        authorable: false
      };
      const info = type ? interactionInfo.get(type) : undefined;
      const classified = info?.maybeInteractionRevealed
        ? applyVisibilityClassification(residueBase, classifyCohortVisibility(svg, nonVisibleIds, nonVisibleGroups.length ? nonVisibleGroups : groups, type, interactionInfo))
        : applyVisibilityClassification(residueBase, classifyNonVisibleResidue('Drawable elements have no visible ink in the current render and are treated as layout/residue rather than authorable visualization content.'));
      latentNonRendering.push(summarizeLatentNonRenderingCohort(classified, type));
    }
  });

  const titles = Array.from(svg.querySelectorAll('g.role-title, g.role-title-text')) as Element[];
  titles.forEach((title, index) => {
    const ids = getRenderableIds(title);
    addCohort(cohorts, seen, svg, {
      id: `cohort_title_${index}`,
      title: `Title ${index + 1}`,
      type: 'title',
      suggestedRole: 'chart-title',
      evidence: visibleText(title) || 'Vega title group',
      elementIds: ids,
      rootIds: [title.getAttribute('p3-element-id') || ''].filter(Boolean),
      count: ids.length,
      authorable: true
    });
  });

  appendLatentNonRenderingMetadata(svg, latentNonRendering);
  const sourceSvg = new XMLSerializer().serializeToString(svg);
  const visualCohorts = cohorts.map((cohort) => {
    const overlaySpec = buildOverlaySpecForCohort(svg, cohort.elementIds);
    return {
      ...cohort,
      overlaySpec,
      thumbnailSvg: toDataUrl(buildHighlightedSvg(svg, cohort.elementIds, undefined, true, overlaySpec))
    };
  });

  return { sourceSvg, cohorts: visualCohorts };
}

export function renderCohortFocusSvg(sourceSvg: string, cohort: VisualCohort | null, labels: CohortLabels): string {
  if (!cohort) return sourceSvg;
  const doc = new DOMParser().parseFromString(sourceSvg, 'image/svg+xml');
  const svg = doc.documentElement as unknown as SVGSVGElement;
  return buildHighlightedSvg(svg, cohort.elementIds, labels[cohort.id], false, cohort.overlaySpec);
}


function nearestMarkType(el: Element): string | null {
  let cur: Element | null = el;
  while (cur) {
    const cls = cur.getAttribute('class') || '';
    const match = cls.match(/mark-([a-z]+)/);
    if (match?.[1]) return match[1];
    cur = cur.parentElement;
  }
  return null;
}

function inferP3Mark(el: Element, cohort: VisualCohort): string {
  const tag = el.tagName.toLowerCase();
  const mark = nearestMarkType(el);
  if (mark && mark !== 'group') {
    if (mark === 'rule') return 'rule';
    if (mark === 'symbol') return 'symbol';
    if (mark === 'rect') return 'rect';
    if (mark === 'line') return 'line';
    if (mark === 'area') return 'area';
    if (mark === 'text') return 'text';
    if (mark === 'path') return 'path';
    return mark;
  }
  if (tag === 'line') return 'rule';
  if (tag === 'text') return 'text';
  if (tag === 'rect') return 'rect';
  if (tag === 'circle' || tag === 'ellipse') return 'symbol';
  if (tag === 'path' && cohort.type.includes('axis')) return 'rule';
  return tag || 'mark';
}

function inferP3ShapeDescriptor(el: Element, cohort: VisualCohort, mark: string): string {
  const tag = el.tagName.toLowerCase();
  if (tag === 'text') return 'text';
  if (tag === 'line') return 'line';
  if (tag === 'rect') return 'rectangle';
  if (tag === 'circle') return 'circle';
  if (tag === 'ellipse') return 'ellipse';
  if (tag === 'polygon') return 'polygon';
  if (tag === 'polyline') return 'polyline';
  if (mark === 'symbol') return 'circle-symbol';
  if (mark === 'line') return 'line-path';
  if (mark === 'area') return 'area-path';
  if (cohort.type === 'axis-domain') return 'axis-domain-path';
  if (tag === 'path') return 'path';
  return tag || mark || 'shape';
}

function inferP3DataRole(cohort: VisualCohort, authorRole: string): string {
  const role = (authorRole || '').toLowerCase();
  if (role.includes('title')) return 'title';
  if (cohort.type === 'data-mark') return 'data';
  if (cohort.type === 'text-label') return role ? 'label' : 'data';
  if (cohort.type === 'title') return 'title';
  if (cohort.type === 'axis-labels') return 'scale-label';
  if (cohort.type === 'axis-title') return 'axis-title';
  if (cohort.type === 'axis-gridlines' || cohort.type === 'axis-domain' || cohort.type === 'axis-ticks') return 'reference';
  if (cohort.type === 'legend-symbols' || cohort.type === 'legend-labels' || cohort.type === 'legend-title' || cohort.type === 'legend-entry' || cohort.type === 'legend') return 'legend';
  if (cohort.type === 'facet-panel') return 'layout';
  if (role.includes('label')) return 'label';
  return 'visual';
}

function inferCohortVizPart(cohort: VisualCohort): string {
  const vizPartByCohortType: Record<string, string> = {
    axis: 'axis',
    'axis-ticks': 'axis-tick',
    'axis-labels': 'axis-tick-label',
    'axis-gridlines': 'axis-gridline',
    'axis-domain': 'axis-domain',
    'axis-title': 'axis-title',
    legend: 'legend',
    'legend-entry': 'legend-entry',
    'legend-symbols': 'legend-symbol',
    'legend-labels': 'legend-label',
    'legend-title': 'legend-title',
    title: 'chart-title',
    'text-label': 'text-label',
    'facet-panel': 'facet-panel'
  };
  return cohort.type === 'data-mark' ? 'data-mark' : (vizPartByCohortType[cohort.type] ?? cohort.type);
}



function sanitizeDataValue(value: unknown, depth = 0): unknown {
  if (value == null) return value;
  if (depth > 3) return '[MaxDepth]';
  const type = typeof value;
  if (type === 'string') { const text = value as string; return text.length > 500 ? `${text.slice(0, 500)}…` : text; }
  if (type === 'number' || type === 'boolean') return value;
  if (type === 'bigint') return String(value);
  if (Array.isArray(value)) return value.slice(0, 40).map((item) => sanitizeDataValue(item, depth + 1));
  if (type === 'object') {
    const out: Record<string, unknown> = {};
    const source = value as Record<string, unknown>;
    Object.keys(source).slice(0, 80).forEach((key) => {
      if (key.startsWith('_') || key === 'mark' || key === 'items' || key === 'bounds') return;
      const v = source[key];
      if (typeof v === 'function' || typeof v === 'symbol' || typeof v === 'undefined') return;
      out[key] = sanitizeDataValue(v, depth + 1);
    });
    return out;
  }
  return String(value);
}

function tryJsonAttribute(value: unknown): string | null {
  try {
    return JSON.stringify(sanitizeDataValue(value));
  } catch {
    return null;
  }
}


function cssAttrSelector(name: string, value: string): string {
  return `[${name}="${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`;
}

function queryByP3ElementId(root: Element, id: string): SVGElement | null {
  return root.querySelector(`[p3-element-id="${CSS.escape(id)}"]`) as SVGElement | null;
}

function renderableElementsForCohort(svg: SVGSVGElement, cohort: VisualCohort): SVGElement[] {
  return cohort.elementIds
    .map((id) => queryByP3ElementId(svg, id))
    .filter((el): el is SVGElement => !!el && isRenderableElement(el));
}

function uniqueSorted(values: Array<string | null | undefined>, max = 24): string[] {
  return Array.from(new Set(values.filter((v): v is string => !!v && String(v).trim() !== '').map((v) => String(v)))).sort().slice(0, max);
}

function summarizePaintValues(elements: SVGElement[]) {
  const read = (attr: string) => uniqueSorted(elements.map((el) => el.getAttribute(attr)));
  return {
    fill: read('fill'),
    fillOpacity: read('fill-opacity'),
    stroke: read('stroke'),
    strokeOpacity: read('stroke-opacity'),
    strokeWidth: read('stroke-width'),
    opacity: read('opacity')
  };
}

function summarizeTextValues(elements: SVGElement[]) {
  const texts = uniqueSorted(elements.map((el) => el.tagName.toLowerCase() === 'text' ? (el.textContent || '').trim() : ''), 60);
  return {
    hasText: texts.length > 0,
    textCount: texts.length,
    sample: texts.slice(0, 12),
    values: texts
  };
}

function parseTranslate(transform: string | null): { x: number; y: number } | null {
  if (!transform) return null;
  const match = transform.match(/translate\(([-+]?\d*\.?\d+(?:e[-+]?\d+)?)(?:[ ,]+([-+]?\d*\.?\d+(?:e[-+]?\d+)?))?\)/i);
  if (!match) return null;
  const x = Number(match[1]);
  const y = match[2] == null ? 0 : Number(match[2]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

function summarizeGeometry(elements: SVGElement[]) {
  const tagCounts: Record<string, number> = {};
  const xs: number[] = [];
  const ys: number[] = [];
  elements.forEach((el) => {
    const tag = el.tagName.toLowerCase();
    tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
    const t = parseTranslate(el.getAttribute('transform'));
    if (t) { xs.push(t.x); ys.push(t.y); }
    ['x', 'x1', 'x2', 'cx'].forEach((attr) => {
      const n = Number(el.getAttribute(attr));
      if (Number.isFinite(n)) xs.push(n);
    });
    ['y', 'y1', 'y2', 'cy'].forEach((attr) => {
      const n = Number(el.getAttribute(attr));
      if (Number.isFinite(n)) ys.push(n);
    });
  });
  const extent = (vals: number[]) => vals.length ? { min: Math.min(...vals), max: Math.max(...vals) } : null;
  return {
    elementCount: elements.length,
    tagCounts,
    approximateX: extent(xs),
    approximateY: extent(ys),
    hasApproximateGeometry: xs.length > 0 || ys.length > 0
  };
}

function summarizeDataForCohort(cohort: VisualCohort, dataAnnotations: ElementDataAnnotations) {
  const fields = new Set<string>();
  const channels = new Set<string>();
  let annotatedCount = 0;
  const samples: unknown[] = [];
  cohort.elementIds.forEach((id) => {
    const ann = dataAnnotations[id];
    if (!ann) return;
    if (ann.datum != null) {
      annotatedCount += 1;
      if (samples.length < 5) samples.push(sanitizeDataValue(ann.datum));
    }
    ann.dataFields?.forEach((field) => fields.add(field));
    ann.encodingChannels?.forEach((channel) => channels.add(channel));
    if (ann.datum && typeof ann.datum === 'object' && !Array.isArray(ann.datum)) {
      Object.keys(ann.datum as Record<string, unknown>).forEach((field) => fields.add(field));
    }
  });
  return {
    hasPerElementData: annotatedCount > 0,
    annotatedElementCount: annotatedCount,
    fields: Array.from(fields).sort(),
    encodingChannels: Array.from(channels).sort(),
    sampleValues: samples
  };
}

function cohortRepresentativeElementIds(cohort: VisualCohort, max = 8): string[] {
  return cohort.elementIds.slice(0, max);
}


function compactSelectorFromAttribute(name: string, value: string | null | undefined): string | null {
  if (!value) return null;
  return cssAttrSelector(name, value);
}

function compactElementRecordFromSvgElement(el: SVGElement) {
  const dataValueRaw = el.getAttribute('p3-data-value');
  let representedData: unknown = null;
  if (dataValueRaw) {
    try { representedData = JSON.parse(dataValueRaw); } catch { representedData = dataValueRaw; }
  }
  const text = el.tagName.toLowerCase() === 'text' ? (el.textContent || '').trim() : '';
  return {
    element_id: el.getAttribute('p3-element-id') || null,
    source_cohort_id: el.getAttribute('p3-cohort-id') || null,
    source_mark_id: el.getAttribute('p3-mark-id') || null,
    visual_shape: el.getAttribute('p3-shapeDescriptor') || el.tagName.toLowerCase(),
    role_in_visualization: el.getAttribute('p3-role') || null,
    visualization_part: el.getAttribute('p3-viz-part') || null,
    data_semantic_role: el.getAttribute('p3-data-role') || null,
    encoding_channels: (el.getAttribute('p3-data-encoding-channel') || '').split(',').map((v) => v.trim()).filter(Boolean),
    visual_style: {
      fill: el.getAttribute('p3-paint-fill') || el.getAttribute('fill') || null,
      fillOpacity: el.getAttribute('p3-paint-fill-opacity') || el.getAttribute('fill-opacity') || null,
      stroke: el.getAttribute('p3-paint-stroke') || el.getAttribute('stroke') || null,
      strokeOpacity: el.getAttribute('p3-paint-stroke-opacity') || el.getAttribute('stroke-opacity') || null,
      strokeWidth: el.getAttribute('p3-paint-stroke-width') || el.getAttribute('stroke-width') || null,
      opacity: el.getAttribute('p3-paint-opacity') || el.getAttribute('opacity') || null
    },
    represented_value: {
      text: text || null,
      data: representedData,
      title: el.getAttribute('aria-label') || null
    }
  };
}

function buildNativeCompactVem(svg: SVGSVGElement, cohorts: VisualCohort[], labels: CohortLabels, dataAnnotations: ElementDataAnnotations) {
  const viewBox = (svg.getAttribute('viewBox') || '').split(/[ ,]+/).map(Number).filter(Number.isFinite);
  const compactCohorts = cohorts
    .filter((cohort) => cohort.containerOnly !== true && cohort.renderStatus !== 'nonvisible-zero-length' && cohort.renderStatus !== 'nonvisible-layout-residue' && cohort.renderStatus !== 'permanent-invisible-interaction-target' && cohort.renderStatus !== 'permanent-invisible-structural' && (cohort.authorable !== false || cohort.writeCompilerAttributes === true))
    .map((cohort, index) => {
      const elements = renderableElementsForCohort(svg, cohort);
      const records = elements.map(compactElementRecordFromSvgElement);
      const role = cohort.authorable === false ? '' : (labels[cohort.id]?.role || '');
      const vizPart = inferCohortVizPart(cohort);
      const dataRole = inferP3DataRole(cohort, role);
      const targeting = buildCohortTargeting(cohort, role);
      const dataSummary = summarizeDataForCohort(cohort, dataAnnotations);
      return {
        cohort_id: `sv_c${index}`,
        source_cohort_id: cohort.id,
        source_mark_id: null,
        title: cohort.title,
        suggested_role: cohort.suggestedRole,
        role_in_visualization: role || null,
        role_source: role ? 'author' : null,
        visualization_part: vizPart,
        data_semantic_role: dataRole,
        visual_shape: records[0]?.visual_shape || null,
        count: elements.length,
        render_status: cohort.renderStatus || 'visible',
        authorable: cohort.authorable !== false,
        visual_style: {
          fill: records[0]?.visual_style.fill ?? null,
          fillOpacity: records[0]?.visual_style.fillOpacity ?? null,
          stroke: records[0]?.visual_style.stroke ?? null,
          strokeOpacity: records[0]?.visual_style.strokeOpacity ?? null,
          strokeWidth: records[0]?.visual_style.strokeWidth ?? null,
          opacity: records[0]?.visual_style.opacity ?? null
        },
        style_summary: summarizePaintValues(elements),
        geometry_summary: summarizeGeometry(elements),
        text_summary: summarizeTextValues(elements),
        data_summary: {
          has_per_element_data: dataSummary.hasPerElementData,
          annotated_element_count: dataSummary.annotatedElementCount,
          fields: dataSummary.fields,
          encoding_channels: dataSummary.encodingChannels,
          examples: dataSummary.sampleValues
        },
        representatives: records.slice(0, 8).map((record) => ({
          element_id: record.element_id,
          text: record.represented_value.text,
          data: record.represented_value.data,
          visual_shape: record.visual_shape
        })),
        targeting: {
          primary_selector: targeting.primarySelector,
          fallback_selector: targeting.fallbackSelectors?.[0] || null,
          fallback_selectors: targeting.fallbackSelectors || [],
          representative_element_ids: cohortRepresentativeElementIds(cohort),
          packet_available: true,
          packet_types: ['cohort_rows', 'text_index', 'geometry_rows', 'style_rows', 'data_rows']
        }
      };
    });
  const semanticRoles = uniqueSorted(compactCohorts.map((cohort) => cohort.role_in_visualization || ''), 60);
  const visualShapes = uniqueSorted(compactCohorts.map((cohort) => cohort.visual_shape || ''), 60);
  const dataRoles = uniqueSorted(compactCohorts.map((cohort) => cohort.data_semantic_role || ''), 60);
  const warnings: string[] = [];
  if (!compactCohorts.length) warnings.push('No P3-editable renderable cohorts were found.');
  const unlabeled = compactCohorts.filter((cohort) => cohort.authorable && !cohort.role_in_visualization).length;
  if (unlabeled) warnings.push(`${unlabeled} authorable cohort(s) do not yet have a p3-role author label.`);
  const noData = compactCohorts.filter((cohort) => cohort.data_semantic_role === 'data' && !cohort.data_summary.has_per_element_data).length;
  if (noData) warnings.push(`${noData} data cohort(s) do not have per-element p3-data-value annotations.`);

  return {
    schema: 'compact_vem_v0_1',
    source: {
      kind: 'SemanticVega native SSVG',
      app: 'semantic-vega-editor',
      schema_phase: 6
    },
    chart: {
      view_box: viewBox.length === 4 ? viewBox : null
    },
    summary: {
      element_count: compactCohorts.reduce((sum, cohort) => sum + cohort.count, 0),
      cohort_count: compactCohorts.length,
      semantic_roles: semanticRoles,
      visual_shapes: visualShapes,
      data_roles: dataRoles,
      warnings
    },
    cohorts: compactCohorts,
    retrieval_policy: {
      default: 'Use p3-cohort-id primary selectors for cohort-wide edits. Use representative_element_ids for examples and exact fallback targeting.',
      packet_types: ['cohort_rows', 'text_index', 'geometry_rows', 'style_rows', 'data_rows']
    }
  };
}

function validateLeanSsvgReadiness(svg: SVGSVGElement, cohorts: VisualCohort[], labels: CohortLabels) {
  const editable = Array.from(svg.querySelectorAll('[p3-cohort-id]')) as SVGElement[];
  const required = ['p3-element-id', 'p3-cohort-id', 'p3-viz-part', 'p3-data-role', 'p3-mark', 'p3-shapeDescriptor'];
  const missingCounts: Record<string, number> = {};
  editable.forEach((el) => {
    required.forEach((attr) => {
      if (!el.getAttribute(attr)) missingCounts[attr] = (missingCounts[attr] || 0) + 1;
    });
  });
  const roleMissing = editable.filter((el) => !el.getAttribute('p3-role')).length;
  if (roleMissing) missingCounts['p3-role'] = roleMissing;

  const selectorFailures: string[] = [];
  cohorts
    .filter((cohort) => cohort.containerOnly !== true && (cohort.authorable !== false || cohort.writeCompilerAttributes === true))
    .forEach((cohort) => {
      const role = cohort.authorable === false ? '' : (labels[cohort.id]?.role || '');
      const selector = buildCohortTargeting(cohort, role).primarySelector;
      if (!selector) {
        selectorFailures.push(`${cohort.id}: missing primary selector`);
        return;
      }
      try {
        if (!svg.querySelectorAll(selector).length) selectorFailures.push(`${cohort.id}: primary selector matched no elements`);
      } catch {
        selectorFailures.push(`${cohort.id}: primary selector is invalid`);
      }
    });

  const warnings = [
    ...Object.entries(missingCounts).map(([attr, count]) => `${count} editable element(s) missing ${attr}`),
    ...selectorFailures
  ];
  return {
    ready: warnings.length === 0,
    checkedElementCount: editable.length,
    checkedCohortCount: cohorts.filter((cohort) => cohort.containerOnly !== true && (cohort.authorable !== false || cohort.writeCompilerAttributes === true)).length,
    requiredElementAttributes: required.concat('p3-role'),
    missingAttributeCounts: missingCounts,
    selectorFailures,
    warnings
  };
}

function buildCohortTargeting(cohort: VisualCohort, role: string) {
  if (cohort.containerOnly === true || cohort.authorable === false && cohort.writeCompilerAttributes !== true) {
    const primarySelector = cssAttrSelector('p3-container-id', cohort.id);
    const fallbackSelectors = [
      cssAttrSelector('p3-container-kind', cohort.type),
      ...((cohort.childIds || []).slice(0, 8).map((childId) => cssAttrSelector('p3-cohort-id', childId)))
    ];
    return {
      primarySelector,
      fallbackSelectors,
      targetKind: 'container',
      writesRenderableAttributes: false
    };
  }

  const primarySelector = cssAttrSelector('p3-cohort-id', cohort.id);
  const fallbackSelectors = [
    role ? cssAttrSelector('p3-role', role) : '',
    cssAttrSelector('p3-viz-part', inferCohortVizPart(cohort))
  ].filter(Boolean);
  return {
    primarySelector,
    fallbackSelectors,
    targetKind: 'renderable-cohort',
    writesRenderableAttributes: true
  };
}

function buildContainerHierarchy(cohorts: VisualCohort[]) {
  return cohorts
    .filter((cohort) => cohort.containerOnly === true || cohort.authorable === false && cohort.writeCompilerAttributes !== true)
    .map((cohort) => ({
      containerId: cohort.id,
      kind: cohort.type,
      title: cohort.title,
      rootElementIds: cohort.rootIds,
      childCohortIds: cohort.childIds || [],
      parentContainerId: cohort.parentId || null,
      authorable: false,
      writesRenderableAttributes: false,
      targeting: buildCohortTargeting(cohort, '')
    }));
}

function collectRenderableIdsByMarkType(svg: SVGSVGElement): Map<string, string[]> {
  const buckets = new Map<string, string[]>();
  const markGroups = Array.from(svg.querySelectorAll('g.role-mark')) as Element[];
  markGroups.forEach((group) => {
    if (closestRoleBoundary(group.parentElement) === 'axis' || closestRoleBoundary(group.parentElement) === 'legend') return;
    const type = markType(group);
    const ids = getRenderableIds(group);
    if (!ids.length) return;
    buckets.set(type, [...(buckets.get(type) ?? []), ...ids]);
  });
  return buckets;
}

function collectSceneItemsByMarkType(view: unknown): Map<string, unknown[]> {
  const buckets = new Map<string, unknown[]>();
  const v = view as { scenegraph?: () => { root?: unknown } } | null | undefined;
  let root: unknown = null;
  try { root = v?.scenegraph?.()?.root ?? null; } catch { root = null; }
  const visit = (node: unknown, inheritedType: string | null = null) => {
    if (!node || typeof node !== 'object') return;
    const obj = node as Record<string, unknown>;
    const markObj = (obj.mark && typeof obj.mark === 'object') ? obj.mark as Record<string, unknown> : null;
    const localType = String(obj.marktype ?? markObj?.marktype ?? markObj?.type ?? inheritedType ?? '').trim();
    if (obj.datum && localType && localType !== 'group') {
      buckets.set(localType, [...(buckets.get(localType) ?? []), obj]);
    }
    const items = Array.isArray(obj.items) ? obj.items : [];
    items.forEach((child) => visit(child, localType || inheritedType));
  };
  visit(root);
  return buckets;
}

function collectSpecEncodingByMarkType(spec: unknown): Map<string, { channels: Set<string>; fields: Set<string> }> {
  const buckets = new Map<string, { channels: Set<string>; fields: Set<string> }>();
  const add = (type: string, channel: string, field?: string) => {
    if (!type || !channel) return;
    const bucket = buckets.get(type) ?? { channels: new Set<string>(), fields: new Set<string>() };
    bucket.channels.add(channel);
    if (field) bucket.fields.add(field);
    buckets.set(type, bucket);
  };
  const scanEncodeBlock = (type: string, encode: unknown) => {
    if (!encode || typeof encode !== 'object') return;
    const enc = encode as Record<string, unknown>;
    ['enter', 'update', 'hover'].forEach((phase) => {
      const phaseObj = enc[phase];
      if (!phaseObj || typeof phaseObj !== 'object') return;
      Object.entries(phaseObj as Record<string, unknown>).forEach(([channel, definition]) => {
        const defs = Array.isArray(definition) ? definition : [definition];
        defs.forEach((def) => {
          if (!def || typeof def !== 'object') return;
          const d = def as Record<string, unknown>;
          const field = typeof d.field === 'string' ? d.field : undefined;
          if (field) add(type, channel, field);
        });
      });
    });
  };
  const visitMarks = (marks: unknown) => {
    if (!Array.isArray(marks)) return;
    marks.forEach((mark) => {
      if (!mark || typeof mark !== 'object') return;
      const obj = mark as Record<string, unknown>;
      const type = typeof obj.type === 'string' ? obj.type : '';
      scanEncodeBlock(type, obj.encode);
      visitMarks(obj.marks);
    });
  };
  visitMarks((spec as Record<string, unknown> | null | undefined)?.marks);
  return buckets;
}

export function extractElementDataAnnotations(svg: SVGSVGElement, view: unknown, compiledSpec?: unknown): ElementDataAnnotations {
  const annotations: ElementDataAnnotations = {};
  const idsByMarkType = collectRenderableIdsByMarkType(svg);
  const sceneItemsByMarkType = collectSceneItemsByMarkType(view);
  const encodingByMarkType = collectSpecEncodingByMarkType(compiledSpec);

  idsByMarkType.forEach((ids, type) => {
    const items = sceneItemsByMarkType.get(type) ?? [];
    const encoding = encodingByMarkType.get(type);
    ids.forEach((id, index) => {
      const item = items[index] as Record<string, unknown> | undefined;
      const datum = item?.datum;
      const ann: ElementDataAnnotation = {};
      if (datum != null) ann.datum = sanitizeDataValue(datum);
      if (encoding?.channels.size) ann.encodingChannels = Array.from(encoding.channels).sort();
      if (encoding?.fields.size) ann.dataFields = Array.from(encoding.fields).sort();
      if (ann.datum != null || ann.encodingChannels?.length || ann.dataFields?.length) annotations[id] = ann;
    });
  });

  return annotations;
}

export function compileCohortSsvg(sourceSvg: string, cohorts: VisualCohort[], labels: CohortLabels, specKind: string, dataAnnotations: ElementDataAnnotations = {}): string {
  const doc = new DOMParser().parseFromString(sourceSvg, 'image/svg+xml');
  const svg = doc.documentElement as unknown as SVGSVGElement;
  svg.setAttribute('p3-ssvg-version', '0.6-lean-cohort-authored');
  svg.setAttribute('p3-source', 'semantic-vega-editor');
  svg.setAttribute('p3-authoring-mode', 'author-labeled-rendered-cohorts');
  svg.setAttribute('p3-spec-kind', specKind);
  svg.setAttribute('p3-cohort-count', String(cohorts.length));
  const latentNonRendering = readLatentNonRenderingMetadata(svg) as { count?: number } | null;
  if (latentNonRendering?.count != null) svg.setAttribute('p3-latent-nonrendering-count', String(latentNonRendering.count));

  const metadata: any = {
    ssvgVersion: '0.6-lean-cohort-authored',
    source: 'Semantic Vega Editor',
    semanticPolicy: {
      authorAuthority: 'Author labels rendered visual cohorts directly. No spec-side semantic metadata is required in the Vega/Vega-Lite spec.',
      compilerAuthority: 'The compiler derives structural part roles, cohort membership, visual style, and SVG element ids.',
      invariant: 'Semantic intent is authored over rendered visual cohorts; cohort discovery is compiled from SVG, Vega classes, and visual structure.',
      renderedSemanticsPolicy: 'Only visible, perceivable, editable visual elements become normal cohorts. Non-rendering scenegraph residue is excluded from cohorting; interaction-dependent hidden content is retained only as compact latent metadata.'
    },
    specKind,
    p3VemCompatibility: {
      compactVemReady: true,
      compactVemEmbedded: false,
      schemaPhase: 6,
      selectorBasis: 'p3-cohort-id + p3-element-id',
      roleField: 'p3-role',
      vizPartField: 'p3-viz-part',
      dataRoleField: 'p3-data-role',
      dataValueField: 'p3-data-value',
      encodingChannelField: 'p3-data-encoding-channel',
      paintFieldPrefix: 'p3-paint-*',
      containerPolicy: 'container-only hierarchy: non-renderable groups never receive p3-role or p3-viz-part',
      recommendedConsumerAction: 'Generate CompactVEM from the live SSVG DOM after loading. Treat SSVG DOM attributes as the source of semantic truth.'
    },
    latentNonRendering: readLatentNonRenderingMetadata(svg),
    containers: buildContainerHierarchy(cohorts).map((container) => ({
      containerId: container.containerId,
      kind: container.kind,
      title: container.title,
      rootElementIds: container.rootElementIds,
      childCohortIds: container.childCohortIds,
      parentContainerId: container.parentContainerId,
      targeting: container.targeting
    })),
    cohorts: cohorts.map((cohort) => {
      const role = cohort.authorable === false ? '' : (labels[cohort.id]?.role || '');
      const vizPart = inferCohortVizPart(cohort);
      const dataRole = inferP3DataRole(cohort, role);
      return {
        cohortId: cohort.id,
        type: cohort.type,
        title: cohort.title,
        role,
        roleSource: cohort.authorable === false || !role ? null : 'author',
        memberCount: cohort.count,
        authorable: cohort.authorable !== false,
        parentId: cohort.parentId || null,
        childIds: cohort.childIds || [],
        containerOnly: cohort.containerOnly === true,
        writesRenderableAttributes: cohort.authorable !== false || cohort.writeCompilerAttributes === true,
        vizPart,
        dataRole,
        targeting: buildCohortTargeting(cohort, role),
        representativeElementIds: cohortRepresentativeElementIds(cohort),
        renderStatus: cohort.renderStatus || 'visible',
        visibilityMode: cohort.visibilityMode || 'visible-now',
        interactionRole: cohort.interactionRole || null
      };
    })
  };

  const oldMetadata = svg.querySelector('metadata[p3-kind="ssvg-metadata"]');
  oldMetadata?.remove();
  const metadataEl = doc.createElementNS(SVG_NS, 'metadata');
  metadataEl.setAttribute('p3-kind', 'ssvg-metadata');
  metadataEl.setAttribute('type', 'application/json');
  metadataEl.textContent = JSON.stringify(metadata, null, 2);
  svg.insertBefore(metadataEl, svg.firstChild);

  cohorts.forEach((cohort) => {
    // Container cohorts (whole axes/legends/legend entries) are hierarchy metadata only.
    // They never write p3-cohort-* or author labels onto their renderable descendants.
    // Instead, their root <g> nodes receive lightweight p3-container-* attributes.
    if (cohort.authorable === false && cohort.writeCompilerAttributes !== true) {
      cohort.rootIds.forEach((rootId) => {
        const root = svg.querySelector(`[p3-element-id="${CSS.escape(rootId)}"]`) as SVGElement | null;
        if (!root) return;
        root.setAttribute('p3-container-id', cohort.id);
        root.setAttribute('p3-container-kind', cohort.type);
        root.setAttribute('p3-container-authorable', 'false');
        if (cohort.visibilityMode) root.setAttribute('p3-visibility-mode', cohort.visibilityMode);
        if (cohort.interactionRole && cohort.interactionRole !== 'none') root.setAttribute('p3-interaction-role', cohort.interactionRole);
        root.setAttribute('p3-container-only', 'true');
        root.setAttribute('p3-container-child-count', String(cohort.childIds?.length || 0));
        if (cohort.parentId) root.setAttribute('p3-parent-container-id', cohort.parentId);
        if (cohort.childIds?.length) root.setAttribute('p3-child-cohort-ids', cohort.childIds.join(' '));
        // Deliberately remove any visual-semantic attributes from container nodes.
        // These groups are navigational hierarchy only; renderable descendants carry p3-role/p3-viz-part.
        ['p3-role', 'p3-viz-part', 'p3-data-role', 'p3-mark', 'p3-shapeDescriptor', 'p3-cohort-id'].forEach((attr) => root.removeAttribute(attr));
      });
      return;
    }
    const role = cohort.authorable === false ? '' : labels[cohort.id]?.role?.trim();
    cohort.elementIds.forEach((id) => {
      const el = svg.querySelector(`[p3-element-id="${CSS.escape(id)}"]`) as SVGElement | null;
      if (!el) return;
      el.setAttribute('p3-cohort-id', cohort.id);
      if (cohort.renderStatus) el.setAttribute('p3-render-status', cohort.renderStatus);
      if (cohort.visibilityMode) el.setAttribute('p3-visibility-mode', cohort.visibilityMode);
      if (cohort.interactionRole && cohort.interactionRole !== 'none') el.setAttribute('p3-interaction-role', cohort.interactionRole);
      if (cohort.writeCompilerAttributes === true) el.setAttribute('p3-authoring-status', cohort.visibilityMode?.includes('invisible') ? 'auto-non-authorable-invisible' : 'non-authorable-structural-residue');
      if (role) el.setAttribute('p3-role', role);
      const vizPart = inferCohortVizPart(cohort);
      el.setAttribute('p3-viz-part', vizPart);
      const p3Mark = inferP3Mark(el, cohort);
      el.setAttribute('p3-mark', p3Mark);
      el.setAttribute('p3-shapeDescriptor', inferP3ShapeDescriptor(el, cohort, p3Mark));
      el.setAttribute('p3-data-role', inferP3DataRole(cohort, role || ''));
      const dataAnnotation = dataAnnotations[id];
      if (dataAnnotation?.datum != null) {
        const json = tryJsonAttribute(dataAnnotation.datum);
        if (json) el.setAttribute('p3-data-value', json);
      }
      if (dataAnnotation?.encodingChannels?.length) {
        el.setAttribute('p3-data-encoding-channel', dataAnnotation.encodingChannels.join(','));
      }
      if (!el.getAttribute('p3-render-status')) el.setAttribute('p3-render-status', cohort.renderStatus || 'visible');
      const paintAttrMap: Record<string, string> = {
        fill: 'p3-paint-fill',
        stroke: 'p3-paint-stroke',
        opacity: 'p3-paint-opacity',
        'fill-opacity': 'p3-paint-fill-opacity',
        'stroke-opacity': 'p3-paint-stroke-opacity',
        'stroke-width': 'p3-paint-stroke-width'
      };
      Object.entries(paintAttrMap).forEach(([attr, p3Attr]) => {
        const value = el.getAttribute(attr);
        if (value && !el.getAttribute(p3Attr)) el.setAttribute(p3Attr, value);
      });
    });
  });

  metadata.ssvgReadiness = validateLeanSsvgReadiness(svg, cohorts, labels);
  metadataEl.textContent = JSON.stringify(metadata, null, 2);

  return new XMLSerializer().serializeToString(svg);
}
