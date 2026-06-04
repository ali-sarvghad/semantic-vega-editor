import type { EditorLog } from './editorModel';
import { lineFromJsonError } from './sourceLocations';

export type SpecKind = 'vega' | 'vega-lite' | 'unknown';

export interface SpecDiagnostics {
  ok: boolean;
  parsed: unknown | null;
  kind: SpecKind;
  error?: string;
  errorLine?: number;
  warnings: string[];
  logs: EditorLog[];
}

function nowLabel() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function detectSpecKind(parsed: any): SpecKind {
  const schema = String(parsed?.$schema ?? '').toLowerCase();
  if (schema.includes('vega-lite')) return 'vega-lite';
  if (schema.includes('/vega/')) return 'vega';
  if (parsed?.mark || parsed?.encoding || parsed?.layer || parsed?.facet || parsed?.hconcat || parsed?.vconcat) return 'vega-lite';
  if (parsed?.marks || parsed?.signals || parsed?.scales || parsed?.axes) return 'vega';
  return 'unknown';
}

export function analyzeSpec(specText: string): SpecDiagnostics {
  const ts = nowLabel();
  const warnings: string[] = [];

  if (!specText.trim()) {
    return {
      ok: false,
      parsed: null,
      kind: 'unknown',
      error: 'Editor is empty. Paste a Vega or Vega-Lite JSON specification.',
      warnings,
      logs: [{ level: 'error', message: 'Spec parser: editor is empty', timestamp: ts }]
    };
  }

  try {
    const parsed = JSON.parse(specText);
    const kind = detectSpecKind(parsed);
    if (kind === 'unknown') warnings.push('Could not confidently identify this as Vega or Vega-Lite. Rendering will still be attempted.');

    const logs: EditorLog[] = [
      { level: 'success', message: `JSON parser: valid ${kind === 'unknown' ? 'specification' : kind + ' specification'}`, timestamp: ts },
      { level: 'info', message: 'Semantic authoring: cohort labels are authored after SVG rendering; no spec-side semantic metadata is required.', timestamp: ts }
    ];

    warnings.forEach((warning) => logs.push({ level: 'warning', message: warning, timestamp: ts }));

    return { ok: true, parsed, kind, warnings, logs };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const errorLine = lineFromJsonError(specText, message);
    return {
      ok: false,
      parsed: null,
      kind: 'unknown',
      error: message,
      errorLine,
      warnings,
      logs: [{ level: 'error', message: `JSON parser: ${message}`, timestamp: ts, lineNumber: errorLine }]
    };
  }
}

export function buildProblemRows(diagnostics: SpecDiagnostics, renderError?: string | null): EditorLog[] {
  const rows: EditorLog[] = [];
  const ts = nowLabel();
  if (diagnostics.error) rows.push({ level: 'error', message: diagnostics.error, timestamp: ts, lineNumber: diagnostics.errorLine });
  diagnostics.warnings.forEach((warning) => rows.push({ level: 'warning', message: warning, timestamp: ts }));
  if (renderError) rows.push({ level: 'error', message: renderError, timestamp: ts });
  return rows;
}
