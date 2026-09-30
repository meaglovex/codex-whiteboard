import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { mergeBoard } from '../shared/merge.mjs';
import { toMarkdown } from '../shared/export.mjs';
let dir,proc,token,client,transport;
const port=5319,root=path.resolve('release/product-whiteboard');
async function api(route,method='GET',value,headers={}){const response=await fetch(`http://127.0.0.1:${port}${route}`,{method,headers:{Authorization:`Bearer ${token}`,...(value?{'Content-Type':'application/json'}:{}),...headers},body:value?JSON.stringify(value):undefined});return {status:response.status,value:await response.json()};}
before(async()=>{
  dir=await fs.mkdtemp(path.join(os.tmpdir(),'whiteboard-test-'));
  const env={...process.env,WHITEBOARD_DATA_DIR:dir,WHITEBOARD_PORT:String(port)};
  proc=spawn(process.execPath,[path.join(root,'server/app.mjs'),'--serve'],{env,stdio:'ignore'});
  for(let i=0;i<60;i++){try{const r=await fetch(`http://127.0.0.1:${port}/api/health`);if(r.ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  ({token}=JSON.parse(await fs.readFile(path.join(dir,'runtime.json'),'utf8')));
  transport=new StdioClientTransport({command:process.execPath,args:[path.join(root,'server/mcp.mjs')],env});
  client=new Client({name:'whiteboard-test',version:'0.1.0'});await client.connect(transport);
});
after(async()=>{await client?.close();proc?.kill('SIGTERM');await new Promise(r=>setTimeout(r,150));await fs.rm(dir,{recursive:true,force:true});});
test('MCP handshake exposes product tools and opens the actual service',async()=>{const list=await client.listTools();assert.ok(list.tools.some(t=>t.name==='whiteboard_image'));const result=await client.callTool({name:'whiteboard_open',arguments:{boardId:'example'}});assert.equal(result.isError,undefined);assert.match(result.structuredContent.url,/5319/);});
test('MCP image returns real media, not a placeholder',async()=>{const result=await client.callTool({name:'whiteboard_image',arguments:{boardId:'example',nodeId:'landscape'}});const image=result.content.find(x=>x.type==='image');assert.equal(image.mimeType,'image/jpeg');assert.ok(Buffer.from(image.data,'base64').length>10000);});
test('cross-site requests and DNS rebinding are rejected',async()=>{assert.equal((await api('/api/boards','GET',undefined,{Origin:'https://example.com'})).status,403);assert.equal((await api('/api/boards','GET',undefined,{'Sec-Fetch-Site':'cross-site'})).status,403);const status=await new Promise((resolve,reject)=>{const req=http.get({hostname:'127.0.0.1',port,path:'/api/boards',headers:{Host:'evil.example'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);});assert.equal(status,403);});
test('unauthenticated mutations cannot create a board',async()=>{const r=await fetch(`http://127.0.0.1:${port}/api/boards`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:'unauthorized'})});assert.equal(r.status,401);});
test('new goals and preferences survive file readback',async()=>{const created=await api('/api/boards','POST',{title:'融合产品',goal:'把快速捕捉与回看结合',inspirations:['相册','便签']});assert.equal(created.status,201);const disk=JSON.parse(await fs.readFile(path.join(dir,'boards',created.value.board.id+'.json'),'utf8'));assert.equal(disk.board.goal,'把快速捕捉与回看结合');await api('/api/preferences','PUT',{stack:'TypeScript',source:'测试中的用户设置'});assert.equal((await api('/api/preferences')).value.stack,'TypeScript');});
test('editing preserves deeper content and exports actual files',async()=>{
  const result=await client.callTool({name:'whiteboard_apply',arguments:{boardId:'example',operations:[{action:'update',nodeId:'idea',card:{title:'只改核心标题'}}]}});assert.equal(result.isError,undefined);
  const board=(await api('/api/boards/example')).value.board;assert.equal(board.nodes[0].data.details[0].children[0].title,'通勤路上的三十秒');
  const exported=await client.callTool({name:'whiteboard_export',arguments:{boardId:'example'}});assert.equal(exported.isError,undefined);const text=await fs.readFile(exported.structuredContent.markdown,'utf8');assert.match(text,/通勤路上的三十秒/);assert.match(text,/只改核心标题/);assert.equal(JSON.parse(await fs.readFile(exported.structuredContent.json,'utf8')).id,'example');
});
test('independent stale edits merge without dropping model context',async()=>{const original=(await api('/api/boards/example')).value;const local=structuredClone(original.board);local.nodes[0].position.x+=20;await api('/api/boards/example/apply','POST',{operations:[{action:'message',role:'ai',text:'并发讨论的新增依据'}]});const save=await api('/api/boards/example','PUT',{base:original.board,board:local,revision:original.revision});assert.equal(save.status,200);assert.equal(save.value.board.messages.at(-1).text,'并发讨论的新增依据');assert.equal(save.value.board.nodes[0].position.x,local.nodes[0].position.x);});
test('same-field conflict leaves disk unchanged',async()=>{const original=(await api('/api/boards/example')).value,local=structuredClone(original.board);local.nodes[0].data.title='本窗口修改';await api('/api/boards/example/apply','POST',{operations:[{action:'update',nodeId:'idea',card:{title:'另一窗口修改'}}]});const r=await api('/api/boards/example','PUT',{base:original.board,board:local,revision:original.revision});assert.equal(r.status,409);assert.equal((await api('/api/boards/example')).value.board.nodes[0].data.title,'另一窗口修改');});
test('invalid images, dangling edges and traversal ids fail safely',async()=>{const original=(await api('/api/boards/example')).value;for(const mutate of [b=>{b.nodes[1].data.image='https://example.com/tracker.png';},b=>{b.edges[0].target='missing';},b=>{b.id='../escape';},b=>{b.messages[0].suggestions=[{...b.nodes[1].data,image:'https://example.com/tracker.png'}];},b=>{b.edges.push({...b.edges[0]});}]){const bad=structuredClone(original.board);mutate(bad);const r=await api('/api/boards/example','PUT',{base:original.board,board:bad,revision:original.revision});assert.equal(r.status,400);}assert.equal((await api('/api/boards/example')).value.revision,original.revision);});
test('three-way merge preserves edits made while a save was in flight',()=>{const base={nodes:[{id:'a',data:{title:'A'},position:{x:0,y:0}}],messages:[]};const sent=structuredClone(base);sent.nodes[0].position.x=10;const latest=structuredClone(sent);latest.nodes[0].position.x=20;const response=structuredClone(sent);response.messages.push({id:'m',text:'新讨论'});const result=mergeBoard(sent,latest,response);assert.equal(result.nodes[0].position.x,20);assert.equal(result.messages[0].text,'新讨论');});
test('developer export retains prototype behavior, relationships and unadopted details',()=>{const c={kind:'prototype',title:'申请复核',body:'验证退款',pinned:false,prototype:{screenTitle:'复核',actionLabel:'提交',placeholder:'拒绝原因',successText:'申请已保存'},details:[{id:'d',title:'失败恢复',body:'保留输入',children:[{id:'c',title:'重复提交',body:'幂等检查'}]}]};const result=toMarkdown({title:'退款',goal:'减少误操作',inspirations:[],nodes:[{id:'a',data:c},{id:'b',data:{...c,title:'到账'}}],edges:[{source:'a',target:'b'}],messages:[{role:'ai',text:'候选讨论',suggestions:[{...c,title:'未采纳的备选'}]}]});assert.match(result,/完成反馈：申请已保存/);assert.match(result,/申请复核 → 到账/);assert.match(result,/未采纳的备选/);assert.match(result,/重复提交：幂等检查/);});
