import { useState } from 'react';
import { X } from 'lucide-react';
import type { BoardNode } from '../model';

export default function EditDialog({ node, onSave, onClose }: { node: BoardNode; onSave: (title: string, body: string, steps?: { title: string; sub: string }[]) => void; onClose: () => void }) {
  const [title, setTitle] = useState(node.data.title);
  const [body, setBody] = useState(node.data.body);
  const [steps, setSteps] = useState(node.data.steps);
  return <div className="dialog-backdrop" onClick={onClose}><section className="edit-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title" onClick={e => e.stopPropagation()}>
    <div className="dialog-heading"><h2 id="dialog-title">把想法写清楚</h2><button className="icon-button" aria-label="关闭编辑" onClick={onClose}><X size={19} /></button></div>
    <form onSubmit={e => { e.preventDefault(); if (title.trim()) onSave(title.trim(), body.trim(), steps); }}>
      <label>核心判断<input autoFocus value={title} maxLength={80} onChange={e => setTitle(e.target.value)} required /></label>
      <label>补充说明<textarea value={body} maxLength={600} onChange={e => setBody(e.target.value)} rows={4} /></label>
      {steps?.map((step, index) => <label key={index}>流程步骤 {index + 1}<input aria-label={`流程步骤 ${index + 1}`} value={step.title} maxLength={10} onChange={e => setSteps(steps.map((item, i) => i === index ? { ...item, title: e.target.value } : item))} /></label>)}
      <div className="dialog-actions"><button type="button" onClick={onClose}>暂时保留</button><button className="primary-button" type="submit">保存想法</button></div>
    </form>
  </section></div>;
}
