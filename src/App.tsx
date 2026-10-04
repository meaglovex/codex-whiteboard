import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ReactFlow, useReactFlow } from '@xyflow/react';
import { ArrowUpRight, CircleCheck, Maximize, MessageCircle, MoreHorizontal, PanelsTopLeft } from 'lucide-react';
import { assetImage, type Detail } from './model';
import { evidenceLayout, type CanvasNode } from './evidenceLayout';
import BoardHeading from './components/BoardHeading';
import ThreadEdge from './components/ThreadEdge';
import BoardCard, { CardActions } from './components/BoardCard';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from './components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from './components/ui/sheet';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './components/ui/accordion';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from './components/ui/empty';
import { Alert, AlertDescription, AlertTitle } from './components/ui/alert';
import useBoard from './useBoard';

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
  const flow = useReactFlow<CanvasNode>();
  const [detailId, setDetailId] = useState<string>();
  const [notice, setNotice] = useState<{ title: string; body: string }>();
  const [updatedIds, setUpdatedIds] = useState<string[]>([]);
  const [canvasWidth, setCanvasWidth] = useState(0);
  const narrow = canvasWidth > 0 && canvasWidth < 760;
  const canvas = useRef<HTMLElement>(null);
  const fingerprints = useRef(new Map<string, string>());
  const nodes = useMemo(() => evidenceLayout(board, narrow), [board, narrow]);
  const edges = useMemo(() => board.edges.map(edge => ({ ...edge, type: 'thread', ...(narrow ? { sourceHandle: 'bottom', targetHandle: 'top' } : {}) })), [board.edges, narrow]);
  const fit = useCallback(() => { void flow.fitView({ padding: .06, minZoom: .2, maxZoom: 1.08, duration: 240 }); }, [flow]);
  useEffect(() => {
    if (!canvas.current) return;
    const observer = new ResizeObserver(entries => { setCanvasWidth(entries[0].contentRect.width); });
    observer.observe(canvas.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => { setDetailId(undefined); fingerprints.current.clear(); setNotice(undefined); }, [board.id]);
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
  }, [board.id, board.nodes.length, canvasWidth, narrow, fit, flow]);
  const detail = board.nodes.find(n => n.id === detailId)?.data;
  const run = (operation: () => Promise<unknown>) => { void operation().catch(e => setNotice({ title: '操作未完成', body: (e as Error).message })); };

  return <div className="board-app">
    <header className="board-topbar">
      <div className="board-brand"><PanelsTopLeft aria-hidden="true" /><strong>产品白板</strong></div>
      <span className="board-title">{board.id === 'waiting' ? '从一个想法开始' : board.title}</span>
      <div className="board-topbar-actions">
        <Badge variant="secondary" className="sync-label" data-live={!board.example && following && !error}>{board.example ? '示例白板' : following ? '随对话更新' : '历史白板'}</Badge>
        <Button variant="ghost" size="icon" aria-label="查看全部想法" onClick={fit} disabled={!board.nodes.length}><Maximize data-icon="inline-start" /></Button>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="白板选项" />}><MoreHorizontal data-icon="inline-start" /></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => run(follow)}>跟随当前讨论</DropdownMenuItem>
              <DropdownMenuItem disabled={board.id === 'waiting'} onClick={() => run(async () => { const files = await exportFiles(); setNotice({ title: '开发上下文已保存', body: `${files.markdown}\n${files.json}` }); })}>保存开发上下文</DropdownMenuItem>
            </DropdownMenuGroup>
            {!!boards.length && <><DropdownMenuSeparator /><DropdownMenuGroup><DropdownMenuLabel>已有白板</DropdownMenuLabel>{boards.map(b => <DropdownMenuItem key={b.id} onClick={() => run(() => openBoard(b.id))}>{b.title}{b.example ? ' · 示例' : ''}</DropdownMenuItem>)}</DropdownMenuGroup></>}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
    {(error || notice) && <Alert variant={error ? 'destructive' : 'default'} className="rounded-none border-x-0 border-t-0"><AlertTitle>{error ? '白板暂时无法更新' : notice?.title}</AlertTitle><AlertDescription className="whitespace-pre-wrap break-all">{error || notice?.body}</AlertDescription></Alert>}
    <main className="board-canvas" aria-label="产品核心白板" ref={canvas}>
      <CardActions.Provider value={{ open: setDetailId, updatedIds }}>
        <ReactFlow<CanvasNode> key={board.id} nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
          fitView fitViewOptions={{ padding: .06, minZoom: .2, maxZoom: 1.08 }}
          onNodeClick={(event, node) => { if (node.type === 'boardCard' && !(event.target as HTMLElement).closest('button,textarea,input')) setDetailId(node.id); }}
          nodesDraggable={false} nodesConnectable={false} elementsSelectable={false} panOnDrag panOnScroll={narrow} zoomOnScroll={!narrow} zoomOnDoubleClick={false}
          minZoom={.2} maxZoom={1.8} deleteKeyCode={null} proOptions={{ hideAttribution: true }} />
      </CardActions.Provider>
      {!board.nodes.length && <div className="board-empty"><Empty><EmptyHeader><EmptyMedia variant="icon"><MessageCircle /></EmptyMedia><EmptyTitle>{ready ? '在 Codex 里，把想法说出来。' : '正在连接白板…'}</EmptyTitle><EmptyDescription>{ready ? '例如：“我想做一个像相册一样能回看的日记产品。”\nCodex 会边讨论边把核心想法放到这里。' : '稍候就能看到当前讨论。'}</EmptyDescription></EmptyHeader></Empty></div>}
    </main>
    <footer className="board-footnote"><span><MessageCircle aria-hidden="true" />{narrow ? '滚动画布查看，在 Codex 里继续讨论。' : '在 Codex 里继续讨论，这页会跟着更新。'}</span>{!!board.nodes.length && <span className="revision-label"><CircleCheck aria-hidden="true" />{board.nodes.filter(n => n.data.pinned).length} 个共识 · {board.nodes.length} 个核心想法</span>}</footer>
    <Sheet open={!!detail} onOpenChange={open => { if (!open) setDetailId(undefined); }}>
      <SheetContent className="evidence-details"><SheetHeader><SheetTitle>{detail?.title}</SheetTitle><SheetDescription>核心结论下面的依据、分支与开发细节。</SheetDescription></SheetHeader>
        {detail && <div className="detail-body">{!!detail.image && <img className="mb-4 w-full rounded-lg" src={assetImage(detail.image)} alt={detail.title} />}<p className="mb-4">{detail.body}</p>{!!detail.steps?.length && <ol className="detail-steps">{detail.steps.map((step, i) => <li key={i}><strong>{step.title}</strong><p>{step.sub}</p></li>)}</ol>}<Branches details={detail.details} />{!detail.details.length && <p className="text-muted-foreground">继续在 Codex 里讨论，依据会留在这里。</p>}<p className="mt-6 flex items-center gap-2 text-muted-foreground"><ArrowUpRight aria-hidden="true" className="size-4" />需要调整时，直接告诉 Codex。</p></div>}
      </SheetContent>
    </Sheet>
  </div>;
}
