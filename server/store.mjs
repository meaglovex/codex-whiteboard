import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import { parseBoard, preferencesSchema, planInputSchema } from './schema.mjs';
import { mergeBoard } from '../shared/merge.mjs';
import { toMarkdown } from '../shared/export.mjs';
import { applyProgress } from './progress.mjs';
export { toMarkdown } from '../shared/export.mjs';

export const dataRoot=process.env.WHITEBOARD_DATA_DIR || path.join(os.homedir(), process.platform==='darwin'?'Library/Application Support/Product Whiteboard':'.local/share/product-whiteboard');
export const safeId=id=>{ if(!/^[a-zA-Z0-9-]{1,100}$/.test(id)) throw new Error('无效的白板 ID'); return id; };
export async function atomicWrite(file,value){ await fs.mkdir(path.dirname(file),{recursive:true,mode:0o700}); const temp=`${file}.${randomUUID()}.tmp`; await fs.writeFile(temp,typeof value==='string'?value:JSON.stringify(value,null,2),{mode:0o600}); await fs.rename(temp,file); }
async function read(file,fallback){try{return JSON.parse(await fs.readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw e;}}
const files=id=>path.join(dataRoot,'boards',`${safeId(id)}.json`);
let queue=Promise.resolve();
export const serial=fn=>{const result=queue.then(fn);queue=result.catch(()=>{});return result;};
export async function getBoard(id){const v=await read(files(id));if(!v){const e=new Error('白板不存在');e.status=404;throw e;}return v;}
export async function listBoards(){await fs.mkdir(path.join(dataRoot,'boards'),{recursive:true,mode:0o700});const names=await fs.readdir(path.join(dataRoot,'boards'));const boards=await Promise.all(names.filter(n=>n.endsWith('.json')).map(async n=>{const x=await read(path.join(dataRoot,'boards',n));return {id:x.board.id,title:x.board.title,goal:x.board.goal,example:x.board.example,phase:x.board.phase,projectPath:x.board.projectPath,progressUpdatedAt:x.board.progress?.updatedAt,revision:x.revision,updatedAt:x.updatedAt};}));return boards.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));}
export async function createBoard(board){return serial(async()=>{board=parseBoard(board);if(await read(files(board.id)))throw new Error('白板已存在');const state={board,revision:1,updatedAt:new Date().toISOString()};await atomicWrite(files(board.id),state);return state;});}
export async function changeBoard(id,fn){return serial(async()=>{const current=await getBoard(id);const proposed=await fn(structuredClone(current.board),current);if(proposed===null)return current;const board=parseBoard(proposed);if(board.id!==id)throw new Error('不能修改白板 ID');await atomicWrite(path.join(dataRoot,'history',id,`${current.revision}.json`),current);const state={board,revision:current.revision+1,updatedAt:new Date().toISOString()};await atomicWrite(files(id),state);const h=path.join(dataRoot,'history',id);const names=(await fs.readdir(h)).filter(n=>n.endsWith('.json')).sort((a,b)=>Number(a.slice(0,-5))-Number(b.slice(0,-5)));for(const n of names.slice(0,-20))await fs.unlink(path.join(h,n));return state;});}

export async function saveBoard(id,base,local,revision){return changeBoard(id,(remote,current)=>{base=parseBoard(base);local=parseBoard(local);if(base.id!==id||local.id!==id)throw new Error('白板 ID 不一致');return current.revision===revision?local:mergeBoard(base,local,remote);});}
export async function getPreferences(){return preferencesSchema.parse(await read(path.join(dataRoot,'preferences.json'),{}));}
export async function setPreferences(values){const current=await getPreferences();const result=preferencesSchema.parse({...current,...values});await atomicWrite(path.join(dataRoot,'preferences.json'),result);return result;}
export async function exportBoard(id){const {board}=await getBoard(id);const dir=path.join(dataRoot,'exports',`${id}-${Date.now()}`);const json=path.join(dir,'whiteboard.json'),markdown=path.join(dir,'development-context.md');await atomicWrite(json,board);await atomicWrite(markdown,toMarkdown(board));const plan=board.plan?path.join(dir,'plan.md'):undefined;if(plan)await atomicWrite(plan,board.plan.markdown);return {json,markdown,...(plan?{plan}:{})};}

export async function savePlan(id,input){
  const plan={...planInputSchema.parse(input),updatedAt:new Date().toISOString()};
  const planPath=path.join(dataRoot,'plans',safeId(id),'plan.md');
  const state=await changeBoard(id,async board=>{
    const next=parseBoard({...board,plan});
    await atomicWrite(planPath,plan.markdown);
    return next;
  });
  await activateBoard(id);
  return {boardId:id,revision:state.revision,planPath,updatedAt:plan.updatedAt};
}

export async function saveProgress(id,input){
  let unchanged=false;
  const state=await changeBoard(id,board=>{const next=applyProgress(board,input);unchanged=next===null;return next;});
  if(!unchanged)await activateBoard(id);
  return {boardId:id,revision:state.revision,phase:state.board.phase,updatedAt:state.board.progress.updatedAt,unchanged};
}

export async function getActiveSession(){return read(path.join(dataRoot,'active.json'),{boardId:null,generation:0});}
async function activate(boardId){const state=await getBoard(boardId);const previous=await getActiveSession();const next={boardId,revision:state.revision,generation:previous.generation+1,updatedAt:new Date().toISOString()};await atomicWrite(path.join(dataRoot,'active.json'),next);return next;}
export const activateBoard=boardId=>serial(()=>activate(boardId));
export async function beginSession({productKey,title,goal='',conversationId,scope='local',boardId}){
  if(typeof productKey!=='string'||!productKey.trim()||productKey.length>200)throw new Error('需要明确的产品标识');
  if(typeof title!=='string'||!title.trim()||title.length>100)throw new Error('需要产品标题');
  if(typeof scope!=='string'||scope.length>2000||conversationId!==undefined&&(typeof conversationId!=='string'||conversationId.length>200))throw new Error('无效的对话范围');
  const key=createHash('sha256').update(JSON.stringify([conversationId||scope,productKey.trim()])).digest('hex');
  return serial(async()=>{
    const file=path.join(dataRoot,'sessions',key+'.json');const binding=await read(file,{});
    let state,created=false;
    if(boardId||binding.boardId)state=await getBoard(boardId||binding.boardId);
    else {const board=parseBoard({version:1,id:randomUUID(),title:title.trim(),goal,inspirations:[],nodes:[],edges:[],messages:[]});state={board,revision:1,updatedAt:new Date().toISOString()};await atomicWrite(files(board.id),state);created=true;}
    await atomicWrite(file,{boardId:state.board.id});await activate(state.board.id);
    return {...state,created,sessionKey:key};
  });
}
