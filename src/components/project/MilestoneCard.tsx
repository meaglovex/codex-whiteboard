import { createContext, useContext } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { ChevronRight } from 'lucide-react';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import StatusBadge from './StatusBadge';
import { statusLabels, type MilestoneNode } from '../../progressModel';

export const MilestoneActions = createContext({ select: (_id: string) => {} });
export default function MilestoneCard({ id, data }: NodeProps<MilestoneNode>) {
  const { select } = useContext(MilestoneActions);
  return <article className="milestone-node" data-status={data.status} data-selected={data.selected} data-paper={data.number % 3 === 0 ? 'notebook' : data.number % 3 === 2 ? 'index' : 'plain'} data-testid={`milestone-${id}`}>
    <span className="evidence-pin" aria-hidden="true" />
    {[Position.Left, Position.Right, Position.Top, Position.Bottom].map(position => <div key={position}><Handle id={position} type="source" position={position} /><Handle id={position} type="target" position={position} /></div>)}
    <Button variant="ghost" className="milestone-hit nodrag nopan" onClick={() => select(id)} aria-label={`${String(data.number).padStart(2, '0')} ${data.milestone.title}，${statusLabels[data.status]}，${data.done}/${data.total} 项完成`} aria-pressed={data.selected}>
      <div className="milestone-title"><span>{String(data.number).padStart(2, '0')}</span><h3 title={data.milestone.title}>{data.milestone.title}</h3></div>
      <div className="milestone-statusline"><div className="milestone-count"><strong>{data.done} / {data.total}</strong><span>项已完成</span></div><StatusBadge status={data.status} /></div>
      <Progress value={data.total ? data.done / data.total * 100 : 0} aria-label={`${data.milestone.title}任务完成度`} />
      <div className="milestone-next"><span>{data.next}</span><ChevronRight aria-hidden="true" /></div>
    </Button>
  </article>;
}
