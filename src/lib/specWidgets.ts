export type DeclaredWidgetKind = 'range' | 'checkbox' | 'select' | 'radio' | 'input' | 'unknown';

export interface DeclaredWidget {
  id: string;
  name: string;
  kind: DeclaredWidgetKind;
  source: 'vega-signal' | 'vega-lite-param';
  path: string;
}

function widgetKind(bind: any): DeclaredWidgetKind {
  if (!bind) return 'unknown';
  if (typeof bind === 'string') return bind as DeclaredWidgetKind;
  const input = String(bind.input ?? bind.type ?? '').toLowerCase();
  if (input === 'range') return 'range';
  if (input === 'checkbox') return 'checkbox';
  if (input === 'select') return 'select';
  if (input === 'radio') return 'radio';
  if (input === 'text' || input === 'number' || input === 'search') return 'input';
  return 'unknown';
}

export function extractDeclaredWidgets(spec: any): DeclaredWidget[] {
  const widgets: DeclaredWidget[] = [];

  if (Array.isArray(spec?.signals)) {
    spec.signals.forEach((signal: any, index: number) => {
      if (signal?.bind) {
        widgets.push({
          id: `signal-${signal.name ?? index}`,
          name: String(signal.name ?? `signal ${index + 1}`),
          kind: widgetKind(signal.bind),
          source: 'vega-signal',
          path: `signals[${index}].bind`
        });
      }
    });
  }

  if (Array.isArray(spec?.params)) {
    spec.params.forEach((param: any, index: number) => {
      if (param?.bind) {
        widgets.push({
          id: `param-${param.name ?? index}`,
          name: String(param.name ?? `param ${index + 1}`),
          kind: widgetKind(param.bind),
          source: 'vega-lite-param',
          path: `params[${index}].bind`
        });
      }
    });
  }

  return widgets;
}
