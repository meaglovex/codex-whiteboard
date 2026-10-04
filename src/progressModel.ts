import type { Edge, Node } from '@xyflow/react';

export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'blocked' | 'done' | 'cancelled';
export type MilestoneStatus = TaskStatus | 'locked';
export type Evidence = { id: string; kind: 'test' | 'artifact' | 'commit' | 'review' | 'record'; label: string; reference: string; result: 'passed' | 'failed' | 'info'; detail: string };
export type Milestone = { id: string; title: string; description: string; dependsOn: string[] };
export type ProjectTask = { id: string; milestoneId: string; title: string; description: string; acceptance: string; status: TaskStatus; dependsOn: string[]; blocker: string; note: string; evidence: Evidence[]; updatedAt: string };
export type ProgressEvent = { id: string; at: string; summary: string; changes: { taskId: string; title: string; from?: TaskStatus; to: TaskStatus }[] };
export type ProjectProgress = { milestones: Milestone[]; tasks: ProjectTask[]; summary: string; updatedAt: string; events: ProgressEvent[]; receipts: { id: string; hash: string }[] };
export type MilestoneSummary = { milestone: Milestone; tasks: ProjectTask[]; status: MilestoneStatus; done: number; total: number; next: string; number: number };
export type MilestoneNode = Node<MilestoneSummary & { selected: boolean; compact: boolean }, 'milestone'>;
export const statusLabels: Record<MilestoneStatus, string> = { todo: '未开始', in_progress: '进行中', review: '待验收', blocked: '受阻', done: '已完成', locked: '待解锁', cancelled: '已取消' };
const priority: Record<TaskStatus, number> = { in_progress: 0, blocked: 1, review: 2, todo: 3, done: 4, cancelled: 5 };

export function taskCounts(tasks: ProjectTask[]) {
  const included = tasks.filter(task => task.status !== 'cancelled');
  const done = included.filter(task => task.status === 'done').length;
  return { total: included.length, done, blocked: included.filter(task => task.status === 'blocked').length, active: included.filter(task => task.status === 'in_progress').length, review: included.filter(task => task.status === 'review').length, ratio: included.length ? done / included.length : 0 };
}
export function orderedMilestones(milestones: Milestone[]) {
  const result: Milestone[] = [], seen = new Set<string>();
  const lookup = new Map(milestones.map(item => [item.id, item]));
  function visit(item: Milestone) {
    if (seen.has(item.id)) return;
    seen.add(item.id);
    item.dependsOn.forEach(id => { const parent = lookup.get(id); if (parent) visit(parent); });
    result.push(item);
  }
  milestones.forEach(visit);
  return result;
}
export function milestoneSummaries(progress: ProjectProgress): MilestoneSummary[] {
  const statuses = new Map<string, MilestoneStatus>();
  return orderedMilestones(progress.milestones).map((milestone, index) => {
    const tasks = progress.tasks.filter(task => task.milestoneId === milestone.id);
    const included = tasks.filter(task => task.status !== 'cancelled');
    const { done, total } = taskCounts(tasks);
    const dependencyOpen = milestone.dependsOn.every(id => statuses.get(id) === 'done');
    let status: MilestoneStatus = 'todo';
    if (included.some(task => task.status === 'blocked')) status = 'blocked';
    else if (included.some(task => task.status === 'in_progress')) status = 'in_progress';
    else if (included.some(task => task.status === 'review')) status = 'review';
    else if (total > 0 && done === total) status = 'done';
    else if (tasks.length && !total) status = 'cancelled';
    else if (!dependencyOpen) status = 'locked';
    statuses.set(milestone.id, status);
    const nextTask = [...included].filter(task => task.status !== 'done').sort((a, b) => priority[a.status] - priority[b.status])[0];
    const prerequisite = progress.milestones.find(item => milestone.dependsOn.includes(item.id) && statuses.get(item.id) !== 'done');
    const next = status === 'locked' && prerequisite ? `前置：${prerequisite.title}` : nextTask ? (nextTask.status === 'blocked' ? nextTask.blocker : nextTask.title) : total ? milestone.description || '本阶段任务已完成' : '尚未拆分任务';
    return { milestone, tasks, status, done, total, next, number: index + 1 };
  });
}
export function currentMilestone(items: MilestoneSummary[]) {
  return items.find(item => item.status === 'in_progress') || items.find(item => item.status === 'blocked') || items.find(item => item.status === 'review') || items.find(item => item.status === 'todo') || items.find(item => item.status === 'locked') || items.at(-1);
}
export function progressGraph(items: MilestoneSummary[], compact: boolean, selectedId?: string): { nodes: MilestoneNode[]; edges: Edge[] } {
  const nodes = items.map((item, index): MilestoneNode => {
    const row = Math.floor(index / 3), col = row % 2 ? 2 - index % 3 : index % 3;
    const height = item.milestone.title.length > 8 ? 280 : 244;
    return { id: item.milestone.id, type: 'milestone', position: compact ? { x: 0, y: index * 304 } : { x: col * 370, y: row * 350 }, width: compact ? 330 : 300, height, style: { width: compact ? 330 : 300, height }, data: { ...item, compact, selected: item.milestone.id === selectedId }, draggable: false, selectable: false, focusable: false };
  });
  const positions = new Map(nodes.map(node => [node.id, node.position]));
  const edges: Edge[] = [];
  for (const item of items) for (const parentId of item.milestone.dependsOn) {
    const source = positions.get(parentId), target = positions.get(item.milestone.id);
    if (!source || !target) continue;
    const vertical = compact || source.y !== target.y;
    const forward = source.x < target.x;
    edges.push({ id: `${parentId}--${item.milestone.id}`, source: parentId, target: item.milestone.id, sourceHandle: vertical ? 'bottom' : forward ? 'right' : 'left', targetHandle: vertical ? 'top' : forward ? 'left' : 'right', type: 'smoothstep', className: `project-route route-${items.find(entry => entry.milestone.id === parentId)?.status === 'done' ? 'done' : 'future'}` });
  }
  return { nodes, edges };
}
