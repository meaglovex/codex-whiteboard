import { z } from 'zod';
import { progressSchema, validateProgress } from './progress.mjs';

const detail = z.lazy(() => z.object({ id: z.string().max(100), title: z.string().max(200), body: z.string().max(6000), children: z.array(detail).max(40).optional() }));
export const planInputSchema = z.object({ title:z.string().min(1).max(200).default('开发计划'), markdown:z.string().min(1).max(200000).refine(value=>!!value.trim(),'计划不能为空'), sourcePath:z.string().max(2000).optional() }).strict();
export const planSchema = planInputSchema.extend({ updatedAt:z.string().datetime() });
export const cardSchema = z.object({ kind: z.enum(['idea','image','flow','prototype','art']), title: z.string().min(1).max(200), body: z.string().max(6000), pinned: z.boolean(), proposalId:z.string().max(200).optional(), image: z.string().max(2600000).optional(), steps: z.array(z.object({ title:z.string().max(100), sub:z.string().max(500) })).max(12).optional(), prototype: z.object({ screenTitle:z.string().max(100), actionLabel:z.string().max(40), placeholder:z.string().max(200), successText:z.string().max(100) }).optional(), details:z.array(detail).max(40) });
export const nodeSchema = z.object({ id:z.string().min(1).max(100), type:z.literal('boardCard'), dragHandle:z.literal('.drag-handle'), position:z.object({x:z.number().finite(),y:z.number().finite()}), data:cardSchema });
export const boardSchema = z.object({ version:z.literal(1), id:z.string().regex(/^[a-zA-Z0-9-]{1,100}$/), title:z.string().min(1).max(100), goal:z.string().max(3000), inspirations:z.array(z.string().max(300)).max(20), example:z.boolean().optional(), plan:planSchema.optional(), phase:z.enum(['discovery','development']).optional(), projectPath:z.string().max(2000).optional(), progress:progressSchema.optional(), nodes:z.array(nodeSchema).max(200), edges:z.array(z.object({id:z.string().max(200),source:z.string().max(100),target:z.string().max(100),sourceHandle:z.string().max(30).optional(),targetHandle:z.string().max(30).optional(),type:z.literal('default').optional()})).max(500), messages:z.array(z.object({id:z.string().max(100),role:z.enum(['ai','user']),text:z.string().max(10000),suggestions:z.array(cardSchema).max(6).optional(),createdAt:z.string().optional()})).max(1000) });
export const preferencesSchema = z.object({ language:z.string().max(100).default('中文'), stack:z.string().max(1000).default(''), design:z.string().max(1000).default(''), habits:z.string().max(2000).default(''), source:z.string().max(1000).default('用户设置') });
export const responseSchema = { type:'object', additionalProperties:false, properties:{ message:{type:'string'}, proposals:{type:'array',maxItems:3,items:{type:'object',additionalProperties:false,properties:{kind:{type:'string',enum:['idea','flow','prototype']},title:{type:'string'},body:{type:'string'},rationale:{type:'string'},details:{type:'array',items:{type:'object',additionalProperties:false,properties:{title:{type:'string'},body:{type:'string'},children:{type:'array',items:{type:'object',additionalProperties:false,properties:{title:{type:'string'},body:{type:'string'}},required:['title','body']}}},required:['title','body','children']}}},required:['kind','title','body','rationale','details']}}},required:['message','proposals'] };

export function parseBoard(value) {
  const board=boardSchema.parse(value);
  if(board.progress)board.progress=validateProgress(board.progress);
  if(board.phase==='development'&&!board.progress)throw new Error('开发阶段需要实际进度数据');
  const ids=new Set(board.nodes.map(n=>n.id));
  if(ids.size!==board.nodes.length) throw new Error('节点 ID 重复');
  if(new Set(board.edges.map(e=>e.id)).size!==board.edges.length)throw new Error('连接 ID 重复');
  if(board.edges.some(e=>!ids.has(e.source)||!ids.has(e.target))) throw new Error('连接指向不存在的节点');
  let count=0;
  function visit(ds,depth=0){ if(depth>8) throw new Error('细节层级超过 8 层'); for(const d of ds){ if(++count>2000) throw new Error('细节数量过多'); visit(d.children||[],depth+1); } }
  const cards=[...board.nodes.map(n=>n.data),...board.messages.flatMap(m=>m.suggestions||[])];
  cards.forEach(c=>visit(c.details));
  cards.forEach(c=>{ if(c.image && !/^asset:(forest|art|journal)$/.test(c.image) && !/^data:image\/(png|jpeg|webp|gif);base64,[a-zA-Z0-9+/=]+$/.test(c.image)) throw new Error('图片必须是本机导入的图片'); });
  return board;
}
