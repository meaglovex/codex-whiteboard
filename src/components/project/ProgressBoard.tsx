import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MarkerType, ReactFlow, ReactFlowProvider, useReactFlow } from '@xyflow/react';
import { Crosshair, Map, Maximize, Minus, Plus } from 'lucide-react';
import type { BoardState } from '../../model';
import { inNativePanel } from '../../nativeBridge';
import { currentMilestone, milestoneSummaries, progressGraph, statusLabel, taskCounts, type MilestoneNode } from '../../progressModel';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '../ui/empty';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '../ui/sheet';
import MilestoneCard, { MilestoneActions } from './MilestoneCard';
import TaskInspector from './TaskInspector';
import StatusBadge from './StatusBadge';
import { useI18n } from '../../i18n';
import '../../project.css';

const nodeTypes = { milestone: MilestoneCard };
function readSelection(boardId: string) {
  if (inNativePanel) return undefined;
  const params = new URLSearchParams(location.search);
  return params.get('board') === boardId ? params.get('milestone') || undefined : undefined;
}
function ProgressMap({ board, error }: { board: BoardState; error: string }) {
  const progress = board.progress!;
  const { t, locale, formatDate } = useI18n();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(() => readSelection(board.id));
  const manualSelection = useRef(!!selectedId);
  const [now, setNow] = useState(Date.now());
  const [docked, setDocked] = useState(() => matchMedia('(min-width: 1440px)').matches);
  const canvas = useRef<HTMLDivElement>(null);
  const flow = useReactFlow<MilestoneNode>();
  const compact = size.width > 0 && size.width < 760;
  const items = useMemo(() => milestoneSummaries(progress, locale), [progress, locale]);
  const current = currentMilestone(items);
  const selected = items.find(item => item.milestone.id === selectedId) || current || items[0];
  const graph = useMemo(() => progressGraph(items, compact, selected?.milestone.id), [items, compact, selected?.milestone.id]);
  const counts = taskCounts(progress.tasks);
  useEffect(() => {
    if (!canvas.current) return;
    const observer = new ResizeObserver(entries => { const { width, height } = entries[0].contentRect; setSize({ width, height }); });
    observer.observe(canvas.current); return () => observer.disconnect();
  }, []);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(timer); }, []);
  useEffect(() => { const query = matchMedia('(min-width: 1440px)'); const update = () => setDocked(query.matches); query.addEventListener('change', update); return () => query.removeEventListener('change', update); }, []);
  useEffect(() => { if (!manualSelection.current && current) setSelectedId(current.milestone.id); }, [current?.milestone.id]);
  const focus = useCallback((id?: string) => {
    const node = graph.nodes.find(entry => entry.id === id);
    if (node) void flow.setCenter(node.position.x + (node.width || 300) / 2, node.position.y + (node.height || 244) / 2, { zoom: compact ? Math.min(1, (size.width - 30) / 330) : 1, duration: 220 });
  }, [graph.nodes, compact, flow, size.width]);
  const fit = useCallback(() => { void flow.fitView({ padding: .08, minZoom: .8, maxZoom: 1, duration: 220 }); }, [flow]);
  useEffect(() => {
    if (!size.width) return;
    const timer = setTimeout(() => { if (compact || size.height < 580 || graph.nodes.length > 6) focus(selected?.milestone.id); else fit(); }, 100);
    return () => clearTimeout(timer);
  // Only geometry changes reposition the viewport. Live updates must not move a user's reading target.
  }, [size.width, size.height, compact, graph.nodes.length]);
  const rememberSelection = (id: string) => {
    if (!inNativePanel) { const url = new URL(location.href); url.searchParams.set('milestone', id); url.searchParams.set('view', 'development'); history.replaceState(null, '', url); }
  };
  const select = (id: string) => {
    manualSelection.current = true; setSelectedId(id); if (!docked) setInspectorOpen(true);
    rememberSelection(id);
  };
  const ageMinutes = Math.max(0, Math.floor((now - Date.parse(progress.updatedAt)) / 60000));
  const timestamp = formatDate(progress.updatedAt, { hour: '2-digit', minute: '2-digit' });
  return <section className="progress-workspace" aria-label={t('projectProgress')}>
    <header className="project-overview"><span className="paper-tape tape-left" aria-hidden="true" /><span className="paper-tape tape-right" aria-hidden="true" /><div className="project-heading"><h1>{board.title}<span>{t('development')}</span></h1><p aria-live="polite">{progress.summary}</p></div>
      <div className="project-totals"><div><strong>{counts.done} / {counts.total}</strong><span>{t('completedItems')}</span><Progress value={counts.ratio * 100} aria-label={t('completionMeasure')} /></div>
        {!!counts.blocked && <p className="blocked-total">{counts.blocked}<span>{t('blockedItems')}</span></p>}
        <p className="project-sync" data-stale={!!error || ageMinutes >= 15}>{error ? t('syncInterrupted') : ageMinutes >= 15 ? t('minutesSinceSync', { count: ageMinutes }) : t('latestSync')}<time dateTime={progress.updatedAt}>{timestamp}</time></p>
      </div>
    </header>
    <div className="project-body">
      <div className="project-map" ref={canvas}>
        <MilestoneActions.Provider value={{ select }}>
          <ReactFlow<MilestoneNode> nodes={graph.nodes} edges={graph.edges} nodeTypes={nodeTypes} fitView={!compact} fitViewOptions={{ padding: .08, minZoom: .8, maxZoom: 1 }}
            onNodeClick={(event, node) => { if (!(event.target as HTMLElement).closest('button')) select(node.id); }}
            nodesDraggable={false} nodesConnectable={false} nodesFocusable={false} edgesFocusable={false} elementsSelectable={false} deleteKeyCode={null} minZoom={.4} maxZoom={1.5}
            zoomOnDoubleClick={false} panOnScroll={compact} zoomOnScroll={!compact} proOptions={{ hideAttribution: true }}
            defaultEdgeOptions={{ type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: 'var(--project-route-color)' } }} />
        </MilestoneActions.Provider>
        <div className="project-map-controls"><Button variant="outline" size="icon" aria-label={t('zoomOut')} onClick={() => void flow.zoomOut()}><Minus /></Button><Button variant="outline" size="icon" aria-label={t('zoomIn')} onClick={() => void flow.zoomIn()}><Plus /></Button><Button variant="outline" size="sm" onClick={fit}><Maximize data-icon="inline-start" />{t('fitView')}</Button><Button variant="outline" size="icon" aria-label={t('locateCurrent')} onClick={() => { manualSelection.current = false; if (current) { setSelectedId(current.milestone.id); focus(current.milestone.id); rememberSelection(current.milestone.id); } }}><Crosshair /></Button></div>
        {compact && selected && <Button variant="secondary" className="mobile-stage-details" onClick={() => setInspectorOpen(true)}>{t('viewStageTasks', { title: selected.milestone.title })}</Button>}
      </div>
      {docked && selected && <div className="project-desktop-inspector"><TaskInspector key={selected.milestone.id} item={selected} progress={progress} /></div>}
    </div>
    <footer className="project-footer"><div className="project-legend">{(['done', 'in_progress', 'review', 'blocked', 'locked'] as const).map(status => <StatusBadge key={status} status={status} />)}</div><span>{t('basedOnAcceptance')}</span></footer>
    <Sheet open={!docked && inspectorOpen} onOpenChange={setInspectorOpen}><SheetContent className="project-detail-sheet"><SheetHeader><SheetTitle>{t('stageTasks')}</SheetTitle><SheetDescription>{selected ? `${selected.milestone.title} · ${statusLabel(selected.status, locale)}` : t('taskDetailsHint')}</SheetDescription></SheetHeader>{selected && <TaskInspector key={selected.milestone.id} item={selected} progress={progress} />}</SheetContent></Sheet>
  </section>;
}
export default function ProgressBoard({ board, error }: { board: BoardState; error: string }) {
  const { t } = useI18n();
  if (!board.progress?.milestones.length) return <div className="progress-workspace progress-empty"><Empty><EmptyHeader><EmptyMedia variant="icon"><Map /></EmptyMedia><EmptyTitle>{t(board.id === 'waiting' ? 'loadingProgress' : 'progressEmpty')}</EmptyTitle><EmptyDescription>{t('progressEmptyHelp')}</EmptyDescription></EmptyHeader></Empty></div>;
  return <ReactFlowProvider><ProgressMap board={board} error={error} /></ReactFlowProvider>;
}
