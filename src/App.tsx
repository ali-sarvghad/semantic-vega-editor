import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import {
  Bot,
  ChevronDown,
  Download,
  Tag,
  FilePlus2,
  FolderOpen,
  PanelBottom,
  Play,
  Save,
  Wand2,
  X,
  Zap
} from 'lucide-react';
import { sampleSpec } from './state/sampleSpec';
import semanticVegaLogoUrl from './assets/semantic-vega-logo.png';
import type { CohortLabels, VisualCohort } from './lib/cohorting';
import type { EditorLog, PanelId } from './lib/editorModel';
import { analyzeSpec, buildProblemRows } from './lib/specAnalysis';
import { CodeEditor } from './components/CodeEditor';
import { RenderPanel } from './components/RenderPanel';
import { BottomPanel } from './components/BottomPanel';
import { buildStandaloneSvaHtml, createSemanticVegaArtifact, downloadSvaByKind, semanticVegaArtifactFilename, type SvaDownloadKind } from './lib/sva';
import { fetchOpenAiModels, labelCohortWithOpenAi, type OpenAiModelInfo } from './lib/openAiLabeling';

function nowLabel() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

type BottomTabId = 'cohorts' | 'debug' | 'logs' | 'problems';
type RenderStatus = { ok: boolean; message: string; renderedAt: string | null };

interface EditorTab {
  id: string;
  title: string;
  spec: string;
  activeBottomTab: BottomTabId;
  showBottom: boolean;
  activeTool: PanelId;
  renderRequest: number;
  renderStatus: RenderStatus;
  ssvgPreview: string;
  focusLine: number | null;
  sourceSvg: string;
  cohorts: VisualCohort[];
  selectedCohortId: string | null;
  labels: CohortLabels;
  labelingMode: boolean;
  svaJson: string;
  svaFilename: string;
  svaCreatedAt: string | null;
}

const initialRenderStatus: RenderStatus = {
  ok: true,
  message: 'Renderer has not run yet. Paste or edit a spec, then press Run to discover visual cohorts.',
  renderedAt: null
};

const AI_SETTINGS_STORAGE_KEY = 'semantic-vega-editor.openai-settings.v1';
const DEFAULT_AI_MODEL = 'gpt-4.1-mini';

interface SavedAiSettings {
  apiKey?: string;
  model?: string;
}

function SemanticVegaLogo() {
  return (
    <img
      className="semantic-vega-logo"
      src={semanticVegaLogoUrl}
      alt="Semantic Vega logo"
      aria-label="Semantic Vega logo"
    />
  );
}


function createEditorTab(id: string, title: string, spec: string): EditorTab {
  return {
    id,
    title,
    spec,
    activeBottomTab: 'cohorts',
    showBottom: true,
    activeTool: 'render',
    renderRequest: 0,
    renderStatus: initialRenderStatus,
    ssvgPreview: '',
    focusLine: null,
    sourceSvg: '',
    cohorts: [],
    selectedCohortId: null,
    labels: {},
    labelingMode: false,
    svaJson: '',
    svaFilename: '',
    svaCreatedAt: null
  };
}

