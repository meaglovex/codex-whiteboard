import { useState } from 'react';
import { ArrowLeft, ArrowUp, ChevronDown, ChevronRight, Pin, X } from 'lucide-react';
import type { BoardNode, Detail, Message } from '../model';

function DetailBranch({ detail, level = 0 }: { detail: Detail; level?: number }) {
  const [open, setOpen] = useState(false);
  return <div className={`detail-branch level-${level}`}>
    <button className="branch-title" aria-expanded={open} onClick={() => setOpen(!open)}><span>{detail.title}</span>{open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</button>
    {open && <div className="branch-body"><p>{detail.body}</p>{detail.children?.map(child => <DetailBranch key={child.id} detail={child} level={level + 1} />)}</div>}
  </div>;
}

export default function SidePanel({ node, messages, onBack, onPin, onSend, onClose }: { node?: BoardNode; messages: Message[]; onBack: () => void; onPin: (id: string) => void; onSend: (text: string) => void; onClose: () => void }) {
  const [text, setText] = useState('');
  const submit = () => { if (text.trim()) { onSend(text.trim()); setText(''); } };
  return <aside className="side-panel">
    <div className="panel-header"><h2>{node ? '展开这一层' : '一起想清楚'}</h2><button className="icon-button mobile-close" aria-label="收起讨论" onClick={onClose}><X size={18} /></button></div>
    {node ? <div className="details-panel"><button className="back-button" onClick={onBack}><ArrowLeft size={15} />返回讨论</button><h3>{node.data.title}</h3><p className="detail-intro">{node.data.body || '从主板上的共识，继续走进细节。'}</p><button className={`pin-detail ${node.data.pinned ? 'active' : ''}`} onClick={() => onPin(node.id)}><Pin size={14} />{node.data.pinned ? '已钉住 · 点击继续讨论' : '把这个想法钉住'}</button><div className="detail-list">{node.data.details.map(d => <DetailBranch key={d.id} detail={d} />)}</div></div> : <>
      <div className="messages">{messages.map(message => <div key={message.id} className={`message ${message.role}`}><span className="avatar">{message.role === 'ai' ? 'AI' : '我'}</span><p>{message.text}</p></div>)}</div>
      <form className="composer" onSubmit={e => { e.preventDefault(); submit(); }}><textarea aria-label="讨论内容" placeholder="说说你的想法…" value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }} /><button aria-label="加入讨论" type="submit" disabled={!text.trim()}><ArrowUp size={21} /></button></form>
    </>}
  </aside>;
}
