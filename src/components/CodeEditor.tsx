import { useCallback, useEffect, useRef } from 'react';
import Editor, { type Monaco, type OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  focusLine?: number | null;
  onFocusConsumed?: () => void;
}

type EditorSpecKind = 'vega' | 'vega-lite' | 'unknown';

const VEGA_LITE_SCHEMA_URI = 'https://vega.github.io/schema/vega-lite/v5.json';
const VEGA_SCHEMA_URI = 'https://vega.github.io/schema/vega/v5.json';

function detectSpecKindFromText(text: string): EditorSpecKind {
  if (!text.trim()) return 'unknown';
  try {
    const parsed = JSON.parse(text);
    const schema = String(parsed?.$schema ?? '').toLowerCase();
    if (schema.includes('vega-lite')) return 'vega-lite';
    if (schema.includes('/vega/')) return 'vega';
    if (parsed?.mark || parsed?.encoding || parsed?.layer || parsed?.facet || parsed?.hconcat || parsed?.vconcat) return 'vega-lite';
    if (parsed?.marks || parsed?.signals || parsed?.scales || parsed?.axes) return 'vega';
  } catch {
    const lower = text.toLowerCase();
    if (lower.includes('vega-lite') || /"(mark|encoding)"\s*:/.test(lower)) return 'vega-lite';
    if (lower.includes('/vega/') || /"(marks|signals|scales|axes)"\s*:/.test(lower)) return 'vega';
  }
  return 'unknown';
}

function configureJsonDiagnostics(monaco: Monaco, value: string) {
  const kind = detectSpecKindFromText(value);
  const schemas = kind === 'vega-lite'
    ? [{ uri: VEGA_LITE_SCHEMA_URI, fileMatch: ['*'] }]
    : kind === 'vega'
      ? [{ uri: VEGA_SCHEMA_URI, fileMatch: ['*'] }]
      : [
          { uri: VEGA_LITE_SCHEMA_URI, fileMatch: ['*'] },
          { uri: VEGA_SCHEMA_URI, fileMatch: ['*'] }
        ];

  monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
    validate: true,
    allowComments: false,
    trailingCommas: 'error',
    enableSchemaRequest: true,
    schemaRequest: 'warning',
    schemaValidation: 'warning',
    comments: 'error',
    schemas
  });
}

function configureJsonFormatting(monaco: Monaco) {
  monaco.languages.json.jsonDefaults.setModeConfiguration({
    documentFormattingEdits: true,
    documentRangeFormattingEdits: true,
    completionItems: true,
    hovers: true,
    documentSymbols: true,
    tokens: true,
    colors: true,
    foldingRanges: true,
    diagnostics: true,
    selectionRanges: true
  });
}

export function CodeEditor({ value, onChange, focusLine, onFocusConsumed }: CodeEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const lastSchemaKindRef = useRef<EditorSpecKind>('unknown');

  const beforeMount = useCallback((monaco: Monaco) => {
    configureJsonFormatting(monaco);
    configureJsonDiagnostics(monaco, value);
    lastSchemaKindRef.current = detectSpecKindFromText(value);
  }, [value]);

  const handleMount: OnMount = useCallback((mountedEditor, monaco) => {
    editorRef.current = mountedEditor;
    monacoRef.current = monaco;

    mountedEditor.addAction({
      id: 'semantic-vega-format-document',
      label: 'Format Vega/Vega-Lite JSON',
      keybindings: [monaco.KeyMod.Alt | monaco.KeyMod.Shift | monaco.KeyCode.KeyF],
      run: async (targetEditor) => {
        await targetEditor.getAction('editor.action.formatDocument')?.run();
      }
    });
  }, []);

  useEffect(() => {
    const monaco = monacoRef.current;
    if (!monaco) return;
    const nextKind = detectSpecKindFromText(value);
    if (nextKind === lastSchemaKindRef.current) return;
    configureJsonDiagnostics(monaco, value);
    lastSchemaKindRef.current = nextKind;
  }, [value]);

  useEffect(() => {
    if (!focusLine || !editorRef.current) return;
    const targetEditor = editorRef.current;
    targetEditor.revealLineInCenter(focusLine);
    targetEditor.setPosition({ lineNumber: focusLine, column: 1 });
    targetEditor.focus();
    const decorationIds = targetEditor.createDecorationsCollection([
      {
        range: {
          startLineNumber: focusLine,
          startColumn: 1,
          endLineNumber: focusLine,
          endColumn: 1
        },
        options: {
          isWholeLine: true,
          className: 'monaco-active-target-line'
        }
      }
    ]);
    window.setTimeout(() => decorationIds.clear(), 1800);
    onFocusConsumed?.();
  }, [focusLine, onFocusConsumed]);

  return (
    <div className="code-editor-shell monaco-editor-shell">
      <Editor
        height="100%"
        language="json"
        path="semantic-vega-spec.json"
        theme="semantic-vega-dark"
        value={value}
        beforeMount={(monaco) => {
          monaco.editor.defineTheme('semantic-vega-dark', {
            base: 'vs-dark',
            inherit: true,
            rules: [
              { token: 'string.key.json', foreground: '7dd3fc' },
              { token: 'string.value.json', foreground: 'a7f3d0' },
              { token: 'number.json', foreground: 'fca5a5' },
              { token: 'keyword.json', foreground: 'c4b5fd' }
            ],
            colors: {
              'editor.background': '#111318',
              'editor.foreground': '#e7eefb',
              'editorLineNumber.foreground': '#707889',
              'editorLineNumber.activeForeground': '#d6dbe6',
              'editorCursor.foreground': '#7dd3fc',
              'editor.selectionBackground': '#7dd3fc45',
              'editor.lineHighlightBackground': '#7dd3fc0f',
              'editorGutter.background': '#101218',
              'editorError.foreground': '#fb7185',
              'editorWarning.foreground': '#fbbf24'
            }
          });
          beforeMount(monaco);
        }}
        onMount={handleMount}
        onChange={(nextValue) => onChange(nextValue ?? '')}
        options={{
          automaticLayout: true,
          bracketPairColorization: { enabled: true },
          cursorBlinking: 'smooth',
          detectIndentation: true,
          fixedOverflowWidgets: true,
          folding: true,
          foldingStrategy: 'auto',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          fontSize: 14,
          formatOnPaste: true,
          formatOnType: true,
          glyphMargin: true,
          guides: { bracketPairs: true, indentation: true },
          insertSpaces: true,
          lineDecorationsWidth: 12,
          lineHeight: 22,
          lineNumbers: 'on',
          minimap: { enabled: true, renderCharacters: false, scale: 1, showSlider: 'mouseover' },
          overviewRulerBorder: false,
          padding: { top: 12, bottom: 12 },
          quickSuggestions: { other: true, comments: false, strings: true },
          renderValidationDecorations: 'on',
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          tabCompletion: 'on',
          tabSize: 2,
          wordWrap: 'on',
          wrappingIndent: 'indent'
        }}
      />
    </div>
  );
}
