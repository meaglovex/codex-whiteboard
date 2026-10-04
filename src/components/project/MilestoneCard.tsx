import { createContext, useContext } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { ChevronRight } from 'lucide-react';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import StatusBadge from './StatusBadge';
import { useI18n } from '../../i18n';
import { statusLabel, type MilestoneNode } from '../../progressModel';

export const MilestoneActions = createContext({ select: (_id: string) => {} });
export default function MilestoneCard({ id, data }: NodeProps<MilestoneNode>) {
  const { select } = useContext(MilestoneActions);
  const { t, locale } = useI18n();
  return <article className="milestone-node" data-status={data.status} data-selected={data.selected} data-paper={data.number % 3 === 0 ? 'notebook' : data.number % 3 === 2 ? 'index' : 'plain'} data-testid={`milestone-${id}`}>
    <span className="evidence-pin" aria-hidden="true" />
    {[Position.Left, Position.Right, Position.Top, Position.Bottom].map(position => <div key={position}><Handle id={position} type="source" position={position} /><Handle id={position} type="target" position={position} /></div>)}
    <Button variant="ghost" className="milestone-hit nodrag nopan" onClick={() => select(id)} aria-label={t('milestoneSummary', { number: String(data.number).padStart(2, '0'), title: data.milestone.title, status: statusLabel(data.status, locale), done: data.done, total: data.total })} aria-pressed={data.selected}>
      <div className="milestone-title"><span>{String(data.number).padStart(2, '0')}</span><h3 title={data.milestone.title}>{data.milestone.title}</h3></div>
      <div className="milestone-statusline"><div className="milestone-count"><strong>{data.done} / {data.total}</strong><span>{t('completedItems')}</span></div><StatusBadge status={data.status} /></div>
      <Progress value={data.total ? data.done / data.total * 100 : 0} aria-label={t('milestoneCompletion', { title: data.milestone.title })} />
      <div className="milestone-next"><span>{data.next}</span><ChevronRight aria-hidden="true" /></div>
    </Button>
  </article>;
}
