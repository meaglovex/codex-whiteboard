import { createHash } from 'node:crypto';
import { z } from 'zod';

const reference = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
const status = z.enum(['todo', 'in_progress', 'review', 'blocked', 'done', 'cancelled']);
export const evidenceSchema = z.object({
  id: reference,
  kind: z.enum(['test', 'artifact', 'commit', 'review', 'record']),
  label: z.string().min(1).max(200),
  reference: z.string().min(1).max(2000),
  result: z.enum(['passed', 'failed', 'info']),
  detail: z.string().max(4000).default(''),
}).strict();
export const milestoneSchema = z.object({
  id: reference, title: z.string().min(1).max(100),
  description: z.string().max(2000).default(''),
  dependsOn: z.array(reference).max(30).default([]),
}).strict();
export const taskSchema = z.object({
  id: reference, milestoneId: reference, title: z.string().min(1).max(200),
  description: z.string().max(4000).default(''),
  acceptance: z.string().min(1).max(3000),
  status: status.default('todo'),
  dependsOn: z.array(reference).max(100).default([]),
  blocker: z.string().max(3000).default(''),
  note: z.string().max(4000).default(''),
  evidence: z.array(evidenceSchema).max(60).default([]),
  updatedAt: z.string().datetime(),
}).strict();
const eventSchema = z.object({
  id: reference, at: z.string().datetime(), summary: z.string().min(1).max(2000),
  changes: z.array(z.object({ taskId: reference, title: z.string(), from: status.optional(), to: status })).max(300),
});
export const progressSchema = z.object({
  milestones: z.array(milestoneSchema).max(24),
  tasks: z.array(taskSchema).max(300),
  events: z.array(eventSchema).max(200),
  receipts: z.array(z.object({ id: reference, hash: z.string() })).max(2000),
  summary: z.string().min(1).max(2000),
  updatedAt: z.string().datetime(),
});
export const progressInputSchema = z.object({
  eventId: reference,
  summary: z.string().min(1).max(2000),
  phase: z.enum(['discovery', 'development']).optional(),
  projectPath: z.string().min(1).max(2000).optional(),
  milestones: z.array(z.object({ id: reference, title: z.string().min(1).max(100).optional(), description: z.string().max(2000).optional(), dependsOn: z.array(reference).max(30).optional() }).strict()).max(24).optional(),
  tasks: z.array(z.object({
    id: reference, milestoneId: reference.optional(), title: z.string().min(1).max(200).optional(),
    description: z.string().max(4000).optional(), acceptance: z.string().min(1).max(3000).optional(),
    status: status.optional(), dependsOn: z.array(reference).max(100).optional(),
    blocker: z.string().max(3000).optional(), note: z.string().max(4000).optional(),
    evidence: z.array(evidenceSchema).max(60).optional(),
  }).strict()).max(300).optional(),
}).strict();

function unique(items, kind) {
  if (new Set(items.map(item => item.id)).size !== items.length) throw new Error(`${kind} ID 重复`);
}
function validateGraph(items, kind) {
  unique(items, kind);
  const lookup = new Map(items.map(item => [item.id, item]));
  const visited = new Set(), visiting = new Set();
  const visit = id => {
    if (visiting.has(id)) throw new Error(`${kind}依赖存在循环`);
    if (visited.has(id)) return;
    const item = lookup.get(id);
    if (!item) throw new Error(`${kind}依赖指向不存在的 ID：${id}`);
    visiting.add(id);
    if (new Set(item.dependsOn).size !== item.dependsOn.length) throw new Error(`${kind}依赖重复`);
    for (const parent of item.dependsOn) visit(parent);
    visiting.delete(id); visited.add(id);
  };
  for (const id of lookup.keys()) visit(id);
}
export function validateProgress(value) {
  const progress = progressSchema.parse(value);
  validateGraph(progress.milestones, '里程碑');
  validateGraph(progress.tasks, '任务');
  const milestoneIds = new Set(progress.milestones.map(item => item.id));
  for (const task of progress.tasks) {
    if (!milestoneIds.has(task.milestoneId)) throw new Error(`任务所属里程碑不存在：${task.title}`);
    unique(task.evidence, '验收依据');
    if (task.status === 'done' && !task.evidence.some(item => item.result === 'passed')) throw new Error(`完成任务必须有通过的验收依据：${task.title}`);
    if (['blocked', 'cancelled'].includes(task.status) && !task.blocker.trim()) throw new Error(`受阻或取消任务必须说明原因：${task.title}`);
  }
  unique(progress.events, '进展事件');
  unique(progress.receipts, '同步回执');
  return progress;
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
function mergeById(previous, incoming) {
  const result = structuredClone(previous);
  for (const item of incoming) {
    const index = result.findIndex(entry => entry.id === item.id);
    if (index < 0) result.push(item);
    else result[index] = { ...result[index], ...item };
  }
  return result;
}

/** Partial updates operate on the latest snapshot; never replace unrelated tasks. */
export function applyProgress(board, raw, now = new Date().toISOString()) {
  const input = progressInputSchema.parse(raw);
  if (input.projectPath && !/^(\/|[A-Za-z]:[\\/])/.test(input.projectPath)) throw new Error('项目目录需要使用绝对路径');
  const hash = createHash('sha256').update(JSON.stringify(canonical(input))).digest('hex');
  const previous = board.progress;
  const receipt = previous?.receipts.find(item => item.id === input.eventId);
  if (receipt) {
    if (receipt.hash !== hash) throw new Error('同一事件 ID 已用于不同内容，请换用新的事件 ID');
    return null;
  }
  unique(input.milestones || [], '本次里程碑');
  unique(input.tasks || [], '本次任务');
  const changes = [];
  const tasks = (input.tasks || []).map(patch => {
    const old = previous?.tasks.find(item => item.id === patch.id);
    if (patch.status === 'done' && old?.status !== 'done' && !patch.evidence?.some(item => item.result === 'passed')) throw new Error('本次完成任务需要同时提交通过的验收依据');
    if (old?.status === 'done' && patch.status && patch.status !== 'done' && !patch.note?.trim()) throw new Error('重新打开已完成任务时需要在 note 说明原因');
    const merged = { ...old, ...patch, evidence: mergeById(old?.evidence || [], patch.evidence || []), updatedAt: now };
    if (!old || patch.status && old.status !== patch.status) changes.push({ taskId: patch.id, title: merged.title || patch.id, ...(old ? { from: old.status } : {}), to: merged.status || 'todo' });
    return merged;
  });
  const progress = validateProgress({
    milestones: mergeById(previous?.milestones || [], input.milestones || []),
    tasks: mergeById(previous?.tasks || [], tasks),
    events: [...(previous?.events || []), { id: input.eventId, at: now, summary: input.summary, changes }].slice(-200),
    receipts: [...(previous?.receipts || []), { id: input.eventId, hash }].slice(-2000),
    summary: input.summary, updatedAt: now,
  });
  if (!progress.milestones.length) throw new Error('进入开发阶段前，请先提供实际里程碑');
  return { ...board, phase: input.phase || 'development', ...(input.projectPath ? { projectPath: input.projectPath } : {}), progress };
}
