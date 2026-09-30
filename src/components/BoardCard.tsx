import { createContext, useContext, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { ArrowUpRight, BookOpen, Check, Image as ImageIcon, Layers, Mic, MoreHorizontal, Network, Pin, Smartphone, Text } from 'lucide-react';
import { assetImage, defaultFlowSteps, type BoardNode, type Card } from '../model';

export const CardActions = createContext({
  open: (_id: string) => {}, edit: (_id: string) => {}, pin: (_id: string) => {}, connecting: false,
});

function Prototype({ image, config }: { image?: string;config?:Card['prototype'] }) {
  const [mode, setMode] = useState<'home' | 'write' | 'saved'>('home');
  const [text, setText] = useState('');
  return <div className="phone nodrag nopan">
    <div className="phone-status"><span>9:41</span><span>▴▴▴ ▰</span></div>
    <div className="phone-content">
      <h3>{mode === 'saved' ? config?.successText||'片刻，已经留下。' : config?.screenTitle||'今天，留下什么？'}</h3>
      {mode === 'write' ? <textarea aria-label="原型输入" placeholder={config?.placeholder||'写下这一刻…'} value={text} onChange={e => setText(e.target.value)} autoFocus /> :
        <p>{mode === 'saved' ? text : config?.placeholder||<>拍一张照片，写一段话，<br />或只记录一个瞬间…</>}</p>}
      <button className="phone-cta" onClick={() => mode === 'home' ? setMode('write') : mode === 'write' && text.trim() ? setMode('saved') : mode === 'saved' ? setMode('home') : undefined}>{mode === 'home' ? config?.actionLabel||'记下这一刻' : mode === 'write' ? '确认提交' : '再试一次'}</button>
      <div className="phone-modes"><ImageIcon size={15} /><Text size={15} /><Mic size={15} /></div>
      {image&&<img src={assetImage(image)} alt="原型的视觉参考" />}
    </div>
  </div>;
}

export default function BoardCard({ id, data, selected }: NodeProps<BoardNode>) {
  const actions = useContext(CardActions);
  const labels = { idea: '核心想法', image: '视觉方向', flow: '主流程', prototype: '关键交互', art: '艺术参考' };
  const footer = data.kind === 'idea' ? `${data.details.length} 个细节` : data.kind === 'flow' ? `${data.details.length} 个分支` : data.kind === 'image' ? `视觉方向 · ${data.details.length} 个参考` : '点开试一试';
  return <article className={`board-card card-${data.kind} ${selected ? 'is-selected' : ''}`} data-testid={`card-${id}`} onDoubleClick={e => { if (!(e.target as HTMLElement).closest('button,textarea,input')) actions.edit(id); }}>
    <Handle id="left" type="target" position={Position.Left} style={data.kind === 'image' ? { top: '34%' } : undefined} className={actions.connecting ? 'show-handle' : ''} />
    <Handle id="top" type="target" position={Position.Top} className={actions.connecting ? 'show-handle' : ''} />
    <Handle id="right" type="source" position={Position.Right} className={actions.connecting ? 'show-handle' : ''} />
    <Handle id="bottom" type="source" position={Position.Bottom} className={actions.connecting ? 'show-handle' : ''} />
    {data.kind === 'image' || data.kind === 'art' ? <>
      <div className="media-wrap drag-handle"><img src={assetImage(data.image)} alt={data.title} draggable={false} />
        <button className="more media-more nodrag" aria-label={`编辑${data.title}`} onClick={() => actions.edit(id)}><MoreHorizontal size={19} /></button>
      </div>
      {data.kind === 'image' && <div className="image-caption"><h2>{data.title}</h2><button className="card-footer nodrag" onClick={() => actions.open(id)}>{footer} <ArrowUpRight size={15} /></button></div>}
      {data.kind === 'art' && <button className="art-open nodrag" aria-label="展开艺术参考" onClick={() => actions.open(id)}><ArrowUpRight size={16} /></button>}
    </> : <>
      <div className="card-head drag-handle">
        <span className="card-label">{data.kind === 'idea' ? <button className={`pin nodrag ${data.pinned ? 'pinned' : ''}`} aria-label={data.pinned ? '取消钉住核心想法' : '钉住核心想法'} onClick={() => actions.pin(id)}><Pin size={18} fill={data.pinned ? 'currentColor' : 'none'} /></button> : data.kind === 'flow' ? <Network size={20} /> : <Smartphone size={18} />}{data.kind === 'idea' ? labels[data.kind] : data.title}</span>
        <button className="more nodrag" aria-label={`编辑${data.title}`} onClick={() => actions.edit(id)}><MoreHorizontal size={19} /></button>
      </div>
      {data.kind === 'idea' && <div className="idea-content"><h2>{data.title}</h2><p>{data.body}</p></div>}
      {data.kind === 'flow' && <div className="flow-steps">
        {(data.steps || defaultFlowSteps).map((step, i) => { const StepIcon = [ImageIcon, Layers, BookOpen][i % 3]; return <div key={i} className={`flow-step step-${i}`}><StepIcon size={21} strokeWidth={1.7} /><strong>{step.title}</strong><span>{step.sub}</span></div>; })}
      </div>}
      {data.kind === 'prototype' && <Prototype image={data.image} config={data.prototype} />}
      <button className="card-footer nodrag" onClick={() => actions.open(id)}>{footer} <ArrowUpRight size={15} /></button>
    </>}
    {data.kind !== 'idea' && data.kind !== 'art' && <span className="sr-only">{data.pinned ? '已钉住' : '讨论中'}</span>}
  </article>;
}
