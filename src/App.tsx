import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ReactFlow, useReactFlow } from '@xyflow/react';
import { ArrowUpRight, CircleCheck, FileText, Maximize, MessageCircle, MoreHorizontal, PanelsTopLeft } from 'lucide-react';
import { assetImage, type Detail } from './model';
import { evidenceLayout, type CanvasNode } from './evidenceLayout';
import BoardHeading from './components/BoardHeading';
import ThreadEdge from './components/ThreadEdge';
import PlanSheet from './components/PlanSheet';
import ProgressBoard from './components/project/ProgressBoard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import BoardCard, { CardActions } from './components/BoardCard';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from './components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from './components/ui/sheet';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './components/ui/accordion';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from './components/ui/empty';
import { Alert, AlertDescription, AlertTitle } from './components/ui/alert';
import useBoard from './useBoard';
import { useI18n } from './i18n';
import { inNativePanel } from './nativeBridge';

const nodeTypes = { boardCard: BoardCard, boardHeading: BoardHeading };
const edgeTypes = { thread: ThreadEdge };
function Branches({ details }: { details: Detail[] }) {
  return <Accordion>{details.map(detail => <AccordionItem value={detail.id} key={detail.id}>
    <AccordionTrigger>{detail.title}</AccordionTrigger>
    <AccordionContent><p>{detail.body}</p>{!!detail.children?.length && <div className="depth-branch"><Branches details={detail.children} /></div>}</AccordionContent>
  </AccordionItem>)}</Accordion>;
}

