import { useState } from 'react';
import { X } from 'lucide-react';
import type { BoardNode,Card } from '../model';

export default function EditDialog({ node, onSave, onClose, onDelete }: { node: BoardNode; onSave: (title: string, body: string, steps?: { title: string; sub: string }[],prototype?:Card['prototype']) => void; onClose: () => void;onDelete:()=>void }) {
  const [title, setTitle] = useState(node.data.title);
  const [body, setBody] = useState(node.data.body);
  const [steps, setSteps] = useState(node.data.steps);
  const [prototype,setPrototype]=useState(node.data.kind==='prototype'?node.data.prototype||{screenTitle:'今天，留下什么？',actionLabel:'记下这一刻',placeholder:'拍一张照片，写一段话，或只记录一个瞬间…',successText:'片刻，已经留下。'}:undefined);
  return <div className="dialog-backdrop" onClick={onClose}><section className="edit-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title" onClick={e => e.stopPropagation()}>
    <div className="dialog-heading"><h2 id="dialog-title">把想法写清楚</h2><button className="icon-button" aria-label="关闭编辑" onClick={onClose}><X size={19} /></button></div>
    <form onSubmit={e => { e.preventDefault(); if (title.trim()) onSave(title.trim(), body.trim(), steps,prototype); }}>
      <label>核心判断<input autoFocus value={title} maxLength={80} onChange={e => setTitle(e.target.value)} required /></label>
      <label>补充说明<textarea value={body} maxLength={600} onChange={e => setBody(e.target.value)} rows={4} /></label>
      {steps?.map((step, index) => <label key={index}>流程步骤 {index + 1}<input aria-label={`流程步骤 ${index + 1}`} value={step.title} maxLength={10} onChange={e => setSteps(steps.map((item, i) => i === index ? { ...item, title: e.target.value } : item))} /></label>)}
      {prototype&&(['screenTitle','actionLabel','placeholder','successText'] as const).map((key,i)=><label key={key}>{['原型标题','主动作','输入提示','完成反馈'][i]}<input value={prototype[key]} maxLength={key==='placeholder'?200:key==='actionLabel'?40:100} onChange={e=>setPrototype({...prototype,[key]:e.target.value})}/></label>)}
      <div className="dialog-actions"><button className="delete-node" type="button" onClick={onDelete}>移出白板</button><button type="button" onClick={onClose}>暂时保留</button><button className="primary-button" type="submit">保存想法</button></div>
    </form>
  </section></div>;
}
