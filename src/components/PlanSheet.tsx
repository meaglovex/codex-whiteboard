import { useState } from 'react';
import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { FileText, Save } from 'lucide-react';
import type { BoardPlan } from '../model';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from './ui/sheet';
import { Button } from './ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from './ui/empty';
import { Alert, AlertDescription } from './ui/alert';

const plugins = [remarkGfm];
const components: Components = {
  // Plan documents are content: never execute HTML or fetch embedded remote images.
  img: ({ alt }) => <span className="plan-image-caption">{alt ? `图片：${alt}` : '图片附件'}</span>,
  a: ({ href, children }) => href && /^https?:\/\//i.test(href)
    ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
    : <span title={href}>{children}</span>,
  table: ({ children }) => <div className="plan-table-scroll"><table>{children}</table></div>,
};

export default function PlanSheet({ plan, open, onOpenChange, onSave }: {
  plan?: BoardPlan; open: boolean; onOpenChange: (open: boolean) => void;
  onSave: () => Promise<{ plan?: string }>;
}) {
  const [saving, setSaving] = useState(false);
  const [receipt, setReceipt] = useState('');
  const [failed, setFailed] = useState(false);
  const save = async () => {
    setSaving(true); setReceipt(''); setFailed(false);
    try { const files = await onSave(); if (!files.plan) throw new Error('计划尚未同步，请重新打开后再试。'); setReceipt(`plan.md 已保存\n${files.plan}`); }
    catch (error) { setFailed(true); setReceipt((error as Error).message); }
    finally { setSaving(false); }
  };
  return <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent className="evidence-details plan-sheet">
      <SheetHeader><SheetTitle>{plan?.title || '开发计划'}</SheetTitle><SheetDescription>{plan
        ? `plan.md · 同步于 ${new Date(plan.updatedAt).toLocaleString('zh-CN', { hour12: false })}`
        : '构思确定后，在这里查看具体的实施步骤。'}</SheetDescription></SheetHeader>
      {plan ? <>
        <div className="plan-actions"><Button variant="outline" size="sm" disabled={saving} onClick={() => void save()}><Save data-icon="inline-start" />{saving ? '正在保存…' : '保存 plan.md'}</Button>
          {plan.sourcePath && <span title={plan.sourcePath}>来源：{plan.sourcePath.split(/[\\/]/).pop()}</span>}
        </div>
        {receipt && <Alert className="plan-receipt" variant={failed ? 'destructive' : 'default'}><AlertDescription>{receipt}</AlertDescription></Alert>}
        <article className="plan-document" aria-label="计划正文"><Markdown remarkPlugins={plugins} components={components} skipHtml>{plan.markdown}</Markdown></article>
      </> : <Empty className="plan-empty"><EmptyHeader><EmptyMedia variant="icon"><FileText /></EmptyMedia><EmptyTitle>尚未生成计划</EmptyTitle><EmptyDescription>在 Codex 中说“把这些想法整理成开发计划”。生成并同步后，计划就会显示在这里。</EmptyDescription></EmptyHeader></Empty>}
    </SheetContent>
  </Sheet>;
}
