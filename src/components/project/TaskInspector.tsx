import { useState } from 'react';
import { ChevronRight, FileCheck2, History, ListChecks } from 'lucide-react';
import { Button } from '../ui/button';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import StatusBadge from './StatusBadge';
import { useI18n } from '../../i18n';
import { statusLabel, type MilestoneSummary, type ProjectProgress } from '../../progressModel';

export default function TaskInspector({ item, progress }: { item: MilestoneSummary; progress: ProjectProgress }) {
  const { t, locale, formatDate } = useI18n();
  const [selectedTaskId, setSelectedTaskId] = useState<string>();
  const task = item.tasks.find(entry => entry.id === selectedTaskId)
    || item.tasks.find(entry => ['in_progress', 'blocked', 'review'].includes(entry.status)) || item.tasks[0];
  return <aside className="project-inspector" aria-label={t('taskDetailsFor', { title: item.milestone.title })}>
    <header className="inspector-heading"><div><span>{String(item.number).padStart(2, '0')}</span><h2>{item.milestone.title}</h2></div><StatusBadge status={item.status} /><p>{item.milestone.description || item.next}</p></header>
    <section className="inspector-section"><h3><ListChecks aria-hidden="true" />{t('taskList')} <span>{item.done} / {item.total}</span></h3>
      {item.tasks.length ? <div className="project-task-list">{item.tasks.map(entry => <Button key={entry.id} variant="ghost" className="project-task-row" data-selected={entry.id === task?.id} onClick={() => setSelectedTaskId(entry.id)} aria-pressed={entry.id === task?.id}>
        <span className="task-status-dot" data-status={entry.status} /><span className="task-title">{entry.title}</span><small>{statusLabel(entry.status, locale)}</small><ChevronRight aria-hidden="true" />
      </Button>)}</div> : <p className="project-empty-copy">{t('noStageTasks')}</p>}
    </section>
    {task && <section className="inspector-section selected-task" aria-label={t('currentTask')}>
      <h3>{task.title}</h3>
      {task.description && <p>{task.description}</p>}
      {['blocked', 'cancelled'].includes(task.status) && <Alert variant={task.status === 'blocked' ? 'destructive' : 'default'}><AlertTitle>{t(task.status === 'blocked' ? 'currentBlocker' : 'scopeChange')}</AlertTitle><AlertDescription>{task.blocker}</AlertDescription></Alert>}
      {!!task.dependsOn.length && <p className="task-dependencies">{t('taskPrerequisites', { tasks: task.dependsOn.map(id => progress.tasks.find(entry => entry.id === id)?.title || id).join(', ') })}</p>}
      <h4>{t('acceptance')}</h4><p>{task.acceptance}</p>
      {task.note && <p className="task-note">{task.note}</p>}
      <h4><FileCheck2 aria-hidden="true" />{t('evidence')} <span>{task.evidence.length}</span></h4>
      {task.evidence.length ? <Accordion className="evidence-records">{task.evidence.map(evidence => <AccordionItem key={evidence.id} value={evidence.id}>
        <AccordionTrigger><span>{evidence.label}<small>{t('evidence.' + evidence.kind)} · {t('result.' + evidence.result)}</small></span></AccordionTrigger>
        <AccordionContent><code>{evidence.reference}</code>{evidence.detail && <p>{evidence.detail}</p>}</AccordionContent>
      </AccordionItem>)}</Accordion> : <p className="project-empty-copy">{t('noAcceptanceEvidence')}</p>}
    </section>}
    <section className="inspector-section project-activity"><h3><History aria-hidden="true" />{t('recentProgress')}</h3>
      <ol>{progress.events.slice(-5).reverse().map(event => <li key={event.id}><p>{event.summary}</p><time dateTime={event.at}>{formatDate(event.at, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</time></li>)}</ol>
    </section>
  </aside>;
}
