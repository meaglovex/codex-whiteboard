import { spawn } from 'node:child_process';
import readline from 'node:readline';
import assert from 'node:assert/strict';
const proc=spawn('codex',['app-server','--disable','apps','--disable','hooks','--disable','multi_agent','-c','mcp_servers.openaiDeveloperDocs.enabled=false','-c','mcp_servers.node_repl.enabled=false','-c','mcp_servers.computer-use.enabled=false'],{stdio:['pipe','pipe','ignore']});
const pending=new Map();let serial=1;
const send=x=>proc.stdin.write(JSON.stringify(x)+'\n');
const rl=readline.createInterface({input:proc.stdout});
rl.on('line',line=>{let msg;try{msg=JSON.parse(line);}catch{return;}if(msg.id!==undefined&&pending.has(msg.id)){const cb=pending.get(msg.id);pending.delete(msg.id);msg.error?cb.reject(new Error(msg.error.message)):cb.resolve(msg.result);}else if(msg.id!==undefined&&msg.method)send({id:msg.id,error:{code:-32601,message:'No approval actions in read-only integration probe'}});});
function call(method,params){const id=serial++;return new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{pending.delete(id);reject(new Error('Host integration timeout: '+method));},35000);pending.set(id,{resolve:x=>{clearTimeout(timeout);resolve(x);},reject:e=>{clearTimeout(timeout);reject(e);}});send({id,method,params});});}
try{
  await call('initialize',{clientInfo:{name:'product_whiteboard_acceptance',version:'0.2.3'},capabilities:{experimentalApi:true}});send({method:'initialized',params:{}});
  const start=await call('thread/start',{cwd:process.cwd(),ephemeral:true,approvalPolicy:'never',sandbox:'read-only',baseInstructions:'Read-only plugin loading probe. No model turn will be started.'});
  let target;
  for(let i=0;i<30;i++){const state=await call('mcpServerStatus/list',{limit:200,detail:'toolsAndAuthOnly'});target=state.data?.find(x=>x.name?.includes('whiteboard'));if(target&&Object.keys(target.tools||{}).length)break;await new Promise(r=>setTimeout(r,500));}
  if(!target)throw new Error('Installed whiteboard MCP server was not discovered by Codex');
  const entry=Object.values(target.tools||{}).find(tool=>tool.name==='whiteboard_open');
  for(const name of ['whiteboard_begin','whiteboard_sync','whiteboard_plan'])assert.ok(Object.values(target.tools||{}).some(tool=>tool.name===name),'Codex did not load '+name);
  assert.equal(entry?.title,'产品白板','Codex did not load the panel title');
  assert.ok(entry?._meta?.ui?.resourceUri?.startsWith('ui://'),'Codex did not load the UI resource');
  assert.ok(entry?._meta?.['openai/ui']?.entrypoints?.some(x=>x.type==='thread'),'Codex did not load the thread menu entrypoint');
  const output=await call('mcpServer/tool/call',{threadId:start.thread.id,server:target.name,tool:'whiteboard_open',arguments:{boardId:'example'}});
  const skills=await call('skills/list',{cwds:[process.cwd()],forceReload:true});
  const found=skills.data?.flatMap(x=>x.skills||[]).filter(x=>x.name.includes('product-whiteboard')||x.path.includes('/product-whiteboard/'))||[];
  console.log(JSON.stringify({server:target.name,toolNames:Object.keys(target.tools||{}),nativePanel:{title:entry.title,resourceUri:entry._meta.ui.resourceUri,entrypoints:entry._meta['openai/ui'].entrypoints},toolCall:output,skills:found.map(x=>({name:x.name,enabled:x.enabled,pluginId:x.pluginId})),skillErrors:skills.data?.flatMap(x=>x.errors||[]).filter(x=>x.path.includes('whiteboard')),skillLoaded:found.some(x=>x.enabled)},null,2));
  if(!found.some(x=>x.enabled))throw new Error('Installed whiteboard skill was not loaded');
}finally{proc.kill('SIGTERM');rl.close();}
