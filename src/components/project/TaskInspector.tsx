import { useState } from 'react';
import { ChevronRight, FileCheck2, History, ListChecks } from 'lucide-react';
import { Button } from '../ui/button';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import StatusBadge from './StatusBadge';
import { statusLabels, type MilestoneSummary, type ProjectProgress } from '../../progressModel';

const kinds = { test: '测试', artifact: '交付物', commit: '提交', review: '验收', record: '已有记录' };
const results = { passed: '通过', failed: '未通过', info: '记录' };
export default function TaskInspector({ item, progress }: { item: MilestoneSummary; progress: ProjectProgress }) {
  const [selectedTaskId, setSelectedTaskId] = useState<string>();
  const task = item.tasks.find(entry => entry.id === selectedTaskId)
    || item.tasks.find(entry => ['in_progress', 'blocked', 'review'].includes(entry.status)) || item.tasks[0];
  return <aside className="project-inspector" aria-label={`${item.milestone.title}任务详情`}>
    <header className="inspector-heading"><div><span>{String(item.number).padStart(2, '0')}</span><h2>{item.milestone.title}</h2></div><StatusBadge status={item.status} /><p>{item.milestone.description || item.next}</p></header>
    <section className="inspector-section"><h3><ListChecks aria-hidden="true" />任务清单 <span>{item.done} / {item.total}</span></h3>
      {item.tasks.length ? <div className="project-task-list">{item.tasks.map(entry => <Button key={entry.id} variant="ghost" className="project-task-row" data-selected={entry.id === task?.id} onClick={() => setSelectedTaskId(entry.id)} aria-pressed={entry.id === task?.id}>
        <span className="task-status-dot" data-status={entry.status} /><span className="task-title">{entry.title}</span><small>{statusLabels[entry.status]}</small><ChevronRight aria-hidden="true" />
      </Button>)}</div> : <p className="project-empty-copy">计划还没有拆分到这一阶段。</p>}
    </section>
    {task && <section className="inspector-section selected-task" aria-label="当前任务">
      <h3>{task.title}</h3>
      {task.description && <p>{task.description}</p>}
      {['blocked', 'cancelled'].includes(task.status) && <Alert variant={task.status === 'blocked' ? 'destructive' : 'default'}><AlertTitle>{task.status === 'blocked' ? '当前阻塞' : '范围调整'}</AlertTitle><AlertDescription>{task.blocker}</AlertDescription></Alert>}
      {!!task.dependsOn.length && <p className="task-dependencies">前置任务：{task.dependsOn.map(id => progress.tasks.find(entry => entry.id === id)?.title || id).join('、')}</p>}
      <h4>验收条件</h4><p>{task.acceptance}</p>
      {task.note && <p className="task-note">{task.note}</p>}
      <h4><FileCheck2 aria-hidden="true" />验收依据 <span>{task.evidence.length}</span></h4>
      {task.evidence.length ? <Accordion className="evidence-records">{task.evidence.map(evidence => <AccordionItem key={evidence.id} value={evidence.id}>
        <AccordionTrigger><span>{evidence.label}<small>{kinds[evidence.kind]} · {results[evidence.result]}</small></span></AccordionTrigger>
        <AccordionContent><code>{evidence.reference}</code>{evidence.detail && <p>{evidence.detail}</p>}</AccordionContent>
      </AccordionItem>)}</Accordion> : <p className="project-empty-copy">尚无验收记录。</p>}
    </section>}
    <section className="inspector-section project-activity"><h3><History aria-hidden="true" />最近进展</h3>
      <ol>{progress.events.slice(-5).reverse().map(event => <li key={event.id}><p>{event.summary}</p><time dateTime={event.at}>{new Date(event.at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })}</time></li>)}</ol>
    </section>
  </aside>;
}
