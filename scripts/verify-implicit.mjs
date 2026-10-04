// Real model acceptance. Deliberately do not mention the plugin/skill in test prompts.
import { execFileSync, spawn } from 'node:child_process';
import readline from 'node:readline';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
const root=process.cwd(),data=await fs.mkdtemp(path.join(root,'.test-data/implicit-'));
const listing=JSON.parse(execFileSync('codex',['plugin','list','--marketplace','product-whiteboard-local','--json'],{encoding:'utf8'}));
const plugin=listing.installed?.find(x=>x.pluginId==='product-whiteboard@product-whiteboard-local');assert.ok(plugin?.enabled,'Install the plugin before model acceptance');
const installed=path.join(process.env.CODEX_HOME||path.join(os.homedir(),'.codex'),'plugins/cache/product-whiteboard-local/product-whiteboard',plugin.version);await fs.access(path.join(installed,'server/mcp.mjs'));
const cwd=path.join(data,'workspace');await fs.mkdir(cwd,{mode:0o700});
const proc=spawn('codex',['app-server','--disable','apps','--disable','hooks','--disable','multi_agent','-c','mcp_servers.openaiDeveloperDocs.enabled=false','-c','mcp_servers.node_repl.enabled=false','-c','mcp_servers.computer-use.enabled=false','-c',`mcp_servers.whiteboard={command="node",args=[${JSON.stringify(path.join(installed,"server/mcp.mjs"))}],env={WHITEBOARD_DATA_DIR=${JSON.stringify(data)},WHITEBOARD_PORT="5334"}}`],{env:{...process.env,WHITEBOARD_DATA_DIR:data,WHITEBOARD_PORT:'5334'},stdio:['pipe','pipe','pipe']});
const pending=new Map(),events=[];let serial=1,completed=new Map();
let stderr='';proc.stderr.on('data',chunk=>{stderr+=chunk.toString();});
proc.on('exit',code=>{for(const cb of pending.values())cb.reject(new Error('Codex exited '+code+': '+stderr.slice(-800)));pending.clear();});
const send=x=>proc.stdin.write(JSON.stringify(x)+'\n');
const rl=readline.createInterface({input:proc.stdout});
rl.on('line',line=>{
 let msg;try{msg=JSON.parse(line);}catch{return;}
 if(msg.id!==undefined&&pending.has(msg.id)){const cb=pending.get(msg.id);pending.delete(msg.id);msg.error?cb.reject(new Error(msg.error.message)):cb.resolve(msg.result);return;}
 if(msg.id!==undefined&&msg.method){send({id:msg.id,error:{code:-32601,message:'No approval actions in isolated acceptance'}});return;}
 if(msg.method==='item/completed'){events.push(msg.params);const item=msg.params.item;if(item.type==='mcpToolCall')console.log('tool:',item.tool,item.status);if(item.type==='commandExecution')console.log('command:',item.command.includes('SKILL.md')?'read skill':'read-only command');}
 if(msg.method==='turn/completed'){completed.set(msg.params.turn.id,msg.params.turn);console.log('turn:',msg.params.turn.status);}
});
function call(method,params){const id=serial++;return new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{pending.delete(id);reject(new Error('Host timeout: '+method));},45000);pending.set(id,{resolve:x=>{clearTimeout(timeout);resolve(x);},reject:e=>{clearTimeout(timeout);reject(e);}});send({id,method,params});});}
async function turn(threadId,text){const start=events.length;const {turn}=await call('turn/start',{threadId,input:[{type:'text',text}]});const deadline=Date.now()+360000;while(!completed.has(turn.id)){if(Date.now()>deadline)throw new Error('Model turn timed out');await new Promise(r=>setTimeout(r,500));}const result=completed.get(turn.id);if(result.status!=='completed')throw new Error('Model turn failed: '+JSON.stringify(result.error));return events.slice(start).filter(e=>e.turnId===turn.id).map(e=>e.item);}
async function boards(){const dir=path.join(data,'boards');return Promise.all((await fs.readdir(dir)).filter(n=>n.endsWith('.json')).map(async n=>JSON.parse(await fs.readFile(path.join(dir,n),'utf8'))));}
try{
 await call('initialize',{clientInfo:{name:'whiteboard_implicit_acceptance',version:'0.2.0'},capabilities:{experimentalApi:true}});send({method:'initialized',params:{}});
 const start=await call('thread/start',{cwd,ephemeral:true,approvalPolicy:'never',sandbox:'read-only'});const threadId=start.thread.id;
 let target;for(let i=0;i<30;i++){const state=await call('mcpServerStatus/list',{limit:200,detail:'toolsAndAuthOnly'});target=state.data?.find(x=>x.name?.includes('whiteboard'));if(target&&Object.values(target.tools||{}).some(t=>t.name==='whiteboard_begin'))break;await new Promise(r=>setTimeout(r,500));}
 assert.ok(target,'Installed MCP was not discovered');
 const open=await call('mcpServer/tool/call',{threadId,server:target.name,tool:'whiteboard_open',arguments:{boardId:'example'}});
 assert.match(JSON.stringify(open),/5334/,'Acceptance did not use isolated service; no model writes started');
 const first=await turn(threadId,'我想做一个旅行记录产品，把相册的回看感和便签的快速记录结合起来。用户在路上只想花十秒留下一段感受，不想写长日记。先和我讨论目标与最核心的流程，不要写业务代码。');
 assert.ok(first.some(x=>x.type==='mcpToolCall'&&x.tool==='whiteboard_begin'&&x.status==='completed'),'Natural product intent did not trigger begin');
 assert.ok(first.some(x=>x.type==='mcpToolCall'&&x.tool==='whiteboard_sync'&&x.status==='completed'),'Discussion was not synced');
 const initial=(await boards()).filter(x=>!x.board.example);assert.equal(initial.length,1);assert.ok(initial[0].board.nodes.length>0);
 const boardId=initial[0].board.id,firstRevision=initial[0].revision;
 const second=await turn(threadId,'不对，自动整理会打断记录。我只要先留下照片和一句话，分类完全推迟到旅行结束。这个先收下再整理的方向我确认了；请保留之前为什么考虑即时分类、又为什么放弃的依据。');
 assert.ok(second.some(x=>x.type==='mcpToolCall'&&x.tool==='whiteboard_sync'&&x.status==='completed'),'Rebuttal was not synced');
 const revised=(await boards()).filter(x=>!x.board.example);assert.equal(revised.length,1);assert.equal(revised[0].board.id,boardId);assert.ok(revised[0].revision>firstRevision);
 assert.ok(revised[0].board.nodes.some(x=>x.data.pinned),'User consensus was not recorded');
 assert.match(JSON.stringify(revised[0].board),/旅行结束|推迟|延后|事后/,'New constraint was not retained');
 const other=await call('thread/start',{cwd,ephemeral:true,approvalPolicy:'never',sandbox:'read-only'});
 const negative=await turn(other.thread.id,'已有项目的保存按钮点击没反应，代码我稍后提供。现在只分析可能原因，不要写文件。');
 assert.ok(!negative.some(x=>x.type==='mcpToolCall'&&x.tool==='whiteboard_begin'),'Existing project repair incorrectly created a product board');
 assert.equal((await boards()).filter(x=>!x.board.example).length,1);
 const receipt={version:'0.2.0',naturalIntent:true,rebuttalSync:true,ordinaryRepairNoCreation:true,boardId,firstRevision,secondRevision:revised[0].revision,cardCount:revised[0].board.nodes.length,firstTools:first.filter(x=>x.type==='mcpToolCall').map(x=>x.tool),secondTools:second.filter(x=>x.type==='mcpToolCall').map(x=>x.tool),data};
 await fs.writeFile(path.join(data,'acceptance.json'),JSON.stringify({receipt,events},null,2),{mode:0o600});console.log(JSON.stringify(receipt,null,2));
}finally{
 proc.kill('SIGTERM');rl.close();
 try{const runtime=JSON.parse(await fs.readFile(path.join(data,'runtime.json'),'utf8'));if(runtime.port===5334)process.kill(runtime.pid,'SIGTERM');}catch{}
}
