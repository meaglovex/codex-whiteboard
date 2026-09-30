import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ReactFlow, Background, BackgroundVariant, applyNodeChanges, applyEdgeChanges,
  addEdge, MarkerType, useReactFlow, useViewport,
  type NodeChange, type EdgeChange, type Connection,
} from '@xyflow/react';
import { CheckCircle2, ChevronDown, ChevronRight, Download, Hand, Image as ImageIcon, Link2, Maximize, MessageCircle, Minus, MoreHorizontal, MousePointer2, Plus, Square, X } from 'lucide-react';
import { defaultFlowSteps, freshBoard, portableBoard, type BoardNode, type BoardState, type Detail } from './model';
import BoardCard, { CardActions } from './components/BoardCard';
import SidePanel from './components/SidePanel';
import EditDialog from './components/EditDialog';
import ExportDialog from './components/ExportDialog';

const STORAGE_KEY = 'product-whiteboard-v1';
const nodeTypes = { boardCard: BoardCard };
function readBoard(): BoardState {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved?.version === 1 && Array.isArray(saved.nodes) && Array.isArray(saved.edges) && Array.isArray(saved.messages) && saved.nodes.every((node: BoardNode) => typeof node.id === 'string' && node.data?.details && ['idea', 'image', 'flow', 'prototype', 'art'].includes(node.data.kind))) return { ...saved, nodes: saved.nodes.map((node: BoardNode) => node.data.kind === 'flow' && !node.data.steps ? { ...node, data: { ...node.data, steps: defaultFlowSteps } } : node), edges: saved.edges.map((edge: { type?: string }) => ({ ...edge, type: edge.type === 'bezier' ? 'default' : edge.type })) };
  } catch { /* A missing or blocked storage still leaves the canvas usable. */ }
  return freshBoard();
}

function saveFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name;
  a.style.display = 'none'; document.body.append(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}
function detailMarkdown(details: Detail[], depth = 0): string {
  return details.map(d => `${'  '.repeat(depth)}- ${d.title}：${d.body}${d.children?.length ? `\n${detailMarkdown(d.children, depth + 1)}` : ''}`).join('\n');
}

