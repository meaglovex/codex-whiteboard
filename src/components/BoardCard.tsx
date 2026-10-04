import { createContext, useContext, useId, useState, type CSSProperties } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { assetImage, defaultFlowSteps, type Card as CardData } from '../model';
import type { EvidenceNode } from '../evidenceLayout';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Field, FieldGroup, FieldLabel } from './ui/field';
import { Textarea } from './ui/textarea';
import { cn } from '../lib/utils';

export const CardActions = createContext({ open: (_id: string) => {}, updatedIds: [] as string[] });
function Prototype({ config }: { config?: CardData['prototype'] }) {
  const [mode, setMode] = useState<'home' | 'write' | 'saved'>('home');
  const [text, setText] = useState('');
  const inputId = useId();
  return <div className="prototype-preview nodrag nopan">
    <h3>{mode === 'saved' ? config?.successText || '片刻，已经留下。' : config?.screenTitle || '今天，留下什么？'}</h3>
    {mode === 'write' ? <FieldGroup><Field><FieldLabel htmlFor={inputId}>留下这一刻</FieldLabel><Textarea id={inputId} placeholder={config?.placeholder || '写下这一刻…'} value={text} onChange={e => setText(e.target.value)} autoFocus /></Field></FieldGroup> : <p>{mode === 'saved' ? text : config?.placeholder || '拍一张照片，或写一句话。'}</p>}
    <Button onClick={() => setMode(mode === 'home' ? 'write' : mode === 'write' ? 'saved' : 'home')} disabled={mode === 'write' && !text.trim()}>{mode === 'home' ? config?.actionLabel || '记下这一刻' : mode === 'write' ? '确认提交' : '再试一次'}</Button>
  </div>;
}

export default function BoardCard({ id, data }: NodeProps<EvidenceNode>) {
  const { open, updatedIds } = useContext(CardActions);
  const labels = { idea: '核心想法', image: '视觉方向', flow: '主流程', prototype: '关键交互', art: '艺术参考' };
  return <article className={cn('presentation-card', data.kind === 'flow' && 'flow-card', !!data.image && 'photo-card', updatedIds.includes(id) && 'update-flash')} data-paper={data.paper} data-testid={`card-${id}`} style={{ '--paper-tilt': `${data.tilt}deg` } as CSSProperties}>
    <Handle id="left" type="target" position={Position.Left} /><Handle id="top" type="target" position={Position.Top} /><Handle id="right" type="source" position={Position.Right} /><Handle id="bottom" type="source" position={Position.Bottom} />
    <span className="evidence-pin" aria-hidden="true" />
    <Card>
      <CardHeader><CardDescription className="card-kind">{labels[data.kind]}</CardDescription><CardTitle>{data.title}</CardTitle></CardHeader>
      {!!data.image && <img className="reference-image" src={assetImage(data.image)} alt={data.title} draggable={false} />}
      <CardContent>
        {!!data.body && <p className="card-summary">{data.body}</p>}
        {data.kind === 'flow' && <div className="flow-strip">{(data.steps || defaultFlowSteps).map((step, i) => <div className="contents" key={i}>{i > 0 && <ArrowRight aria-hidden="true" />}<div className="flow-item"><b>{step.title}</b><small>{step.sub}</small></div></div>)}</div>}
        {data.kind === 'prototype' && <Prototype config={data.prototype} />}
      </CardContent>
      <CardFooter><Button className="view-details nodrag nopan" variant="ghost" size="sm" aria-label={`查看依据：${data.title}`} onClick={() => open(id)}>查看依据{data.details.length ? ` · ${data.details.length}` : ''}<ArrowUpRight data-icon="inline-end" /></Button><Badge className="consensus-stamp" variant="outline" data-confirmed={data.pinned}>{data.pinned ? '已形成共识' : '讨论中'}</Badge></CardFooter>
    </Card>
  </article>;
}