export function App() {
  const [tabs, setTabs] = useState<EditorTab[]>(() => [createEditorTab('tab-1', 'semantic-vega-spec.json', sampleSpec)]);
  const [activeTabId, setActiveTabId] = useState('tab-1');
  const [codeCollapsed, setCodeCollapsed] = useState(false);
  const [previewCollapsed, setPreviewCollapsed] = useState(true);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(190);
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [draftTabTitle, setDraftTabTitle] = useState('');
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);
  const [downloadKind, setDownloadKind] = useState<SvaDownloadKind>('html');
  const [labelMenuOpen, setLabelMenuOpen] = useState(false);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiApiKey, setAiApiKey] = useState('');
  const [aiModel, setAiModel] = useState(DEFAULT_AI_MODEL);
  const [aiModels, setAiModels] = useState<OpenAiModelInfo[]>([]);
  const [aiSaveSettings, setAiSaveSettings] = useState(false);
  const [aiStatus, setAiStatus] = useState('Enter an OpenAI API key, load models, then start AI labeling.');
  const [aiLoadingModels, setAiLoadingModels] = useState(false);
  const [aiLabeling, setAiLabeling] = useState(false);
  const [aiProgress, setAiProgress] = useState({ done: 0, total: 0 });
  const aiAbortRef = useRef<AbortController | null>(null);
  const openFileInputRef = useRef<HTMLInputElement | null>(null);
  const cancelRenameRef = useRef(false);

  function readSavedAiSettings(): SavedAiSettings {
    try {
      return JSON.parse(localStorage.getItem(AI_SETTINGS_STORAGE_KEY) || '{}') as SavedAiSettings;
    } catch {
      return {};
    }
  }

  useEffect(() => {
    const saved = readSavedAiSettings();
    if (saved.apiKey) {
      setAiApiKey(saved.apiKey);
      setAiSaveSettings(true);
    }
    if (saved.model) setAiModel(saved.model);
  }, []);

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];
  const spec = activeTab.spec;
  const diagnostics = useMemo(() => analyzeSpec(spec), [spec]);

  const updateActiveTab = useCallback((patch: Partial<EditorTab> | ((tab: EditorTab) => Partial<EditorTab>)) => {
    setTabs((currentTabs) => currentTabs.map((tab) => {
      if (tab.id !== activeTabId) return tab;
      const nextPatch = typeof patch === 'function' ? patch(tab) : patch;
      return { ...tab, ...nextPatch };
    }));
  }, [activeTabId]);

  const setSpec = useCallback((value: string) => updateActiveTab({ spec: value }), [updateActiveTab]);
  const setActiveBottomTab = useCallback((value: BottomTabId) => updateActiveTab({ activeBottomTab: value }), [updateActiveTab]);
  const setShowBottom = useCallback((value: boolean) => updateActiveTab({ showBottom: value }), [updateActiveTab]);
  const setActiveTool = useCallback((value: PanelId) => updateActiveTab({ activeTool: value }), [updateActiveTab]);
  const setRenderRequest = useCallback((updater: number | ((value: number) => number)) => {
    updateActiveTab((tab) => ({ renderRequest: typeof updater === 'function' ? updater(tab.renderRequest) : updater }));
  }, [updateActiveTab]);
  const setRenderStatus = useCallback((value: RenderStatus) => updateActiveTab({ renderStatus: value }), [updateActiveTab]);
  const setSsvgPreview = useCallback((value: string) => updateActiveTab({ ssvgPreview: value }), [updateActiveTab]);
  const setFocusLine = useCallback((value: number | null) => updateActiveTab({ focusLine: value }), [updateActiveTab]);

  const startRenamingTab = useCallback((tab: EditorTab) => {
    setActiveTabId(tab.id);
    setRenamingTabId(tab.id);
    setDraftTabTitle(tab.title);
  }, []);

  const commitTabRename = useCallback((tabId: string) => {
    if (cancelRenameRef.current) {
      cancelRenameRef.current = false;
      setRenamingTabId(null);
      setDraftTabTitle('');
      return;
    }
    const cleanTitle = draftTabTitle.trim();
    if (cleanTitle) {
      setTabs((currentTabs) => currentTabs.map((tab) => (
        tab.id === tabId ? { ...tab, title: cleanTitle } : tab
      )));
    }
    setRenamingTabId(null);
    setDraftTabTitle('');
  }, [draftTabTitle]);

  const cancelTabRename = useCallback(() => {
    cancelRenameRef.current = true;
    setRenamingTabId(null);
    setDraftTabTitle('');
  }, []);

  const closeTab = useCallback((tabId: string) => {
    setTabs((currentTabs) => {
      if (currentTabs.length === 1) return currentTabs;
      const tabIndex = currentTabs.findIndex((tab) => tab.id === tabId);
      const nextTabs = currentTabs.filter((tab) => tab.id !== tabId);
      if (tabId === activeTabId) {
        const fallbackTab = nextTabs[Math.max(0, tabIndex - 1)] ?? nextTabs[0];
        setActiveTabId(fallbackTab.id);
      }
      if (renamingTabId === tabId) {
        setRenamingTabId(null);
        setDraftTabTitle('');
      }
      return nextTabs;
    });
  }, [activeTabId, renamingTabId]);

  const onTabRenameKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>, tabId: string) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commitTabRename(tabId);
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelTabRename();
    }
  }, [commitTabRename, cancelTabRename]);

  const onRenderStatus = useCallback((status: RenderStatus) => {
    updateActiveTab({
      renderStatus: status,
      showBottom: status.ok ? activeTab.showBottom : true,
      activeBottomTab: status.ok ? activeTab.activeBottomTab : 'problems'
    });
  }, [updateActiveTab, activeTab.showBottom, activeTab.activeBottomTab]);
  const onSsvgGenerated = useCallback((source: string) => setSsvgPreview(source), [setSsvgPreview]);
  const onCohortsGenerated = useCallback((payload: { sourceSvg: string; cohorts: VisualCohort[] }) => {
    updateActiveTab((tab) => {
      const preservedLabels: CohortLabels = {};
      payload.cohorts.forEach((cohort) => {
        if (tab.labels[cohort.id]) preservedLabels[cohort.id] = tab.labels[cohort.id];
      });
      return {
        sourceSvg: payload.sourceSvg,
        cohorts: payload.cohorts,
        labels: preservedLabels,
        selectedCohortId: tab.labelingMode ? (payload.cohorts.find((cohort) => cohort.authorable !== false)?.id ?? null) : null,
        activeBottomTab: tab.labelingMode ? 'cohorts' : 'debug',
        showBottom: true
      };
    });
  }, [updateActiveTab]);

  const onLabelChange = useCallback((cohortId: string, role: string, position?: { x: number; y: number }) => {
    updateActiveTab((tab) => ({
      labels: {
        ...tab.labels,
        [cohortId]: { role, ...(position ?? {}) }
      }
    }));
  }, [updateActiveTab]);

  const consoleLogs = useMemo<EditorLog[]>(() => {
    const authorable = activeTab.cohorts.filter((cohort) => cohort.authorable !== false);
    const labeled = authorable.filter((cohort) => activeTab.labels[cohort.id]?.role).length;
    return [
      ...diagnostics.logs,
      {
        level: activeTab.renderStatus.ok ? 'success' : 'error',
        message: activeTab.renderStatus.message,
        timestamp: activeTab.renderStatus.renderedAt ?? nowLabel()
      },
      {
        level: 'info',
        message: `Cohort labeling mode: ${labeled}/${authorable.length} authorable cohort(s) labeled (${activeTab.cohorts.length} structural cohort(s) total).`,
        timestamp: nowLabel()
      },
      {
        level: 'info',
        message: 'Current invariant: authors label rendered visual cohorts; compiler derives structure, cohort membership, style, and SSVG attributes.',
        timestamp: nowLabel()
      }
    ];
  }, [diagnostics.logs, activeTab.renderStatus, activeTab.cohorts, activeTab.labels]);

  const problems = useMemo(() => buildProblemRows(diagnostics, activeTab.renderStatus.ok ? null : activeTab.renderStatus.message), [diagnostics, activeTab.renderStatus]);

  const authorableCohorts = activeTab.cohorts.filter((cohort) => cohort.authorable !== false);
  const labeledCohortCount = authorableCohorts.filter((cohort) => activeTab.labels[cohort.id]?.role?.trim()).length;
  const unlabeledCohortCount = Math.max(0, authorableCohorts.length - labeledCohortCount);
  const allAuthorableCohortsLabeled = authorableCohorts.length > 0 && unlabeledCohortCount === 0;
  const canCreateSva = Boolean(activeTab.sourceSvg && activeTab.ssvgPreview && allAuthorableCohortsLabeled);
  const cohortStatusLabel = activeTab.cohorts.length > 0
    ? `${labeledCohortCount}/${authorableCohorts.length} authorable cohorts labeled`
    : 'cohorts not discovered';

  function showIncompleteLabelingMessage(count = unlabeledCohortCount) {
    window.alert(
      `There ${count === 1 ? 'is' : 'are'} ${count} cohort${count === 1 ? '' : 's'} that require labeling before Semantic Vega Artifact (SVA) can be generated.`
    );
  }
  const layoutClass = codeCollapsed ? 'code-collapsed' : previewCollapsed ? 'preview-collapsed' : 'split';

  function openBothPanels() {
    setCodeCollapsed(false);
    setPreviewCollapsed(false);
  }

  function collapseCodePanel() {
    setCodeCollapsed(true);
    setPreviewCollapsed(false);
  }

  function collapsePreviewPanel() {
    setPreviewCollapsed(true);
    setCodeCollapsed(false);
  }

  function resetDerivedState(message?: string) {
    updateActiveTab({
      ssvgPreview: '',
      renderRequest: 0,
      sourceSvg: '',
      cohorts: [],
      selectedCohortId: null,
      labels: {},
      labelingMode: false,
      svaJson: '',
      svaFilename: '',
      svaCreatedAt: null,
      renderStatus: {
        ok: true,
        message: message ?? 'Spec changed. Press Run to discover visual cohorts.',
        renderedAt: null
      }
    });
  }

  function createNewSpec() {
    const nextNumber = tabs.length + 1;
    const id = `tab-${Date.now()}`;
    const newTab = createEditorTab(id, `untitled-${nextNumber}.json`, '');
    setPreviewCollapsed(true);
    newTab.renderStatus = {
      ok: true,
      message: 'New empty specification tab created. Paste or write a Vega/Vega-Lite spec, then press Run.',
      renderedAt: null
    };
    setTabs((currentTabs) => [...currentTabs, newTab]);
    setActiveTabId(id);
  }

  function openSpecFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      updateActiveTab({ title: file.name, spec: text });
      resetDerivedState(`Opened ${file.name}. Press Run to discover visual cohorts.`);
      setPreviewCollapsed(true);
      setActiveBottomTab('cohorts');
    };
    reader.onerror = () => {
      setRenderStatus({ ok: false, message: `Could not open ${file.name}.`, renderedAt: null });
      setShowBottom(true);
      setActiveBottomTab('problems');
    };
    reader.readAsText(file);
  }

  function saveSpecFile() {
    const blob = new Blob([spec], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = activeTab.title || 'semantic-vega-spec.json';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function runCohortDiscovery() {
    setPreviewCollapsed(false);
    setCodeCollapsed(false);
    setActiveTool('render');
    setShowBottom(true);
    setActiveBottomTab('debug');
    setSsvgPreview('');

    if (!diagnostics.ok || !diagnostics.parsed) {
      updateActiveTab({
        sourceSvg: '',
        cohorts: [],
        selectedCohortId: null,
        labels: {},
        labelingMode: false,
        ssvgPreview: '',
        svaJson: '',
        svaFilename: '',
        svaCreatedAt: null,
        showBottom: true,
        activeBottomTab: 'problems',
        renderStatus: { ok: false, message: diagnostics.error ?? 'Spec is not valid JSON.', renderedAt: null }
      });
      return;
    }

    updateActiveTab({
      sourceSvg: '',
      cohorts: [],
      selectedCohortId: null,
      labels: {},
      labelingMode: false,
      ssvgPreview: '',
      svaJson: '',
      svaFilename: '',
      svaCreatedAt: null,
      activeBottomTab: 'debug',
      showBottom: true,
      renderStatus: { ok: true, message: 'Rendering for inspection and computing cohorts behind the scenes...', renderedAt: null }
    });
    setRenderRequest((value) => value + 1);
  }

  function showChartView() {
    updateActiveTab({
      labelingMode: false,
      activeTool: 'render',
      activeBottomTab: 'debug',
      showBottom: true
    });
    setPreviewCollapsed(false);
  }

  function startLabeling() {
    const firstAuthorable = activeTab.cohorts.find((cohort) => cohort.authorable !== false)?.id ?? null;
    if (!firstAuthorable) {
      setShowBottom(true);
      setActiveBottomTab('debug');
      setRenderStatus({ ok: false, message: 'No authorable cohorts are available yet. Press Play on a valid spec first.', renderedAt: null });
      return;
    }
    setPreviewCollapsed(false);
    updateActiveTab({
      labelingMode: true,
      selectedCohortId: activeTab.selectedCohortId ?? firstAuthorable,
      activeTool: 'render',
      activeBottomTab: 'cohorts',
      showBottom: true
    });
  }

  function exportSsvg() {
    if (!activeTab.ssvgPreview) {
      setShowBottom(true);
      setActiveBottomTab('problems');
      setRenderStatus({ ok: false, message: 'No SSVG is available yet. Press Play to render and compute cohorts, then Label to review them.', renderedAt: null });
      return;
    }
    const blob = new Blob([activeTab.ssvgPreview], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'semantic-vega-cohort-authored.ssvg.svg';
    anchor.click();
    URL.revokeObjectURL(url);
  }


  function createSva() {
    if (!diagnostics.ok || !diagnostics.parsed) {
      setShowBottom(true);
      setActiveBottomTab('problems');
      setRenderStatus({ ok: false, message: diagnostics.error ?? 'Spec is not valid JSON. Fix the specification before creating an SVA.', renderedAt: null });
      return;
    }
    if (!activeTab.sourceSvg || !activeTab.ssvgPreview || activeTab.cohorts.length === 0) {
      setShowBottom(true);
      setActiveBottomTab('problems');
      setRenderStatus({ ok: false, message: 'No rendered SSVG is available yet. Press Play to render and compute cohorts before creating an SVA.', renderedAt: null });
      return;
    }
    if (!allAuthorableCohortsLabeled) {
      showIncompleteLabelingMessage(unlabeledCohortCount);
      return;
    }

    try {
      const sva = createSemanticVegaArtifact({
        title: activeTab.title,
        specText: activeTab.spec,
        kind: diagnostics.kind,
        sourceSvg: activeTab.sourceSvg,
        ssvg: activeTab.ssvgPreview,
        cohorts: activeTab.cohorts,
        labels: activeTab.labels
      });
      const svaJson = JSON.stringify(sva, null, 2);
      const filename = semanticVegaArtifactFilename(activeTab.title);
      const previewHtml = buildStandaloneSvaHtml(svaJson, filename);
      updateActiveTab({
        svaJson,
        svaFilename: filename,
        svaCreatedAt: nowLabel(),
        renderStatus: {
          ok: true,
          message: `Semantic Vega Artifact created: ${filename}. The preview opened the same embeddable HTML page that Download SVA → Embeddable HTML page will export.`,
          renderedAt: nowLabel()
        }
      });

      const blob = new Blob([previewHtml], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const preview = window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 30000);
      if (!preview) {
        setShowBottom(true);
        setActiveBottomTab('debug');
        setRenderStatus({
          ok: true,
          message: `SVA created as ${filename}, but the browser blocked the preview tab. Use Download SVA → Embeddable HTML page in the editor toolbar.`,
          renderedAt: nowLabel()
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setShowBottom(true);
      setActiveBottomTab('problems');
      setRenderStatus({ ok: false, message: `Could not create SVA: ${message}`, renderedAt: null });
    }
  }

  function openDownloadDialog() {
    if (!allAuthorableCohortsLabeled) {
      showIncompleteLabelingMessage(unlabeledCohortCount);
      return;
    }
    if (!activeTab.svaJson) {
      setShowBottom(true);
      setActiveBottomTab('problems');
      setRenderStatus({ ok: false, message: 'No SVA has been created yet. Press Create SVA first.', renderedAt: null });
      return;
    }
    setDownloadDialogOpen(true);
  }

  function confirmDownloadChoice() {
    if (!activeTab.svaJson) return;
    const filename = activeTab.svaFilename || semanticVegaArtifactFilename(activeTab.title);
    downloadSvaByKind(downloadKind, activeTab.svaJson, filename);
    setDownloadDialogOpen(false);
  }

  function prepareAiLabelingView(firstAuthorable: string) {
    setPreviewCollapsed(false);
    updateActiveTab({
      labelingMode: true,
      selectedCohortId: activeTab.selectedCohortId ?? firstAuthorable,
      activeTool: 'render',
      activeBottomTab: 'cohorts',
      showBottom: true
    });
  }

  function openAiLabelDialog() {
    const firstAuthorable = activeTab.cohorts.find((cohort) => cohort.authorable !== false)?.id ?? null;
    if (!firstAuthorable) {
      setShowBottom(true);
      setActiveBottomTab('debug');
      setRenderStatus({ ok: false, message: 'No authorable cohorts are available yet. Press Play on a valid spec first.', renderedAt: null });
      return;
    }
    setLabelMenuOpen(false);
    prepareAiLabelingView(firstAuthorable);
    setAiProgress({ done: labeledCohortCount, total: authorableCohorts.length });

    const saved = readSavedAiSettings();
    const savedApiKey = saved.apiKey?.trim();
    const savedModel = saved.model?.trim();
    if (savedApiKey && savedModel) {
      setAiApiKey(savedApiKey);
      setAiModel(savedModel);
      setAiSaveSettings(true);
      void startAiLabeling({ apiKeyOverride: savedApiKey, modelOverride: savedModel, shouldPersist: true });
      return;
    }

    setAiDialogOpen(true);
    setAiStatus('Enter an OpenAI API key, load models, then start AI labeling.');
  }

  async function loadAiModels() {
    if (!aiApiKey.trim()) {
      setAiStatus('Enter an OpenAI API key before loading models.');
      return;
    }
    const controller = new AbortController();
    aiAbortRef.current = controller;
    setAiLoadingModels(true);
    setAiStatus('Loading available OpenAI models...');
    try {
      const models = await fetchOpenAiModels(aiApiKey.trim(), controller.signal);
      setAiModels(models);
      const currentExists = models.some((model) => model.id === aiModel);
      const preferred = models.find((model) => model.id === DEFAULT_AI_MODEL) ?? models.find((model) => /gpt-4\.1-mini|gpt-4o-mini|gpt-4\.1|gpt-4o/i.test(model.id));
      if (!currentExists && preferred) setAiModel(preferred.id);
      setAiStatus(`Loaded ${models.length} model${models.length === 1 ? '' : 's'}. Select a vision-capable model, then start AI labeling.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setAiStatus(message);
    } finally {
      setAiLoadingModels(false);
      aiAbortRef.current = null;
    }
  }

  function closeAiDialog() {
    if (aiLabeling) return;
    setAiDialogOpen(false);
  }

  function cancelAiLabeling() {
    aiAbortRef.current?.abort();
    setAiStatus('AI labeling cancelled. Existing generated labels were kept.');
    setAiLabeling(false);
  }

  async function startAiLabeling(options?: { apiKeyOverride?: string; modelOverride?: string; shouldPersist?: boolean }) {
    const apiKey = (options?.apiKeyOverride ?? aiApiKey).trim();
    const model = (options?.modelOverride ?? aiModel).trim();
    const shouldPersist = options?.shouldPersist ?? aiSaveSettings;
    if (!apiKey) {
      setAiStatus('Enter an OpenAI API key before starting AI labeling.');
      setAiDialogOpen(true);
      return;
    }
    if (!model) {
      setAiStatus('Select or enter a model before starting AI labeling.');
      setAiDialogOpen(true);
      return;
    }
    if (shouldPersist) {
      localStorage.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify({ apiKey, model }));
    } else {
      localStorage.removeItem(AI_SETTINGS_STORAGE_KEY);
    }
    setAiDialogOpen(false);

    const cohortsToLabel = activeTab.cohorts.filter((cohort) => cohort.authorable !== false);
    if (cohortsToLabel.length === 0) {
      setAiStatus('No authorable cohorts are available for AI labeling.');
      return;
    }

    const controller = new AbortController();
    aiAbortRef.current = controller;
    setAiLabeling(true);
    setAiProgress({ done: 0, total: cohortsToLabel.length });
    setPreviewCollapsed(false);
    updateActiveTab({ labelingMode: true, activeTool: 'render', activeBottomTab: 'cohorts', showBottom: true });

    try {
      let completed = 0;
      for (const cohort of cohortsToLabel) {
        if (controller.signal.aborted) break;
        const progressMessage = `AI labeling ${completed + 1}/${cohortsToLabel.length}: ${cohort.title}`;
        setAiStatus(progressMessage);
        updateActiveTab({
          selectedCohortId: cohort.id,
          activeTool: 'render',
          activeBottomTab: 'cohorts',
          showBottom: true,
          renderStatus: { ok: true, message: progressMessage, renderedAt: nowLabel() }
        });
        const label = await labelCohortWithOpenAi({
          apiKey,
          model,
          sourceSvg: activeTab.sourceSvg,
          cohort,
          labels: activeTab.labels,
          chartKind: diagnostics.kind,
          specText: activeTab.spec,
          signal: controller.signal
        });
        completed += 1;
        setAiProgress({ done: completed, total: cohortsToLabel.length });
        setTabs((currentTabs) => currentTabs.map((tab) => {
          if (tab.id !== activeTabId) return tab;
          return {
            ...tab,
            labels: {
              ...tab.labels,
              [cohort.id]: { ...(tab.labels[cohort.id] ?? {}), role: label }
            },
            selectedCohortId: cohort.id,
            labelingMode: true,
            activeTool: 'render',
            activeBottomTab: 'cohorts',
            showBottom: true,
            svaJson: '',
            svaFilename: '',
            svaCreatedAt: null
          };
        }));
      }
      if (!controller.signal.aborted) {
        const completeMessage = 'AI labeling complete. Review and edit the labels as needed, then press Create SVA.';
        setAiStatus(completeMessage);
        updateActiveTab({ renderStatus: { ok: true, message: completeMessage, renderedAt: nowLabel() }, activeBottomTab: 'cohorts', showBottom: true });
      }
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') {
        setAiStatus('AI labeling cancelled. Existing generated labels were kept.');
      } else {
        const message = error instanceof Error ? error.message : String(error);
        setAiStatus(message);
      }
    } finally {
      setAiLabeling(false);
      aiAbortRef.current = null;
    }
  }

  return (
    <main className="app-shell">
      <section className={`workspace-window ${activeTab.showBottom ? 'has-bottom' : 'no-bottom'}`} style={{ ['--bottom-panel-height' as any]: `${bottomPanelHeight}px` }}>
        <div className="toolbar toolbar-with-brand">
          <div className="toolbar-brand" aria-label="Semantic Vega">
            <SemanticVegaLogo />
            <div className="toolbar-brand-text">
              <strong>Semantic Vega Editor</strong>
              <span>Cohort labeler for semantic SVG authoring</span>
            </div>
          </div>

          <div className="toolbar-group toolbar-actions">
            <button className="tool-button" onClick={createNewSpec}><FilePlus2 size={17} /> New</button>
            <button className="tool-button" onClick={() => openFileInputRef.current?.click()}><FolderOpen size={17} /> Open</button>
            <input ref={openFileInputRef} type="file" accept=".json,.vg,.vl,.txt,application/json" className="hidden-file-input" onChange={openSpecFile} />
            <button className="tool-button" onClick={saveSpecFile}><Save size={17} /> Save</button>
            <span className="divider" />
            <button className="icon-button primary" title="Play/render and compute cohorts" onClick={runCohortDiscovery}><Play size={18} /></button>
            <div className="label-dropdown" onMouseLeave={() => setLabelMenuOpen(false)}>
              <button
                className="tool-button label-button label-dropdown-trigger"
                title="Choose manual or AI-assisted cohort labeling"
                onClick={() => setLabelMenuOpen((open) => !open)}
                disabled={activeTab.cohorts.filter((cohort) => cohort.authorable !== false).length === 0}
                aria-haspopup="menu"
                aria-expanded={labelMenuOpen}
              >
                <Tag size={17} /> Label <ChevronDown size={15} />
              </button>
              {labelMenuOpen && (
                <div className="label-dropdown-menu" role="menu">
                  <button role="menuitem" onClick={() => { setLabelMenuOpen(false); startLabeling(); }}><Tag size={15} /> Manual Label</button>
                  <button role="menuitem" onClick={openAiLabelDialog}><Bot size={15} /> Label with AI</button>
                </div>
              )}
            </div>
            <button className={`tool-button sva-button ${canCreateSva ? '' : 'is-disabled'}`} title={canCreateSva ? 'Create a Semantic Vega Artifact and open the embeddable preview' : `${unlabeledCohortCount} cohort${unlabeledCohortCount === 1 ? '' : 's'} require labeling before SVA generation`} onClick={createSva} aria-disabled={!canCreateSva}><Wand2 size={17} /> Create SVA</button>
            <button className={`tool-button ${activeTab.svaJson && allAuthorableCohortsLabeled ? '' : 'is-disabled'}`} title={activeTab.svaCreatedAt && allAuthorableCohortsLabeled ? `Choose how to download/export the SVA created ${activeTab.svaCreatedAt}` : `${unlabeledCohortCount} cohort${unlabeledCohortCount === 1 ? '' : 's'} require labeling before SVA download`} onClick={openDownloadDialog} aria-disabled={!(activeTab.svaJson && allAuthorableCohortsLabeled)}><Download size={17} /> Download SVA</button>
          </div>
        </div>

        {downloadDialogOpen && (
          <div className="sva-download-overlay" role="presentation" onMouseDown={() => setDownloadDialogOpen(false)}>
            <section className="sva-download-dialog" role="dialog" aria-modal="true" aria-labelledby="sva-download-title" onMouseDown={(event) => event.stopPropagation()}>
              <div className="sva-download-dialog-header">
                <div>
                  <h2 id="sva-download-title">Download Semantic Vega Artifact</h2>
                  <p>Choose the format that best matches how the visualization will be reused.</p>
                </div>
                <button type="button" className="sva-dialog-close" aria-label="Close download dialog" onClick={() => setDownloadDialogOpen(false)}><X size={18} /></button>
              </div>

              <div className="sva-download-options">
                <label className={`sva-download-option ${downloadKind === 'sva' ? 'selected' : ''}`}>
                  <input type="radio" name="sva-download-kind" checked={downloadKind === 'sva'} onChange={() => setDownloadKind('sva')} />
                  <span className="sva-download-option-text"><strong>SVA JSON</strong><small>For tools, archives, and systems that already know how to load Semantic Vega Artifacts.</small></span>
                  <span className="info-dot" tabIndex={0}>i<span className="info-tooltip">Downloads only the .sva.json artifact. Use this when another system or webpage already includes the Semantic Vega runtime. Plain vegaEmbed alone will not preserve semantic labels.</span></span>
                </label>

                <label className={`sva-download-option ${downloadKind === 'html' ? 'selected' : ''}`}>
                  <input type="radio" name="sva-download-kind" checked={downloadKind === 'html'} onChange={() => setDownloadKind('html')} />
                  <span className="sva-download-option-text"><strong>Embeddable HTML page</strong><small>A single ready-to-open page with the SVA embedded inside it.</small></span>
                  <span className="info-dot" tabIndex={0}>i<span className="info-tooltip">Downloads one HTML file that contains the SVA and automatically renders it as an interactive semantic visualization. This is the easiest option when the author wants a page that works without managing separate files.</span></span>
                </label>

                <label className={`sva-download-option ${downloadKind === 'package' ? 'selected' : ''}`}>
                  <input type="radio" name="sva-download-kind" checked={downloadKind === 'package'} onChange={() => setDownloadKind('package')} />
                  <span className="sva-download-option-text"><strong>Web embed package</strong><small>A zip folder with an HTML page, SVA file, runtime file, and README.</small></span>
                  <span className="info-dot" tabIndex={0}>i<span className="info-tooltip">Downloads a zip package for uploading to a website. Keep the files together in the same folder and open index.html. The included runtime handles rendering and semantic rehydration.</span></span>
                </label>
              </div>

              <div className="sva-download-actions">
                <button type="button" className="tool-button" onClick={() => setDownloadDialogOpen(false)}>Cancel</button>
                <button type="button" className="tool-button primary-download" onClick={confirmDownloadChoice}><Download size={17} /> Download</button>
              </div>
            </section>
          </div>
        )}

        {aiDialogOpen && (
          <div className="sva-download-overlay" role="presentation" onMouseDown={closeAiDialog}>
            <section className="sva-download-dialog ai-label-dialog" role="dialog" aria-modal="true" aria-labelledby="ai-label-title" onMouseDown={(event) => event.stopPropagation()}>
              <div className="sva-download-dialog-header">
                <div>
                  <h2 id="ai-label-title">Label Cohorts with AI</h2>
                  <p>Send each highlighted cohort thumbnail to an OpenAI vision-capable model and generate editable Semantic Vega labels.</p>
                </div>
                <button type="button" className="sva-dialog-close" aria-label="Close AI labeling dialog" onClick={closeAiDialog} disabled={aiLabeling}><X size={18} /></button>
              </div>

              <div className="ai-label-form">
                <label>
                  <span>OpenAI API key</span>
                  <input type="password" value={aiApiKey} placeholder="sk-..." onChange={(event) => setAiApiKey(event.target.value)} disabled={aiLabeling || aiLoadingModels} />
                </label>

                <div className="ai-model-row">
                  <label>
                    <span>Model</span>
                    <select value={aiModel} onChange={(event) => setAiModel(event.target.value)} disabled={aiLabeling}>
                      {!aiModels.some((model) => model.id === aiModel) && <option value={aiModel}>{aiModel}</option>}
                      {aiModels.map((model) => <option key={model.id} value={model.id}>{model.id}</option>)}
                    </select>
                  </label>
                  <button type="button" className="tool-button" onClick={loadAiModels} disabled={aiLoadingModels || aiLabeling}>{aiLoadingModels ? 'Loading…' : 'Load models'}</button>
                </div>

                <label className="ai-save-row">
                  <input type="checkbox" checked={aiSaveSettings} onChange={(event) => setAiSaveSettings(event.target.checked)} disabled={aiLabeling} />
                  <span>Save key and selected model locally in this browser</span>
                </label>

                <div className="ai-progress-block">
                  <div className="ai-progress-header"><strong>Progress</strong><span>{aiProgress.done}/{aiProgress.total || authorableCohorts.length} cohorts</span></div>
                  <div className="ai-progress-track"><div className="ai-progress-fill" style={{ width: `${Math.round((aiProgress.done / Math.max(1, aiProgress.total || authorableCohorts.length)) * 100)}%` }} /></div>
                  <p>{aiStatus}</p>
                </div>
              </div>

              <div className="sva-download-actions">
                {aiLabeling ? <button type="button" className="tool-button" onClick={cancelAiLabeling}>Cancel labeling</button> : <button type="button" className="tool-button" onClick={closeAiDialog}>Close</button>}
                <button type="button" className="tool-button primary-download" onClick={() => startAiLabeling()} disabled={aiLabeling || !aiApiKey.trim()}><Bot size={17} /> Start AI labeling</button>
              </div>
            </section>
          </div>
        )}

        <div className={`editor-grid no-inspector layout-${layoutClass}`}>
          {codeCollapsed ? (
            <button className="collapsed-panel-rail left" onClick={openBothPanels}>Open Code</button>
          ) : (
            <section className="editor-column">
              <div className="tab-strip">
                {tabs.map((tab) => (
                  <div key={tab.id} className={`tab ${tab.id === activeTabId ? 'active' : ''}`} onClick={() => setActiveTabId(tab.id)}>
                    <span className="file-dot json" />
                    {renamingTabId === tab.id ? (
                      <input
                        className="tab-title-input"
                        value={draftTabTitle}
                        autoFocus
                        aria-label="Rename tab"
                        onChange={(event) => setDraftTabTitle(event.target.value)}
                        onBlur={() => commitTabRename(tab.id)}
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => onTabRenameKeyDown(event, tab.id)}
                      />
                    ) : (
                      <span className="tab-title" title="Double-click to rename" onDoubleClick={(event) => { event.stopPropagation(); startRenamingTab(tab); }}>
                        {tab.title}
                      </span>
                    )}
                    <button
                      type="button"
                      className="tab-x"
                      title={`Close ${tab.title}`}
                      aria-label={`Close ${tab.title}`}
                      onClick={(event) => { event.stopPropagation(); closeTab(tab.id); }}
                      disabled={tabs.length === 1}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                <button className="tab-action" title="Collapse code panel" onClick={collapseCodePanel}>Collapse Code</button>
              </div>
              <CodeEditor value={spec} focusLine={activeTab.focusLine} onFocusConsumed={() => setFocusLine(null)} onChange={(value) => { setSpec(value); resetDerivedState(); setPreviewCollapsed(true); }} />
            </section>
          )}

          {previewCollapsed ? (
            <button className="collapsed-panel-rail right" onClick={openBothPanels}>Open SVG View</button>
          ) : (
            <section className="preview-column">
              <div className="tab-strip preview-tabs">
                <button
                  className={`tab ${activeTab.activeTool === 'render' && !activeTab.labelingMode ? 'active' : ''}`}
                  onClick={showChartView}
                  disabled={!activeTab.sourceSvg}
                  title={activeTab.sourceSvg ? 'Return to the full chart inspection view' : 'Press Play before opening chart view'}
                >
                  Chart View
                </button>
                <button
                  className={`tab ${activeTab.activeTool === 'render' && activeTab.labelingMode ? 'active' : ''}`}
                  onClick={startLabeling}
                  disabled={activeTab.cohorts.filter((cohort) => cohort.authorable !== false).length === 0}
                  title="Return to cohort labeling view"
                >
                  Cohort Labeling
                </button>
                {(['cohort-labels', 'ssvg-preview'] as const).map((tool) => (
                  <button key={tool} className={`tab ${activeTab.activeTool === tool ? 'active' : ''}`} onClick={() => setActiveTool(tool)}>
                    {tool === 'cohort-labels' ? 'Cohort Labels' : 'Full SSVG'}
                  </button>
                ))}
                <button className="tab-action" title="Collapse SVG view panel" onClick={collapsePreviewPanel}>Collapse SVG</button>
              </div>
              <RenderPanel
                activeTool={activeTab.activeTool}
                spec={spec}
                diagnostics={diagnostics}
                renderRequest={activeTab.renderRequest}
                sourceSvg={activeTab.sourceSvg}
                cohorts={activeTab.cohorts}
                selectedCohortId={activeTab.selectedCohortId}
                labels={activeTab.labels}
                ssvgPreview={activeTab.ssvgPreview}
                labelingMode={activeTab.labelingMode}
                onRenderStatus={onRenderStatus}
                onCohortsGenerated={onCohortsGenerated}
                onSsvgGenerated={onSsvgGenerated}
                onLabelChange={onLabelChange}
              />
            </section>
          )}
        </div>

        {activeTab.showBottom && (
          <BottomPanel
            cohorts={activeTab.cohorts}
            selectedCohortId={activeTab.selectedCohortId}
            labels={activeTab.labels}
            problems={problems}
            logs={consoleLogs}
            labelingMode={activeTab.labelingMode}
            renderStatus={activeTab.renderStatus}
            bottomPanelHeight={bottomPanelHeight}
            onBottomPanelHeightChange={setBottomPanelHeight}
            onSelectCohort={(id) => { updateActiveTab({ selectedCohortId: id, activeTool: 'render' }); }}
            onFocusLine={(line) => setFocusLine(line)}
            onClose={() => setShowBottom(false)}
          />
        )}

        {!activeTab.showBottom && (
          <button className="bottom-reopen" onClick={() => setShowBottom(true)}><PanelBottom size={16} /> {activeTab.labelingMode ? 'Cohorts' : 'Debug'}</button>
        )}
      </section>

      <footer className="status-bar">
        <span><Zap size={13} /> {diagnostics.kind === 'unknown' ? 'Ready' : diagnostics.kind}</span>
        <span>{activeTab.renderStatus.renderedAt ? `Rendered ${activeTab.renderStatus.renderedAt}` : 'Press Play to render'}</span>
        <span>cohorts: {authorableCohorts.length} authorable / {activeTab.cohorts.length} total</span>
        <span>labels: {labeledCohortCount}</span>
        <span>{activeTab.svaCreatedAt ? `SVA created ${activeTab.svaCreatedAt}` : 'SVA not created'}</span>
      </footer>
    </main>
  );
}
