import { useEffect,useRef,useState } from 'react';
import { ArrowLeft, ArrowUp, ChevronDown, ChevronRight, Pin, X } from 'lucide-react';
import type { BoardNode, Card, Detail, Message } from '../model';

function DetailBranch({ detail, level = 0 }: { detail: Detail; level?: number }) {
  const [open, setOpen] = useState(false);
  return <div className={`detail-branch level-${level}`}>
    <button className="branch-title" aria-expanded={open} onClick={() => setOpen(!open)}><span>{detail.title}</span>{open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</button>
    {open && <div className="branch-body"><p>{detail.body}</p>{detail.children?.map(child => <DetailBranch key={child.id} detail={child} level={level + 1} />)}</div>}
  </div>;
}

export default function SidePanel({ node, messages, nodes, busy, onDetails, onAdopt, onBack, onPin, onSend, onClose }: { node?: BoardNode; messages: Message[]; nodes:BoardNode[]; busy:boolean;onDetails:(id:string)=>void;onAdopt:(card:Card)=>void;onBack: () => void; onPin: (id: string) => void; onSend: (text: string) => void; onClose: () => void }) {
  const [text, setText] = useState('');
  const bottom=useRef<HTMLDivElement>(null);useEffect(()=>{bottom.current?.scrollIntoView({block:'end'});},[messages.length,busy,node?.id]);
  const submit = () => { if (text.trim()) { onSend(text.trim()); setText(''); } };
  return <aside className="side-panel">
    <div className="panel-header"><h2>{node ? '展开这一层' : '一起想清楚'}</h2><button className="icon-button mobile-close" aria-label="收起讨论" onClick={onClose}><X size={18} /></button></div>
    {node ? <div className="details-panel"><button className="back-button" onClick={onBack}><ArrowLeft size={15} />返回讨论</button><h3>{node.data.title}</h3><p className="detail-intro">{node.data.body || '从主板上的共识，继续走进细节。'}</p><button className={`pin-detail ${node.data.pinned ? 'active' : ''}`} onClick={() => onPin(node.id)}><Pin size={14} />{node.data.pinned ? '已钉住 · 点击继续讨论' : '把这个想法钉住'}</button><button className="edit-details" onClick={()=>onDetails(node.id)}>编辑下层内容</button><div className="detail-list">{node.data.details.map(d => <DetailBranch key={d.id} detail={d} />)}</div></div> : <>
      <div className="messages">{messages.map(message => <div key={message.id} className={`message ${message.role}`}><span className="avatar">{message.role === 'ai' ? 'AI' : '我'}</span><div className="message-content"><p>{message.text}</p>{message.suggestions?.map((card,index)=>{const proposalId=`${message.id}:${index}`,adopted=nodes.some(n=>n.data.proposalId===proposalId);return <div className="proposal" key={proposalId}><strong>{card.title}</strong><span>{card.body}</span><div><button disabled={adopted} onClick={()=>onAdopt({...card,proposalId})}>{adopted?'已在白板上':'放到白板'}</button><button onClick={()=>setText(`我想反驳「${card.title}」：`)}>反驳这点</button></div></div>;})}</div></div>)}{busy&&<div className="thinking">正在推敲这轮想法…</div>}{!messages.length&&<div className="discussion-empty">说说你想融合哪些产品体验，或者直接提出一个需要辩论的想法。</div>}<div ref={bottom}/></div>
      <form className="composer" onSubmit={e => { e.preventDefault(); if(!busy)submit(); }}><textarea aria-label="讨论内容" placeholder="说说你的想法…" value={text} maxLength={6000} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey&&!e.nativeEvent.isComposing) { e.preventDefault(); if(!busy)submit(); } }} /><button aria-label="加入讨论" type="submit" disabled={!text.trim()||busy}><ArrowUp size={21} /></button></form>
    </>}
  </aside>;
}
