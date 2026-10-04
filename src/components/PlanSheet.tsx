import { useMemo, useState } from 'react';
import { useI18n } from '../i18n';
import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { FileText, Save } from 'lucide-react';
import type { BoardPlan } from '../model';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from './ui/sheet';
import { Button } from './ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from './ui/empty';
import { Alert, AlertDescription } from './ui/alert';

const plugins = [remarkGfm];
const componentsFor = (t: ReturnType<typeof useI18n>['t']): Components => ({
  // Plan documents are content: never execute HTML or fetch embedded remote images.
  img: ({ alt }) => <span className="plan-image-caption">{alt ? t('imageCaption', { alt }) : t('imageAttachment')}</span>,
  a: ({ href, children }) => href && /^https?:\/\//i.test(href)
    ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
    : <span title={href}>{children}</span>,
  table: ({ children }) => <div className="plan-table-scroll"><table>{children}</table></div>,
});

export default function PlanSheet({ plan, open, onOpenChange, onSave }: {
  plan?: BoardPlan; open: boolean; onOpenChange: (open: boolean) => void;
  onSave: () => Promise<{ plan?: string }>;
}) {
  const { t, formatDate, errorText } = useI18n();
  const components = useMemo(() => componentsFor(t), [t]);
  const [saving, setSaving] = useState(false);
  const [receipt, setReceipt] = useState('');
  const [failed, setFailed] = useState(false);
  const save = async () => {
    setSaving(true); setReceipt(''); setFailed(false);
    try { const files = await onSave(); if (!files.plan) throw new Error('计划尚未同步，请重新打开后再试。'); setReceipt(files.plan); }
    catch (error) { setFailed(true); setReceipt((error as Error).message); }
    finally { setSaving(false); }
  };
  return <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent className="evidence-details plan-sheet">
      <SheetHeader><SheetTitle>{plan?.title || t('planTitle')}</SheetTitle><SheetDescription>{plan
        ? t('planSynced', { time: formatDate(plan.updatedAt, { dateStyle: 'short', timeStyle: 'medium' }) })
        : t('planIntro')}</SheetDescription></SheetHeader>
      {plan ? <>
        <div className="plan-actions"><Button variant="outline" size="sm" disabled={saving} onClick={() => void save()}><Save data-icon="inline-start" />{t(saving ? 'saving' : 'savePlan')}</Button>
          {plan.sourcePath && <span title={plan.sourcePath}>{t('source', { name: plan.sourcePath.split(/[\\/]/).pop() || plan.sourcePath })}</span>}
        </div>
        {receipt && <Alert className="plan-receipt" variant={failed ? 'destructive' : 'default'}><AlertDescription>{failed ? errorText(receipt) : `${t('planSaved')}\n${receipt}`}</AlertDescription></Alert>}
        <article className="plan-document" aria-label={t('planBody')}><Markdown remarkPlugins={plugins} components={components} skipHtml>{plan.markdown}</Markdown></article>
      </> : <Empty className="plan-empty"><EmptyHeader><EmptyMedia variant="icon"><FileText /></EmptyMedia><EmptyTitle>{t('noPlan')}</EmptyTitle><EmptyDescription>{t('noPlanHelp')}</EmptyDescription></EmptyHeader></Empty>}
    </SheetContent>
  </Sheet>;
}