export default function App() {
  const [board, setBoard] = useState(readBoard);
  const [selectedId, setSelectedId] = useState<string>();
  const [editingId, setEditingId] = useState<string>();
  const [exportFile, setExportFile] = useState<{ name: string; content: string; type: string }>();
  const [tool, setTool] = useState<'select' | 'hand' | 'connect'>('select');
  const [menu, setMenu] = useState<'export' | 'more' | null>(null);
  const [mobilePanel, setMobilePanel] = useState(false);
  const [saveState, setSaveState] = useState('已保存');
  const [toast, setToast] = useState('');
  const viewport = useViewport();
  const flow = useReactFlow<BoardNode>();
  const canvasRef = useRef<HTMLDivElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const announce = useCallback((message: string) => { setToast(message); if (toastTimer.current) clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(''), 2500); }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(portableBoard(board))); setSaveState('已保存'); }
      catch { setSaveState('未保存'); announce('浏览器无法保存，请导出完整白板留存。'); }
    }, 200);
    return () => clearTimeout(timer);
  }, [board, announce]);

  const homeView = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const narrow = canvas.clientWidth < 800;
      flow.setViewport({ x: narrow ? -30 : 0, y: narrow ? 90 : 0, zoom: narrow ? .8 : Math.max(.42, Math.min(1, canvas.clientWidth / 1264, (canvas.clientHeight - 36) / 860)) }, { duration: 280 });
    }
  }, [flow]);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const observer = new ResizeObserver(homeView); observer.observe(canvas); return () => observer.disconnect();
  }, [homeView]);

  const onNodesChange = useCallback((changes: NodeChange<BoardNode>[]) => setBoard(current => ({ ...current, nodes: applyNodeChanges(changes, current.nodes) })), []);
  const onEdgesChange = useCallback((changes: EdgeChange[]) => setBoard(current => ({ ...current, edges: applyEdgeChanges(changes, current.edges) })), []);
  const onConnect = useCallback((connection: Connection) => setBoard(current => ({ ...current, edges: addEdge({ ...connection, type: 'default' }, current.edges) })), []);
  const pin = useCallback((id: string) => setBoard(current => ({ ...current, nodes: current.nodes.map(node => node.id === id ? { ...node, data: { ...node.data, pinned: !node.data.pinned } } : node) })), []);
  const open = useCallback((id: string) => { setSelectedId(id); setMobilePanel(true); setMenu(null); }, []);
  const edit = useCallback((id: string) => { setEditingId(id); setMenu(null); }, []);
  const newNode = useCallback((image?: string, name?: string) => {
    const id = crypto.randomUUID();
    const position = flow.screenToFlowPosition({ x: (canvasRef.current?.getBoundingClientRect().left || 0) + Math.min(440, (canvasRef.current?.clientWidth || 800) / 2), y: 270 });
    const node: BoardNode = { id, type: 'boardCard', dragHandle: '.drag-handle', position, data: { kind: image ? 'image' : 'idea', title: name || '一个新的想法', body: image ? '图片参考' : '写下最重要的一句话。', pinned: false, image, details: [{ id: crypto.randomUUID(), title: '继续展开', body: '把这个想法的依据、分支和细节保留在这里。' }] } };
    setBoard(current => ({ ...current, nodes: [...current.nodes, node] }));
    if (!image) setEditingId(id); else announce('图片已放上白板');
  }, [flow, announce]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setEditingId(undefined); setExportFile(undefined); setMenu(null); setMobilePanel(false); return; }
      if ((e.target as HTMLElement)?.closest('input,textarea,[contenteditable=true],[role=dialog]')) return;
      if (e.key.toLowerCase() === 'v') setTool('select');
      if (e.key.toLowerCase() === 'h') setTool('hand');
      if (e.key.toLowerCase() === 'n') newNode();
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [newNode]);

  const uploadImage = (file?: File) => {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) { announce('请使用 PNG、JPG、WebP 或 GIF 图片'); return; }
    if (file.size > 1800000) { announce('请选用小于 1.8 MB 的图片，便于本地保存'); return; }
    const reader = new FileReader(); reader.onload = () => newNode(String(reader.result), file.name.replace(/\.[^.]+$/, '')); reader.readAsDataURL(file);
  };
  const selectedNode = board.nodes.find(node => node.id === selectedId);
  const editingNode = board.nodes.find(node => node.id === editingId);
  const exportBoard = () => { setExportFile({ name: '慢一点-产品白板.json', content: JSON.stringify(portableBoard(board), null, 2), type: 'application/json' }); setMenu(null); };
  const exportSummary = () => {
    const lines = ['# 慢一点 · 产品共识', '', '## 主板', ...board.nodes.map(node => `\n### ${node.data.title}${node.data.pinned ? '（已钉住）' : '（讨论中）'}\n${node.data.body}\n${node.data.steps ? `流程：${node.data.steps.map(s => s.title).join(' → ')}\n` : ''}${detailMarkdown(node.data.details)}`), '\n## 讨论记录', ...board.messages.map(m => `\n${m.role === 'ai' ? '讨论示例 · AI' : '用户'}：${m.text}`)];
    setExportFile({ name: '慢一点-开发上下文.md', content: lines.join('\n'), type: 'text/markdown' }); setMenu(null);
  };

  return <div className={`app ${mobilePanel ? 'panel-open' : ''}`}>
    <header className="topbar">
      <a href="#" className="brand" onClick={e => { e.preventDefault(); homeView(); }}><span className="brand-mark"><Square size={20} /></span><span>产品白板</span></a>
      <span className="header-divider" /><button className="project-title" onClick={homeView}>慢一点 · 日常记录 <ChevronDown size={14} /></button>
      <div className="header-actions"><span className={`save-state ${saveState !== '已保存' ? 'warning' : ''}`}><CheckCircle2 size={15} />{saveState}</span>
        <div className="menu-anchor"><button className="export-button" aria-expanded={menu === 'export'} onClick={() => setMenu(menu === 'export' ? null : 'export')}>导出</button>{menu === 'export' && <div className="dropdown"><button onClick={exportBoard}><Download size={15} />完整白板 · JSON</button><button onClick={exportSummary}><Download size={15} />开发上下文 · Markdown</button></div>}</div>
        <div className="menu-anchor"><button className="icon-button" aria-label="更多操作" onClick={() => setMenu(menu === 'more' ? null : 'more')}><MoreHorizontal size={21} /></button>{menu === 'more' && <div className="dropdown"><button onClick={() => { homeView(); setMenu(null); }}>回到初始视图</button><button onClick={() => { flow.fitView({ padding: .12, duration: 280 }); setMenu(null); }}>查看全部内容</button><button onClick={() => { announce('V 选择 · H 移动画布 · N 新增想法 · 双击编辑'); setMenu(null); }}>快捷操作</button></div>}</div>
      </div>
    </header>
    <main className="workspace">
      <div className={`canvas-shell ${tool === 'connect' ? 'connecting' : ''}`} ref={canvasRef}>
        <div className="board-heading"><h1>让日常，值得被记住。</h1><p>把想法摊开，再一起定下来。</p></div>
        <CardActions.Provider value={{ open, edit, pin, connecting: tool === 'connect' }}>
          <ReactFlow<BoardNode> nodes={board.nodes} edges={board.edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onInit={homeView}
            minZoom={.28} maxZoom={1.8} panOnDrag={tool === 'hand' ? true : [1, 2]} selectionOnDrag={tool === 'select'} nodesDraggable={tool !== 'hand'} nodesConnectable={tool === 'connect'} elementsSelectable={tool !== 'hand'} zoomOnDoubleClick={false}
            deleteKeyCode={null} proOptions={{ hideAttribution: true }} defaultEdgeOptions={{ style: { stroke: '#839078', strokeWidth: 1.5 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#839078', width: 13, height: 13 } }}
            onPaneClick={() => setMenu(null)}><Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#dddcd5" /></ReactFlow>
        </CardActions.Provider>
        <nav className="tool-rail" aria-label="白板工具">
          <button title="选择 · V" aria-label="选择" className={tool === 'select' ? 'active' : ''} onClick={() => setTool('select')}><MousePointer2 size={20} fill={tool === 'select' ? 'currentColor' : 'none'} /></button>
          <button title="移动画布 · H" aria-label="移动画布" className={tool === 'hand' ? 'active' : ''} onClick={() => setTool('hand')}><Hand size={20} /></button>
          <span className="rail-divider" />
          <button title="新增想法 · N" aria-label="新增想法" onClick={() => newNode()}><Plus size={21} /></button>
          <button title="放入图片" aria-label="放入图片" onClick={() => imageInput.current?.click()}><ImageIcon size={20} /></button>
          <span className="rail-divider" />
          <button title="连接想法" aria-label="连接想法" className={tool === 'connect' ? 'active' : ''} onClick={() => setTool(tool === 'connect' ? 'select' : 'connect')}><Link2 size={21} /></button>
        </nav>
        <input ref={imageInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={e => { uploadImage(e.target.files?.[0]); e.target.value = ''; }} />
        <div className="board-breadcrumb"><button onClick={() => setSelectedId(undefined)}>主板</button><ChevronRight size={14} /><span>{selectedNode?.data.title || '慢一点 · 日常记录'}</span></div>
        <div className="zoom-controls"><button aria-label="缩小" onClick={() => flow.zoomOut({ duration: 150 })}><Minus size={17} /></button><button className="zoom-label" title="回到初始视图" onClick={homeView}>{Math.round(viewport.zoom * 100)}%</button><button aria-label="放大" onClick={() => flow.zoomIn({ duration: 150 })}><Plus size={17} /></button><span /><button aria-label="查看全部" onClick={() => flow.fitView({ padding: .1, duration: 200 })}><Maximize size={15} /></button></div>
        <button className="mobile-discuss" aria-label="打开讨论" onClick={() => setMobilePanel(true)}><MessageCircle size={20} /></button>
      </div>
      <SidePanel node={selectedNode} messages={board.messages} onBack={() => setSelectedId(undefined)} onPin={pin} onClose={() => setMobilePanel(false)} onSend={text => { setBoard(current => ({ ...current, messages: [...current.messages, { id: crypto.randomUUID(), role: 'user', text }] })); }} />
    </main>
    {editingNode && <EditDialog node={editingNode} onClose={() => setEditingId(undefined)} onSave={(title, body, steps) => { setBoard(current => ({ ...current, nodes: current.nodes.map(node => node.id === editingNode.id ? { ...node, data: { ...node.data, title, body, steps } } : node) })); setEditingId(undefined); announce('想法已更新'); }} />}
    {exportFile && <ExportDialog file={exportFile} onClose={() => setExportFile(undefined)} onDownload={() => { saveFile(exportFile.name, exportFile.content, exportFile.type); announce('已请求下载，请在浏览器中确认保存结果'); }} />}
    {toast && <div className="toast" role="status">{toast}<button aria-label="关闭提示" onClick={() => setToast('')}><X size={13} /></button></div>}
  </div>;
}
