import { useEffect, useMemo, useRef, useState } from 'react';
import embed, { type Result } from 'vega-embed';
import { Check, Clipboard, RotateCcw, SlidersHorizontal, ZoomIn, ZoomOut } from 'lucide-react';
import type { SpecDiagnostics } from '../lib/specAnalysis';
import { extractDeclaredWidgets, type DeclaredWidget } from '../lib/specWidgets';
import { normalizeSpecDataUrls } from '../lib/specDataUrls';
import { compileCohortSsvg, discoverVisualCohorts, extractElementDataAnnotations, renderCohortFocusSvg, type CohortLabels, type VisualCohort, type ElementDataAnnotations } from '../lib/cohorting';
import type { SemanticVegaProvenanceInput } from '../lib/provenance';

interface RenderPanelProps {
  activeTool: 'render' | 'cohort-labels' | 'ssvg-preview';
  spec: string;
  diagnostics: SpecDiagnostics;
  renderRequest: number;
  sourceSvg: string;
  cohorts: VisualCohort[];
  selectedCohortId: string | null;
  labels: CohortLabels;
  ssvgPreview: string;
  labelingMode: boolean;
  onRenderStatus: (status: { ok: boolean; message: string; renderedAt: string | null }) => void;
  onCohortsGenerated: (payload: { sourceSvg: string; cohorts: VisualCohort[] }) => void;
  onSsvgGenerated: (source: string) => void;
  onLabelChange: (cohortId: string, role: string, position?: { x: number; y: number }) => void;
}


export function RenderPanel({ activeTool, spec, diagnostics, renderRequest, sourceSvg, cohorts, selectedCohortId, labels, ssvgPreview, labelingMode, onRenderStatus, onCohortsGenerated, onSsvgGenerated, onLabelChange }: RenderPanelProps) {
  if (activeTool === 'ssvg-preview') {
    return <SsvgPreview ssvgPreview={ssvgPreview} />;
  }
  if (activeTool === 'cohort-labels') {
    return <CohortSummary cohorts={cohorts} labels={labels} />;
  }

  return (
    <LiveRenderPanel
      diagnostics={diagnostics}
      renderRequest={renderRequest}
      sourceSvg={sourceSvg}
      cohorts={cohorts}
      selectedCohortId={selectedCohortId}
      labels={labels}
      labelingMode={labelingMode}
      onRenderStatus={onRenderStatus}
      onCohortsGenerated={onCohortsGenerated}
      onSsvgGenerated={onSsvgGenerated}
      onLabelChange={onLabelChange}
      spec={spec}
    />
  );
}

function safeParseSpecText(specText: string): unknown | undefined {
  try { return JSON.parse(specText); } catch { return undefined; }
}