export default function App() {
  const { board, boards, ready, error, following, openBoard, follow, exportFiles } = useBoard();
  const { t, errorText } = useI18n();
  const displayBoard = useMemo(() => board.id === 'waiting' ? { ...board, title: t('newIdea'), goal: t('waitingGoal') } : board, [board, t]);
  const flow = useReactFlow<CanvasNode>();
  const [detailId, setDetailId] = useState<string>();
  const [planOpen, setPlanOpen] = useState(false);
  const [view, setView] = useState<'discovery' | 'development'>(() => new URLSearchParams(location.search).get('view') === 'development' ? 'development' : 'discovery');
  const previousPhase = useRef<{ boardId: string; phase?: string }>({ boardId: 'waiting' });
  const [notice, setNotice] = useState<{ titleKey: string; body: string }>();
  const [updatedIds, setUpdatedIds] = useState<string[]>([]);
  const [canvasWidth, setCanvasWidth] = useState(0);
  const narrow = canvasWidth > 0 && canvasWidth < 760;
  const canvas = useRef<HTMLElement>(null);
  const fingerprints = useRef(new Map<string, string>());
  const nodes = useMemo(() => evidenceLayout(displayBoard, narrow), [displayBoard, narrow]);
  const edges = useMemo(() => board.edges.map(edge => ({ ...edge, type: 'thread', ...(narrow ? { sourceHandle: 'bottom', targetHandle: 'top' } : {}) })), [board.edges, narrow]);
  const fit = useCallback(() => { void flow.fitView({ padding: .06, minZoom: .2, maxZoom: 1.08, duration: 240 }); }, [flow]);
  useEffect(() => {
    if (!canvas.current) return;
    const observer = new ResizeObserver(entries => { setCanvasWidth(entries[0].contentRect.width); });
    observer.observe(canvas.current);
    return () => observer.disconnect();
  }, [view]);
  useEffect(() => {
    if (board.id === 'waiting') return;
    const starting = previousPhase.current.boardId === board.id && previousPhase.current.phase !== 'development' && board.phase === 'development';
    const url = new URL(location.href);
    const requested = url.searchParams.get('view');
    const next = starting ? 'development' : requested === 'development' || requested === 'discovery' ? requested : board.phase === 'development' ? 'development' : 'discovery';
    setView(next);
    if (starting && !inNativePanel) { url.searchParams.set('view', 'development'); history.replaceState(null, '', url); }
    previousPhase.current = { boardId: board.id, phase: board.phase };
  }, [board.id, board.phase]);
  useEffect(() => { setDetailId(undefined); setPlanOpen(false); fingerprints.current.clear(); setNotice(undefined); }, [board.id]);
  useEffect(() => {
    const changed = board.nodes.filter(n => fingerprints.current.has(n.id) && fingerprints.current.get(n.id) !== JSON.stringify(n.data)).map(n => n.id);
    fingerprints.current = new Map(board.nodes.map(n => [n.id, JSON.stringify(n.data)]));
    setUpdatedIds(changed);
    const timer = setTimeout(() => setUpdatedIds([]), 1500);
    return () => clearTimeout(timer);
  }, [board.nodes]);
  useEffect(() => {
    if (!canvasWidth) return;
    const timer = setTimeout(() => {
      if (narrow && canvas.current) {
        const zoom = Math.min(1, (canvas.current.clientWidth - 44) / 340);
        void flow.setViewport({ x: (canvas.current.clientWidth - 340 * zoom) / 2 - 24 * zoom, y: 12, zoom }, { duration: 240 });
      }
      else fit();
    }, 150);
    return () => clearTimeout(timer);
  }, [board.id, board.nodes.length, canvasWidth, narrow, fit, flow, view]);
  const detail = board.nodes.find(n => n.id === detailId)?.data;
  const run = (operation: () => Promise<unknown>) => { void operation().catch(e => setNotice({ titleKey: 'operationFailed', body: (e as Error).message })); };

  const changeView = (value: unknown) => {
    if (value !== 'discovery' && value !== 'development') return;
    setView(value); setDetailId(undefined); setPlanOpen(false);
    if (!inNativePanel) { const url = new URL(location.href); url.searchParams.set('view', value); history.replaceState(null, '', url); }
  };
  return <Tabs className="board-app" value={view} onValueChange={changeView}>
    <header className="board-topbar">
      <div className="board-brand"><PanelsTopLeft aria-hidden="true" /><strong>{t('brandName')}</strong></div>
      <span className="board-title">{board.id === 'waiting' ? t('startIdea') : board.title}</span>
      <TabsList className="board-mode-tabs" aria-label={t('boardViews')}><TabsTrigger value="discovery">{t('ideasTab')}</TabsTrigger><TabsTrigger value="development">{t('progressTab')}</TabsTrigger></TabsList>
      <div className="board-topbar-actions">
        <Badge variant="secondary" className="sync-label" data-live={!board.example && !error}>{t(board.example ? 'exampleBoard' : view === 'development' ? board.progress ? 'followsDevelopment' : 'progressPending' : following ? 'followsConversation' : 'currentBoard')}</Badge>
        <Button variant="ghost" size="sm" className="plan-entry" disabled={!ready} onClick={() => { setDetailId(undefined); setPlanOpen(true); }}><FileText data-icon="inline-start" />{t('viewPlan')}</Button>
        {view === 'discovery' && <Button variant="ghost" size="icon" aria-label={t('viewAllIdeas')} onClick={fit} disabled={!board.nodes.length}><Maximize data-icon="inline-start" /></Button>}
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={t('boardOptions')} />}><MoreHorizontal data-icon="inline-start" /></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => run(follow)}>{t('followConversation')}</DropdownMenuItem>
              <DropdownMenuItem disabled={board.id === 'waiting'} onClick={() => run(async () => { const files = await exportFiles(); setNotice({ titleKey: 'contextSaved', body: `${files.markdown}\n${files.json}` }); })}>{t('saveContext')}</DropdownMenuItem>
            </DropdownMenuGroup>
            {!!boards.length && <><DropdownMenuSeparator /><DropdownMenuGroup><DropdownMenuLabel>{t('existingBoards')}</DropdownMenuLabel>{boards.map(b => <DropdownMenuItem key={b.id} onClick={() => run(() => openBoard(b.id))}>{b.title}{b.example ? ` · ${t('example')}` : ''}</DropdownMenuItem>)}</DropdownMenuGroup></>}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
    {(error || notice) && <Alert variant={error ? 'destructive' : 'default'} className="rounded-none border-x-0 border-t-0"><AlertTitle>{t(error ? 'cannotUpdate' : notice?.titleKey || 'operationFailed')}</AlertTitle><AlertDescription className="whitespace-pre-wrap break-all">{errorText(error || notice?.body || '')}</AlertDescription></Alert>}
    <TabsContent value="discovery" className="discovery-panel">
    <main className="board-canvas" aria-label={t('ideaCanvas')} ref={canvas}>
      <CardActions.Provider value={{ open: setDetailId, updatedIds }}>
        <ReactFlow<CanvasNode> key={board.id} nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
          fitView fitViewOptions={{ padding: .06, minZoom: .2, maxZoom: 1.08 }}
          onNodeClick={(event, node) => { if (node.type === 'boardCard' && !(event.target as HTMLElement).closest('button,textarea,input')) setDetailId(node.id); }}
          nodesDraggable={false} nodesConnectable={false} elementsSelectable={false} panOnDrag panOnScroll={narrow} zoomOnScroll={!narrow} zoomOnDoubleClick={false}
          minZoom={.2} maxZoom={1.8} deleteKeyCode={null} proOptions={{ hideAttribution: true }} />
      </CardActions.Provider>
      {!board.nodes.length && <div className="board-empty"><Empty><EmptyHeader><EmptyMedia variant="icon"><MessageCircle /></EmptyMedia><EmptyTitle>{t(ready ? 'discussInCodex' : 'connecting')}</EmptyTitle><EmptyDescription>{t(ready ? 'ideaExample' : 'loadingConversation')}</EmptyDescription></EmptyHeader></Empty></div>}
    </main>
    <footer className="board-footnote"><span><MessageCircle aria-hidden="true" />{t(narrow ? 'continueDiscussionMobile' : 'continueDiscussion')}</span>{!!board.nodes.length && <span className="revision-label"><CircleCheck aria-hidden="true" />{t('ideaCounts', { consensus: board.nodes.filter(n => n.data.pinned).length, ideas: board.nodes.length })}</span>}</footer>
    </TabsContent>
    <TabsContent value="development" className="development-panel"><ProgressBoard key={board.id} board={board} error={error} /></TabsContent>
    <PlanSheet key={`${board.id}:${board.plan?.updatedAt || 'empty'}`} plan={board.plan} open={planOpen} onOpenChange={setPlanOpen} onSave={exportFiles} />
    <Sheet open={!!detail} onOpenChange={open => { if (!open) setDetailId(undefined); }}>
      <SheetContent className="evidence-details"><SheetHeader><SheetTitle>{detail?.title}</SheetTitle><SheetDescription>{t('evidenceDescription')}</SheetDescription></SheetHeader>
        {detail && <div className="detail-body">{!!detail.image && <img className="mb-4 w-full rounded-lg" src={assetImage(detail.image)} alt={detail.title} />}<p className="mb-4">{detail.body}</p>{!!detail.steps?.length && <ol className="detail-steps">{detail.steps.map((step, i) => <li key={i}><strong>{step.title}</strong><p>{step.sub}</p></li>)}</ol>}<Branches details={detail.details} />{!detail.details.length && <p className="text-muted-foreground">{t('noEvidenceYet')}</p>}<p className="mt-6 flex items-center gap-2 text-muted-foreground"><ArrowUpRight aria-hidden="true" className="size-4" />{t('askCodexToChange')}</p></div>}
      </SheetContent>
    </Sheet>
  </Tabs>;
}
