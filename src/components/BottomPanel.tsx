import { useEffect, useRef } from 'react';
import { AlertCircle, Bug, GripHorizontal, X } from 'lucide-react';
import type { CohortLabels, VisualCohort } from '../lib/cohorting';
import type { EditorLog } from '../lib/editorModel';

interface BottomPanelProps {
  cohorts: VisualCohort[];
  selectedCohortId: string | null;
  labels: CohortLabels;
  problems: EditorLog[];
  logs: EditorLog[];
  labelingMode: boolean;
  renderStatus: { ok: boolean; message: string; renderedAt: string | null };
  bottomPanelHeight: number;
  onBottomPanelHeightChange: (height: number) => void;
  onSelectCohort: (id: string) => void;
  onFocusLine: (line: number) => void;
  onClose: () => void;
}

export function BottomPanel({ cohorts, selectedCohortId, labels, problems, logs, labelingMode, renderStatus, bottomPanelHeight, onBottomPanelHeightChange, onSelectCohort, onFocusLine, onClose }: BottomPanelProps) {
  const hasProblems = problems.length > 0 && !renderStatus.ok;
  const authorableCohorts = cohorts.filter((cohort) => cohort.authorable !== false);
  const labeledCount = authorableCohorts.filter((cohort) => Boolean(labels[cohort.id]?.role?.trim())).length;
  const totalAuthorable = authorableCohorts.length;
  const remainingCount = Math.max(0, totalAuthorable - labeledCount);
  const progressPercent = totalAuthorable > 0 ? Math.round((labeledCount / totalAuthorable) * 100) : 0;
  const resizeStartRef = useRef<{ startY: number; startHeight: number } | null>(null);

  useEffect(() => {
    function onPointerMove(event: PointerEvent) {
      const start = resizeStartRef.current;
      if (!start) return;
      const next = Math.max(120, Math.min(420, start.startHeight - (event.clientY - start.startY)));
      onBottomPanelHeightChange(next);
    }
    function onPointerUp() {
      resizeStartRef.current = null;
      document.body.classList.remove('resizing-bottom-panel');
    }
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [onBottomPanelHeightChange]);

  function startResize(event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    resizeStartRef.current = { startY: event.clientY, startHeight: bottomPanelHeight };
    document.body.classList.add('resizing-bottom-panel');
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  const title = hasProblems
    ? 'Specification / render problems'
    : labelingMode
      ? `Authorable cohorts (${authorableCohorts.length})`
      : 'Debug / inspection mode';

  return (
    <section className={`bottom-panel cohort-bottom-panel ${hasProblems ? 'problem-mode' : ''} ${labelingMode ? 'labeling-mode' : 'debug-mode'}`}>
      <button className="bottom-resize-handle" onPointerDown={startResize} title="Resize bottom panel"><GripHorizontal size={18} /></button>
      <div className="bottom-tabs cohort-only-tabs">
        <div className="bottom-panel-title">{title}</div>
        <button className="close-bottom" onClick={onClose}><X size={15} /></button>
      </div>
      <div className="console-content cohort-only-content">
        {hasProblems ? (
          <div className="problem-list compact-problem-list">
            {problems.map((problem, index) => (
              <button
                key={`${problem.message}-${index}`}
                className={`problem-row ${problem.level}`}
                onClick={() => problem.lineNumber && onFocusLine(problem.lineNumber)}
                disabled={!problem.lineNumber}
                title={problem.lineNumber ? `Go to line ${problem.lineNumber}` : problem.message}
              >
                <AlertCircle size={15} />
                <span className="problem-message">{problem.message}</span>
                {problem.lineNumber && <strong>line {problem.lineNumber}</strong>}
              </button>
            ))}
          </div>
        ) : !labelingMode ? (
          <div className="debug-log-panel">
            {logs.filter((log) => log.level === 'error' || log.level === 'warning').length > 0 ? (
              logs.filter((log) => log.level === 'error' || log.level === 'warning').map((log, index) => (
                <div key={`${log.timestamp}-${index}-${log.message}`} className={`debug-log-row ${log.level}`}>
                  <Bug size={15} />
                  <span className="timestamp">{log.timestamp}</span>
                  <span>{log.message}</span>
                </div>
              ))
            ) : (
              <div className="empty-state quiet-debug-state">No debug messages.</div>
            )}
          </div>
        ) : authorableCohorts.length === 0 ? (
          <div className="empty-state">No authorable cohorts yet. Press Play to validate the specification, render the SVG, and compute visual cohorts.</div>
        ) : (
          <div className="cohort-labeling-dashboard">
            <div className="cohort-progress-summary" aria-label={`${labeledCount} of ${totalAuthorable} cohorts labeled`}>
              <div className="cohort-progress-text">
                <strong>{labeledCount}/{totalAuthorable} labeled</strong>
                <span>{remainingCount === 0 ? 'All cohorts labeled' : `${remainingCount} remaining`}</span>
              </div>
              <div className="cohort-progress-track" title={`${progressPercent}% complete`}>
                <div className="cohort-progress-fill" style={{ width: `${progressPercent}%` }} />
              </div>
              <div className="cohort-progress-dots" aria-hidden="true">
                {authorableCohorts.map((cohort, index) => {
                  const isLabeled = Boolean(labels[cohort.id]?.role?.trim());
                  return (
                    <button
                      key={`dot-${cohort.id}`}
                      className={`cohort-progress-dot ${isLabeled ? 'labeled' : 'unlabeled'} ${cohort.id === selectedCohortId ? 'active' : ''}`}
                      onClick={() => onSelectCohort(cohort.id)}
                      title={`${index + 1}. ${cohort.title} · ${isLabeled ? 'labeled' : 'unlabeled'}`}
                    />
                  );
                })}
              </div>
            </div>
            <div className="cohort-thumbnail-strip">
              {authorableCohorts.map((cohort, index) => {
                const role = labels[cohort.id]?.role?.trim();
                const status = role ? 'labeled' : 'unlabeled';
                const statusText = role || cohort.suggestedRole;
                return (
                  <button
                    key={cohort.id}
                    className={`cohort-thumb ${cohort.id === selectedCohortId ? 'active' : ''} ${status}`}
                    onClick={() => onSelectCohort(cohort.id)}
                    title={`${index + 1}. ${cohort.title} · ${cohort.count} element${cohort.count === 1 ? '' : 's'} · ${role ? `label: ${role}` : `suggested: ${cohort.suggestedRole}`}
${cohort.evidence}`}
                  >
                    <div className="cohort-thumb-image">
                      <img src={cohort.thumbnailSvg} alt={cohort.title} />
                      <span className="cohort-thumb-count">{cohort.count}</span>
                    </div>
                    <div className="cohort-thumb-meta">
                      <div className="cohort-thumb-title-row">
                        <strong>{index + 1}. {cohort.title}</strong>
                        <span className={`cohort-thumb-status ${status}`}>{role ? 'done' : 'todo'}</span>
                      </div>
                      <em>{role ? `label: ${statusText}` : `suggested: ${statusText}`}</em>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