function LiveRenderPanel({ spec, diagnostics, renderRequest, sourceSvg, cohorts, selectedCohortId, labels, labelingMode, onRenderStatus, onCohortsGenerated, onSsvgGenerated, onLabelChange }: Omit<RenderPanelProps, 'activeTool' | 'ssvgPreview'>) {
  const hiddenRenderRef = useRef<HTMLDivElement | null>(null);
  const focusHostRef = useRef<HTMLDivElement | null>(null);
  const panViewportRef = useRef<HTMLDivElement | null>(null);
  const widgetHostRef = useRef<HTMLDivElement | null>(null);
  const resultRef = useRef<Result | null>(null);
  const [viewTransform, setViewTransform] = useState({ scale: 1, x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null);
  const [renderMessage, setRenderMessage] = useState('Ready. Press Play to render and compute cohorts.');
  const [renderError, setRenderError] = useState<string | null>(null);
  const [dataUrlRewrites, setDataUrlRewrites] = useState<string[]>([]);
  const [labelEditor, setLabelEditor] = useState<{ x: number; y: number; svgX: number; svgY: number; value: string } | null>(null);
  const [dataAnnotations, setDataAnnotations] = useState<ElementDataAnnotations>({});
  const [compiledVegaSpec, setCompiledVegaSpec] = useState<unknown | null>(null);
  const [dataUrlRewriteSnapshot, setDataUrlRewriteSnapshot] = useState<string[]>([]);

  const renderableSpec = useMemo(() => diagnostics.parsed ?? null, [diagnostics.parsed]);
  const selectedCohort = cohorts.find((cohort) => cohort.id === selectedCohortId) ?? null;

  const declaredWidgets = useMemo<DeclaredWidget[]>(() => {
    if (!renderableSpec) return [];
    return extractDeclaredWidgets(renderableSpec as any);
  }, [renderableSpec]);

  const focusSvg = useMemo(() => {
    if (!sourceSvg) return '';
    return renderCohortFocusSvg(sourceSvg, labelingMode ? selectedCohort : null, labels);
  }, [sourceSvg, selectedCohort, labels, labelingMode]);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      if (!hiddenRenderRef.current) return;

      if (renderRequest === 0) {
        hiddenRenderRef.current.innerHTML = '';
        if (widgetHostRef.current) widgetHostRef.current.innerHTML = '';
        return;
      }

      if (!diagnostics.ok || !renderableSpec) {
        hiddenRenderRef.current.innerHTML = '';
        const message = diagnostics.error ?? 'Spec is not valid JSON.';
        setRenderError(message);
        setRenderMessage('Render blocked by specification error.');
        onRenderStatus({ ok: false, message, renderedAt: null });
        return;
      }

      try {
        setRenderError(null);
        setRenderMessage('Rendering internally and discovering visual cohorts...');
        resultRef.current?.finalize();
        hiddenRenderRef.current.innerHTML = '';
        if (widgetHostRef.current) widgetHostRef.current.innerHTML = '';

        const normalized = normalizeSpecDataUrls(renderableSpec);
        setDataUrlRewrites(normalized.rewrites);
        setDataUrlRewriteSnapshot(normalized.rewrites);

        const result = await embed(hiddenRenderRef.current, normalized.spec as any, {
          renderer: 'svg',
          actions: false,
          hover: true,
          defaultStyle: false,
          bind: widgetHostRef.current ?? undefined,
          config: {
            background: 'white',
            view: { stroke: 'transparent' },
            axis: {
              labelColor: '#1f2937',
              titleColor: '#111827',
              gridColor: 'rgba(31,41,55,0.16)',
              domainColor: 'rgba(31,41,55,0.5)',
              tickColor: 'rgba(31,41,55,0.5)'
            },
            legend: { labelColor: '#1f2937', titleColor: '#111827' },
            title: { color: '#111827' }
          }
        } as any);

        if (cancelled) {
          result.finalize();
          return;
        }

        resultRef.current = result;
        const svg = hiddenRenderRef.current.querySelector('svg') as SVGSVGElement | null;
        const renderedAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        if (!svg) {
          const message = 'Renderer completed, but no SVG node was found.';
          setRenderMessage(message);
          onRenderStatus({ ok: false, message, renderedAt });
          return;
        }

        const runtimeSpec = (result as any).spec ?? normalized.spec;
        setCompiledVegaSpec(runtimeSpec);
        const discovered = discoverVisualCohorts(svg, runtimeSpec);
        const annotations = extractElementDataAnnotations(svg, result.view, runtimeSpec);
        setDataAnnotations(annotations);
        onCohortsGenerated(discovered);
        const provenance: SemanticVegaProvenanceInput = {
          sourceSpecType: diagnostics.kind,
          sourceSpec: renderableSpec,
          normalizedSpec: normalized.spec,
          compiledVegaSpec: runtimeSpec,
          dataUrlRewrites: normalized.rewrites,
          editorVersion: '1.40'
        };
        const compiled = compileCohortSsvg(discovered.sourceSvg, discovered.cohorts, {}, diagnostics.kind, annotations, provenance);
        onSsvgGenerated(compiled);
        const authorableCount = discovered.cohorts.filter((cohort) => cohort.authorable !== false).length;
        const message = `Rendered successfully. Computed ${authorableCount} authorable cohort(s) behind the scenes (${discovered.cohorts.length} structural cohort(s) total). Inspect the visualization, then press Label.`;
        setRenderMessage(message);
        onRenderStatus({ ok: true, message, renderedAt });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setRenderError(message);
        setRenderMessage('Vega renderer failed. See Problems panel.');
        onRenderStatus({ ok: false, message, renderedAt: null });
      }
    }

    render();
    return () => { cancelled = true; };
  }, [renderRequest, diagnostics, renderableSpec, onRenderStatus, onCohortsGenerated, onSsvgGenerated]);

  useEffect(() => {
    if (!sourceSvg) return;
    const provenance: SemanticVegaProvenanceInput = {
      sourceSpecType: diagnostics.kind,
      sourceSpec: diagnostics.parsed ?? safeParseSpecText(spec),
      normalizedSpec: diagnostics.parsed ? normalizeSpecDataUrls(diagnostics.parsed).spec : undefined,
      compiledVegaSpec,
      dataUrlRewrites: dataUrlRewriteSnapshot,
      editorVersion: '1.40'
    };
    const compiled = compileCohortSsvg(sourceSvg, cohorts, labels, diagnostics.kind, dataAnnotations, provenance);
    onSsvgGenerated(compiled);
  }, [sourceSvg, cohorts, labels, diagnostics.kind, diagnostics.parsed, spec, dataAnnotations, compiledVegaSpec, dataUrlRewriteSnapshot, onSsvgGenerated]);

  function openLabelEditorFromClick(event: React.MouseEvent<HTMLDivElement>) {
    if (!selectedCohort) return;
    const target = event.target as Element;
    const clickedMember = target.closest('[data-cohort-member="true"]');
    const clickedLabel = target.closest('[data-cohort-label="true"]');
    if (!clickedMember && !clickedLabel) return;
    const hostRect = panViewportRef.current?.getBoundingClientRect() ?? focusHostRef.current?.getBoundingClientRect();
    if (!hostRect) return;
    const svgEl = focusHostRef.current?.querySelector('svg') as SVGSVGElement | null;
    const point = svgEl?.createSVGPoint();
    let svgX = 20;
    let svgY = 30;
    if (point && svgEl) {
      point.x = event.clientX;
      point.y = event.clientY;
      const transformed = point.matrixTransform(svgEl.getScreenCTM()?.inverse());
      svgX = Math.round(transformed.x + 8);
      svgY = Math.round(transformed.y - 8);
    }
    setLabelEditor({
      x: event.clientX - hostRect.left,
      y: event.clientY - hostRect.top,
      svgX,
      svgY,
      value: labels[selectedCohort.id]?.role || selectedCohort.suggestedRole
    });
  }

  function commitLabel() {
    if (!selectedCohort || !labelEditor) return;
    onLabelChange(selectedCohort.id, labelEditor.value.trim(), { x: labelEditor.svgX, y: labelEditor.svgY });
    setLabelEditor(null);
  }


  function updateScale(nextScale: number) {
    setViewTransform((current) => ({ ...current, scale: Math.max(0.25, Math.min(5, nextScale)) }));
  }

  function resetViewTransform() {
    setViewTransform({ scale: 1, x: 0, y: 0 });
  }

  function handlePanZoomWheel(event: React.WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    const viewport = event.currentTarget;
    const rect = viewport.getBoundingClientRect();
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;
    setViewTransform((current) => {
      const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
      const nextScale = Math.max(0.25, Math.min(5, current.scale * factor));
      const scaleRatio = nextScale / current.scale;
      return {
        scale: nextScale,
        x: pointerX - (pointerX - current.x) * scaleRatio,
        y: pointerY - (pointerY - current.y) * scaleRatio
      };
    });
  }

  function handlePanPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    const target = event.target as Element;
    if (labelingMode && (target.closest('[data-cohort-member="true"]') || target.closest('[data-cohort-label="true"]') || target.closest('.floating-label-editor'))) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: viewTransform.x,
      originY: viewTransform.y
    };
    setIsPanning(true);
  }

  function handlePanPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setViewTransform((current) => ({
      ...current,
      x: drag.originX + event.clientX - drag.startX,
      y: drag.originY + event.clientY - drag.startY
    }));
  }

  function handlePanPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (drag?.pointerId === event.pointerId) {
      dragRef.current = null;
      setIsPanning(false);
    }
  }

  const panZoomHandlers = {
    onWheel: handlePanZoomWheel,
    onPointerDown: handlePanPointerDown,
    onPointerMove: handlePanPointerMove,
    onPointerUp: handlePanPointerUp,
    onPointerCancel: handlePanPointerUp
  };

  return (
    <div className="render-panel">
      <div className="render-toolbar">
        <span className={`render-status ${renderError ? 'error' : 'ok'}`}>{labelingMode && selectedCohort ? `Selected: ${selectedCohort.title} · blue target, red context · click blue to label` : renderMessage}</span>
        <span className="pan-zoom-hint">Wheel zoom · drag pan · {Math.round(viewTransform.scale * 100)}%</span>
        <button onClick={() => updateScale(viewTransform.scale * 1.15)}><ZoomIn size={16} /> Zoom</button>
        <button onClick={() => updateScale(viewTransform.scale / 1.15)}><ZoomOut size={16} /> Out</button>
        <button onClick={resetViewTransform}><RotateCcw size={16} /> Reset view</button>
      </div>

      <div className={`visualization-stage ${declaredWidgets.length === 0 ? 'no-widgets' : ''}`}>
        <div className="chart-card live-chart-card cohort-focus-card">
          {renderError && <div className="render-error"><strong>Render problem</strong><span>{renderError}</span></div>}
          {!labelingMode && dataUrlRewrites.length > 0 && (
            <div className="render-note">
              Rewrote {dataUrlRewrites.length} relative Vega dataset URL{dataUrlRewrites.length === 1 ? '' : 's'} for browser loading.
            </div>
          )}
          {labelingMode ? (
            <div
              ref={panViewportRef}
              className={`vega-host-frame cohort-focus-frame pan-zoom-viewport ${isPanning ? 'is-panning' : ''}`}
              {...panZoomHandlers}
            >
              <div
                className="pan-zoom-content cohort-pan-content"
                style={{ transform: `translate(${viewTransform.x}px, ${viewTransform.y}px) scale(${viewTransform.scale})` }}
              >
                <div
                  ref={focusHostRef}
                  className="cohort-focus-host"
                  onClick={openLabelEditorFromClick}
                  dangerouslySetInnerHTML={{ __html: focusSvg }}
                />
              </div>
              {labelEditor && (
                <div className="floating-label-editor" style={{ left: labelEditor.x, top: labelEditor.y }}>
                  <input value={labelEditor.value} autoFocus onChange={(event) => setLabelEditor({ ...labelEditor, value: event.target.value })} onKeyDown={(event) => { if (event.key === 'Enter') commitLabel(); if (event.key === 'Escape') setLabelEditor(null); }} />
                  <button onClick={commitLabel}>Save</button>
                </div>
              )}
            </div>
          ) : (
            <div
              ref={panViewportRef}
              className={`vega-live-inspection-frame pan-zoom-viewport ${isPanning ? 'is-panning' : ''}`}
              {...panZoomHandlers}
            >
              <div
                className="pan-zoom-content chart-pan-content"
                style={{ transform: `translate(${viewTransform.x}px, ${viewTransform.y}px) scale(${viewTransform.scale})` }}
              >
                <div ref={hiddenRenderRef} className="visible-render-host" />
              </div>
            </div>
          )}
          {labelingMode && <div ref={hiddenRenderRef} className="hidden-render-host" />}
        </div>

        {!labelingMode && declaredWidgets.length > 0 && (
          <aside className="widget-dock real-widget-dock">
            <div className="widget-dock-title"><SlidersHorizontal size={15} /> Spec-declared widgets</div>
            <div ref={widgetHostRef} className="vega-bindings-host" />
            <div className="declared-widget-list">
              {declaredWidgets.map((widget) => (
                <div key={widget.id} className="declared-widget-row">
                  <strong>{widget.name}</strong>
                  <span>{widget.kind}</span>
                  <small>{widget.source} · {widget.path}</small>
                </div>
              ))}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

function CohortSummary({ cohorts, labels }: { cohorts: VisualCohort[]; labels: CohortLabels }) {
  const authorable = cohorts.filter((cohort) => cohort.authorable !== false);
  const labeled = authorable.filter((cohort) => labels[cohort.id]?.role).length;
  return (
    <div className="artifact-preview">
      <h2>Cohort Labels</h2>
      <pre>{JSON.stringify({
        purpose: 'Author labels rendered visual cohorts directly; no spec-side semantic metadata is required.',
        labeledAuthorableCohorts: labeled,
        authorableCohorts: authorable.length,
        totalStructuralCohorts: cohorts.length,
        cohorts: cohorts.map((cohort) => ({
          id: cohort.id,
          type: cohort.type,
          title: cohort.title,
          suggestedRole: cohort.suggestedRole,
          role: cohort.authorable === false ? '' : (labels[cohort.id]?.role || ''),
          roleSource: cohort.authorable === false || !labels[cohort.id]?.role ? null : 'author',
          memberCount: cohort.count,
          evidence: cohort.evidence,
          authorable: cohort.authorable !== false,
          parentId: cohort.parentId || null,
          childIds: cohort.childIds || []
        }))
      }, null, 2)}</pre>
    </div>
  );
}

function SsvgPreview({ ssvgPreview }: { ssvgPreview: string }) {
  const [copied, setCopied] = useState(false);

  async function copySsvg() {
    if (!ssvgPreview) return;
    try {
      await navigator.clipboard.writeText(ssvgPreview);
    } catch {
      const helper = document.createElement('textarea');
      helper.value = ssvgPreview;
      helper.setAttribute('readonly', 'true');
      helper.style.position = 'fixed';
      helper.style.left = '-9999px';
      document.body.appendChild(helper);
      helper.select();
      document.execCommand('copy');
      helper.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div className="artifact-preview full-ssvg-preview">
      <div className="artifact-preview-header">
        <h2>Full SSVG</h2>
        <button className="copy-ssvg-button" onClick={copySsvg} disabled={!ssvgPreview}>
          {copied ? <Check size={15} /> : <Clipboard size={15} />}
          {copied ? 'Copied' : 'Copy SSVG'}
        </button>
      </div>
      {ssvgPreview ? (
        <>
          <div className="ssvg-source-meta">Full generated cohort-authored SSVG source · {ssvgPreview.length.toLocaleString()} characters</div>
          <pre>{ssvgPreview}</pre>
        </>
      ) : (
        <div className="empty-state">No SSVG yet. Press Play to render and compute cohorts, then Label to review them.</div>
      )}
    </div>
  );
}
