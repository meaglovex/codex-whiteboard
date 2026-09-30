import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ReactFlow, Background, BackgroundVariant, applyNodeChanges, applyEdgeChanges,
  addEdge, MarkerType, useReactFlow, useViewport,
  type NodeChange, type EdgeChange, type Connection,
} from '@xyflow/react';
import { CheckCircle2, ChevronDown, ChevronRight, Download, Hand, Image as ImageIcon, Link2, Maximize, MessageCircle, Minus, MoreHorizontal, MousePointer2, Plus, Square, X } from 'lucide-react';
import { portableBoard, type BoardNode, type Card, type Kind } from './model';
import { toMarkdown } from '../shared/export.mjs';
import BoardCard, { CardActions } from './components/BoardCard';
import SidePanel from './components/SidePanel';
import EditDialog from './components/EditDialog';
import ExportDialog from './components/ExportDialog';
import ProjectDialog from './components/ProjectDialog';
import PreferencesDialog from './components/PreferencesDialog';
import DetailDialog from './components/DetailDialog';
import useBoard from './useBoard';

const nodeTypes = { boardCard: BoardCard };

export default function App() {
  const state=useBoard();
  const {board,setBoard,saveState}=state;
  const [selectedId, setSelectedId] = useState<string>();
  const [editingId, setEditingId] = useState<string>();
  const [exportFile, setExportFile] = useState<{ name: string; content: string; type: string }>();
  const [projectDialog,setProjectDialog]=useState<'new'|'edit'>();
  const [preferencesDialog,setPreferencesDialog]=useState(false);
  const [detailId,setDetailId]=useState<string>();
  const [newKind,setNewKind]=useState<Kind>('idea');
  const [tool, setTool] = useState<'select' | 'hand' | 'connect'>('select');
  const [menu, setMenu] = useState<'export' | 'more' | 'projects' | 'add' | null>(null);
  const [mobilePanel, setMobilePanel] = useState(false);
  const [toast, setToast] = useState('');
  const viewport = useViewport();
  const flow = useReactFlow<BoardNode>();
  const canvasRef = useRef<HTMLDivElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const importInput=useRef<HTMLInputElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const announce = useCallback((message: string) => { setToast(message); if (toastTimer.current) clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(''), 2500); }, []);

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
  useEffect(()=>{setSelectedId(undefined);setEditingId(undefined);setDetailId(undefined);setMobilePanel(false);},[board.id]);

  const onNodesChange = useCallback((changes: NodeChange<BoardNode>[]) => setBoard(current => ({ ...current, nodes: applyNodeChanges(changes, current.nodes) })), []);
  const onEdgesChange = useCallback((changes: EdgeChange[]) => setBoard(current => ({ ...current, edges: applyEdgeChanges(changes, current.edges) })), []);
  const onConnect = useCallback((connection: Connection) => setBoard(current => ({ ...current, edges: addEdge({ ...connection, type: 'default' }, current.edges) })), []);
  const pin = useCallback((id: string) => setBoard(current => ({ ...current, nodes: current.nodes.map(node => node.id === id ? { ...node, data: { ...node.data, pinned: !node.data.pinned } } : node) })), []);
  const open = useCallback((id: string) => { setSelectedId(id); setMobilePanel(true); setMenu(null); }, []);
  const edit = useCallback((id: string) => { setEditingId(id); setMenu(null); }, []);
  const newNode = useCallback((image?: string, name?: string,kind:Kind='idea',candidate?:Card) => {
    const id = crypto.randomUUID();
    const position = flow.screenToFlowPosition({ x: (canvasRef.current?.getBoundingClientRect().left || 0) + Math.min(440, (canvasRef.current?.clientWidth || 800) / 2), y: 270 });
    const node: BoardNode = { id, type: 'boardCard', dragHandle: '.drag-handle', position, data: candidate||{ kind: image ? kind==='art'?'art':'image' : kind, title: name || (kind==='flow'?'主流程':kind==='prototype'?'关键交互':'一个新的想法'), body: image ? '图片参考' : kind==='idea'?'写下最重要的一句话。':'', pinned: false, image, ...(kind==='flow'?{steps:[{title:'进入场景',sub:'从哪里开始'},{title:'关键动作',sub:'用户做什么'},{title:'获得结果',sub:'产品交付什么'}]}:{}),...(kind==='prototype'?{prototype:{screenTitle:'完成一个关键动作',actionLabel:'开始',placeholder:'输入这一轮想验证的内容',successText:'操作已完成'}}:{}),details: [{ id: crypto.randomUUID(), title: '继续展开', body: '把这个想法的依据、分支和细节保留在这里。' }] } };
    setBoard(current => {
      const sizes={idea:[336,250],image:[364,335],flow:[672,266],prototype:[320,390],art:[161,220]};
      const [width,height]=sizes[node.data.kind];
      for(let attempt=0;attempt<60;attempt++){
        const overlaps=current.nodes.some(n=>{const [w,h]=sizes[n.data.kind];return node.position.x<n.position.x+w+30&&node.position.x+width+30>n.position.x&&node.position.y<n.position.y+h+30&&node.position.y+height+30>n.position.y;});
        if(!overlaps)break;
        node.position={x:144+(attempt%3)*380,y:190+Math.floor(attempt/3)*420};
      }
      return { ...current, nodes: [...current.nodes, node] };
    });
    requestAnimationFrame(()=>{void flow.fitView({nodes:[{id}],padding:.35,maxZoom:1,minZoom:.55,duration:250});});
    if (!image&&!candidate) setEditingId(id); else announce(candidate?'候选已放上白板，仍可继续讨论':'图片已放上白板');
    setMenu(null);
  }, [flow, announce,setBoard]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setEditingId(undefined); setExportFile(undefined);setProjectDialog(undefined);setPreferencesDialog(false);setDetailId(undefined); setMenu(null); setMobilePanel(false); return; }
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
    const reader = new FileReader(); reader.onload = () => newNode(String(reader.result), file.name.replace(/\.[^.]+$/, ''),newKind); reader.readAsDataURL(file);
  };
  const selectedNode = board.nodes.find(node => node.id === selectedId);
  const editingNode = board.nodes.find(node => node.id === editingId);
  const exportBoard = () => { setExportFile({ name: `${board.title}-产品白板.json`, content: JSON.stringify(portableBoard(board), null, 2), type: 'application/json' }); setMenu(null); };
  const exportSummary = () => {
    setExportFile({ name: `${board.title}-开发上下文.md`, content: toMarkdown(board), type: 'text/markdown' }); setMenu(null);
  };

  return <div className={`app ${mobilePanel ? 'panel-open' : ''}`}>
    <header className="topbar">
      <a href="#" className="brand" onClick={e => { e.preventDefault(); homeView(); }}><span className="brand-mark"><Square size={20} /></span><span>产品白板</span></a>
      <span className="header-divider" /><div className="menu-anchor"><button className="project-title" aria-expanded={menu==='projects'} onClick={()=>{setMenu(menu==='projects'?null:'projects');void state.refreshList();}}>{board.title}{board.example&&<span className="sample-mark">示例</span>} <ChevronDown size={14} /></button>{menu==='projects'&&<div className="dropdown project-menu">{state.boards.map(b=><button key={b.id} onClick={()=>{void state.openBoard(b.id).then(()=>{setSelectedId(undefined);homeView();setMenu(null);}).catch(e=>state.setError(e.message));}}>{b.title}</button>)}<button onClick={()=>{setProjectDialog('new');setMenu(null);}}><Plus size={15}/>新的产品</button><button onClick={()=>{setProjectDialog('edit');setMenu(null);}}>编辑当前目标</button></div>}</div>
      <div className="header-actions"><span className={`save-state ${saveState !== '已保存' ? 'warning' : ''}`}><CheckCircle2 size={15} />{saveState}</span>
        <div className="menu-anchor"><button className="export-button" aria-expanded={menu === 'export'} onClick={() => setMenu(menu === 'export' ? null : 'export')}>导出</button>{menu === 'export' && <div className="dropdown"><button onClick={exportBoard}><Download size={15} />完整白板 · JSON</button><button onClick={exportSummary}><Download size={15} />开发上下文 · Markdown</button></div>}</div>
        <div className="menu-anchor"><button className="icon-button" aria-label="更多操作" onClick={() => setMenu(menu === 'more' ? null : 'more')}><MoreHorizontal size={21} /></button>{menu === 'more' && <div className="dropdown"><button onClick={() => { homeView(); setMenu(null); }}>回到初始视图</button><button onClick={() => { flow.fitView({ padding: .12, duration: 280 }); setMenu(null); }}>查看全部内容</button><button onClick={()=>setMenu('projects')}>切换产品</button><button onClick={()=>{state.undo();setMenu(null);}}>撤销上一步</button><button onClick={()=>{state.redo();setMenu(null);}}>重做上一步</button><button onClick={()=>{setPreferencesDialog(true);setMenu(null);}}>偏好与记忆</button><button onClick={()=>{importInput.current?.click();setMenu(null);}}>导入完整白板</button><button onClick={()=>{setProjectDialog('new');setMenu(null);}}>新的产品</button><button onClick={()=>{setProjectDialog('edit');setMenu(null);}}>编辑产品目标</button><button onClick={() => { announce('V 选择 · H 移动画布 · N 新增想法 · 双击编辑'); setMenu(null); }}>快捷操作</button></div>}</div>
      </div>
    </header>
    <main className="workspace" inert={!state.ready}>
      <div className={`canvas-shell ${tool === 'connect' ? 'connecting' : ''}`} ref={canvasRef}>
        <div className="board-heading"><h1>{board.example?'让日常，值得被记住。':board.title}</h1><p title={board.goal}>{board.example?'把想法摊开，再一起定下来。':board.goal||'把想法摊开，再一起定下来。'}</p></div>
        {!board.nodes.length&&<div className="empty-board"><h2>先把最核心的想法放上来。</h2><p>一张便签、一段流程，或者一张说明感觉的图片。</p><button onClick={()=>newNode()}>放下第一个想法</button></div>}
        <CardActions.Provider value={{ open, edit, pin, connecting: tool === 'connect' }}>
          <ReactFlow<BoardNode> key={board.id} nodes={board.nodes} edges={board.edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onInit={homeView} onNodeDragStart={state.beginDrag}
            minZoom={.28} maxZoom={1.8} panOnDrag={tool === 'hand' ? true : [1, 2]} selectionOnDrag={tool === 'select'} nodesDraggable={tool !== 'hand'} nodesConnectable={tool === 'connect'} elementsSelectable={tool !== 'hand'} zoomOnDoubleClick={false}
            deleteKeyCode={null} proOptions={{ hideAttribution: true }} defaultEdgeOptions={{ style: { stroke: '#839078', strokeWidth: 1.5 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#839078', width: 13, height: 13 } }}
            onPaneClick={() => setMenu(null)}><Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#dddcd5" /></ReactFlow>
        </CardActions.Provider>
        <nav className="tool-rail" aria-label="白板工具">
          <button title="选择 · V" aria-label="选择" className={tool === 'select' ? 'active' : ''} onClick={() => setTool('select')}><MousePointer2 size={20} fill={tool === 'select' ? 'currentColor' : 'none'} /></button>
          <button title="移动画布 · H" aria-label="移动画布" className={tool === 'hand' ? 'active' : ''} onClick={() => setTool('hand')}><Hand size={20} /></button>
          <span className="rail-divider" />
          <div className="tool-add"><button title="新增想法 · N" aria-label="新增想法" onClick={() => setMenu(menu==='add'?null:'add')}><Plus size={21} /></button>{menu==='add'&&<div className="dropdown add-menu"><button onClick={()=>newNode()}>想法便签</button><button onClick={()=>newNode(undefined,undefined,'flow')}>流程图</button><button onClick={()=>newNode(undefined,undefined,'prototype')}>交互原型</button><button onClick={()=>{setNewKind('art');setMenu(null);imageInput.current?.click();}}>艺术参考</button></div>}</div>
          <button title="放入图片" aria-label="放入图片" onClick={() => {setNewKind('image');imageInput.current?.click();}}><ImageIcon size={20} /></button>
          <span className="rail-divider" />
          <button title="连接想法" aria-label="连接想法" className={tool === 'connect' ? 'active' : ''} onClick={() => setTool(tool === 'connect' ? 'select' : 'connect')}><Link2 size={21} /></button>
        </nav>
        <input ref={imageInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={e => { uploadImage(e.target.files?.[0]); e.target.value = ''; }} />
        <input ref={importInput} type="file" accept="application/json,.json" className="hidden" onChange={e=>{const file=e.target.files?.[0];if(file){void file.text().then(async text=>{const b=JSON.parse(text);const {api}=await import('./useBoard');const imported=await api<{board:typeof board}>('/api/boards','POST',{board:{...b,id:crypto.randomUUID(),example:false,title:`${b.title||'导入白板'} · 导入`}});await state.openBoard(imported.board.id);await state.refreshList();announce('白板已导入');}).catch(e=>state.setError(e.message));}e.target.value='';}}/>
        <div className="board-breadcrumb"><button onClick={() => setSelectedId(undefined)}>主板</button><ChevronRight size={14} /><span>{selectedNode?.data.title || board.title}</span></div>
        <div className="zoom-controls"><button aria-label="缩小" onClick={() => flow.zoomOut({ duration: 150 })}><Minus size={17} /></button><button className="zoom-label" title="回到初始视图" onClick={homeView}>{Math.round(viewport.zoom * 100)}%</button><button aria-label="放大" onClick={() => flow.zoomIn({ duration: 150 })}><Plus size={17} /></button><span /><button aria-label="查看全部" onClick={() => flow.fitView({ padding: .1, duration: 200 })}><Maximize size={15} /></button></div>
        <button className="mobile-discuss" aria-label="打开讨论" onClick={() => setMobilePanel(true)}><MessageCircle size={20} /></button>
      </div>
      <SidePanel key={board.id} node={selectedNode} messages={board.messages} nodes={board.nodes} busy={state.busy} onDetails={setDetailId} onAdopt={card=>newNode(undefined,undefined,card.kind,card)} onBack={() => setSelectedId(undefined)} onPin={pin} onClose={() => setMobilePanel(false)} onSend={text=>{void state.discuss(text);}} />
    </main>
    {editingNode && <EditDialog node={editingNode} onClose={() => setEditingId(undefined)} onDelete={()=>{setBoard(b=>({...b,nodes:b.nodes.filter(n=>n.id!==editingNode.id),edges:b.edges.filter(e=>e.source!==editingNode.id&&e.target!==editingNode.id)}));setEditingId(undefined);announce('已移出白板，可在更多操作中撤销');}} onSave={(title, body, steps,prototype) => { setBoard(current => ({ ...current, nodes: current.nodes.map(node => node.id === editingNode.id ? { ...node, data: { ...node.data, title, body, steps,prototype } } : node) })); setEditingId(undefined); announce('想法已更新'); }} />}
    {exportFile && <ExportDialog file={exportFile} onClose={() => setExportFile(undefined)} onDownload={state.exportFiles} />}
    {projectDialog&&<ProjectDialog board={projectDialog==='edit'?board:undefined} onClose={()=>setProjectDialog(undefined)} onSave={async(title,goal,inspirations)=>{if(projectDialog==='new'){await state.create(title,goal,inspirations);setSelectedId(undefined);homeView();}else setBoard(b=>({...b,title,goal,inspirations,example:false}));}}/>}
    {preferencesDialog&&<PreferencesDialog onClose={()=>setPreferencesDialog(false)} load={state.getPreferences} onSave={state.setPreferences}/>}
    {detailId&&board.nodes.find(n=>n.id===detailId)&&<DetailDialog details={board.nodes.find(n=>n.id===detailId)!.data.details} onClose={()=>setDetailId(undefined)} onSave={details=>{setBoard(b=>({...b,nodes:b.nodes.map(n=>n.id===detailId?{...n,data:{...n.data,details}}:n)}));setDetailId(undefined);announce('下层内容已更新');}}/>}
    {state.error&&<div className="connection-error" role="alert">{state.error}{saveState==='未保存'&&<button onClick={()=>{void state.retrySave().catch(()=>{});}}>重试保存</button>}<button onClick={()=>state.setError('')}>收起</button></div>}
    {toast && <div className="toast" role="status">{toast}<button aria-label="关闭提示" onClick={() => setToast('')}><X size={13} /></button></div>}
  </div>;
}
