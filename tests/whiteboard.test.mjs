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
test('native menu entry points at a self-contained MCP App resource',async()=>{
  const {tools}=await client.listTools();const open=tools.find(t=>t.name==='whiteboard_open');
  assert.equal(open.title,'产品白板');assert.deepEqual(open._meta['openai/ui'].entrypoints,[{type:'thread'}]);
  const uri=open._meta.ui.resourceUri;assert.match(uri,/^ui:\/\//);
  const {resources}=await client.listResources();assert.ok(resources.some(r=>r.uri===uri));
  const {contents}=await client.readResource({uri});const resource=contents[0];
  assert.equal(resource.mimeType,'text/html;profile=mcp-app');
  assert.match(resource.text,/window\.__PRODUCT_WHITEBOARD_MCP__=true/);
  assert.match(resource.text,/whiteboard_ui_request/);
  assert.deepEqual(resource._meta.ui.csp.connectDomains,[]);
  assert.ok(resource.text.length>100000);assert.doesNotMatch(resource.text,/Bearer [a-f0-9]{64}/);
  assert.deepEqual(tools.find(t=>t.name==='whiteboard_ui_request')._meta.ui.visibility,['app']);
});
test('native UI bridge saves real data and rejects unrelated endpoints',async()=>{
  const invoke=arguments_=>client.callTool({name:'whiteboard_ui_request',arguments:arguments_});
  const created=await invoke({route:'/api/boards',method:'POST',value:{title:'面板桥接验证',goal:'验证真实保存'}});
  assert.equal(created.isError,undefined);const id=created.structuredContent.data.board.id;
  const state=(await invoke({route:`/api/boards/${id}`,method:'GET'})).structuredContent.data;
  const changed=structuredClone(state.board);changed.goal='通过 MCP 面板保存的目标';
  const saved=await invoke({route:`/api/boards/${id}`,method:'PUT',value:{base:state.board,board:changed,revision:state.revision}});
  assert.equal(saved.isError,undefined);
  assert.equal(JSON.parse(await fs.readFile(path.join(dir,'boards',id+'.json'),'utf8')).board.goal,changed.goal);
  for(const route of ['/api/health','/api/boards/../preferences','https://example.com','/api/boards/example/apply'])assert.equal((await invoke({route,method:'GET'})).isError,true);
  assert.equal((await invoke({route:'/api/boards',method:'GET',value:{}})).isError,true);
});
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

test('natural-intent begin is idempotent per conversation and switches the active page',async()=>{
  const begin=arguments_=>client.callTool({name:'whiteboard_begin',arguments:arguments_});
  const input={productKey:'photo-journal',title:'旅途相册',goal:'把旅行照片与当天感受结合',conversationId:'test-conversation-a'};
  const first=await begin(input),retry=await begin(input);
  assert.equal(first.isError,undefined);assert.equal(first.structuredContent.created,true);
  assert.equal(retry.structuredContent.created,false);assert.equal(retry.structuredContent.board.id,first.structuredContent.board.id);
  const other=await begin({...input,productKey:'reading-journal',title:'阅读日记'});
  assert.notEqual(other.structuredContent.board.id,first.structuredContent.board.id);
  const anotherConversation=await begin({...input,conversationId:'test-conversation-b'});
  assert.notEqual(anotherConversation.structuredContent.board.id,first.structuredContent.board.id);
  const active=(await api('/api/session')).value;assert.equal(active.boardId,anotherConversation.structuredContent.board.id);
  const ui=await client.callTool({name:'whiteboard_ui_request',arguments:{route:'/api/session'}});
  assert.equal(ui.structuredContent.data.boardId,active.boardId);
  assert.equal((await api('/api/session/begin','POST',{...input,productKey:''})).status,400);
});
test('discussion sync revises the same card, keeps deep arguments and deduplicates retries',async()=>{
  const started=await client.callTool({name:'whiteboard_begin',arguments:{productKey:'auto-sync',title:'讨论驱动',conversationId:'sync-test'}});
  const boardId=started.structuredContent.board.id;
  const sync=patch=>client.callTool({name:'whiteboard_sync',arguments:{boardId,...patch}});
  const original={cards:[{id:'core_idea',card:{kind:'idea',title:'自动整理',body:'先讨论假设',pinned:false,details:[{id:'reason',title:'为什么',body:'减少分类负担',children:[{id:'exception',title:'整理失败',body:'保留原文',children:[{id:'retry',title:'恢复操作',body:'再次整理仍可撤销'}]}]}]}},{id:'flow',card:{kind:'flow',title:'主流程',body:'',pinned:false,steps:[{title:'说出想法',sub:'当前聊天'},{title:'讨论',sub:'质疑和举例'},{title:'自动更新',sub:'同一页'}],details:[]}}],links:[{source:'core_idea',target:'flow'}],messages:[{id:'round_1',role:'user',text:'先验证是否真的需要自动整理'}]};
  assert.equal((await sync(original)).isError,undefined);assert.equal((await sync(original)).isError,undefined);
  const generation=(await api('/api/session')).value.generation;
  assert.equal((await sync({cards:[{id:'core_idea',card:{title:'先收下，再整理',body:'用户确认先快速捕捉',pinned:true,details:[{id:'reason',title:'为什么',body:'用户反驳了强制分类'}]}}],messages:[{id:'round-2',role:'ai',text:'撤回强制分类，保留快速捕捉'}]})).isError,undefined);
  const state=(await api(`/api/boards/${boardId}`)).value;
  assert.equal(state.board.nodes.length,2);assert.equal(state.board.messages.length,2);assert.equal(state.board.edges.length,1);
  const core=state.board.nodes[0].data;assert.equal(core.pinned,true);assert.equal(core.title,'先收下，再整理');
  assert.equal(core.details[0].children[0].children[0].body,'再次整理仍可撤销');
  assert.ok((await api('/api/session')).value.generation>generation);
  assert.equal((await api('/api/session')).value.revision,state.revision);
  const bad=await sync({links:[{source:'core_idea',target:'absent'}]});assert.equal(bad.isError,true);
  assert.equal((await api(`/api/boards/${boardId}`)).value.revision,state.revision);
  const files=(await client.callTool({name:'whiteboard_export',arguments:{boardId}})).structuredContent;
  assert.match(await fs.readFile(files.markdown,'utf8'),/再次整理仍可撤销/);
});

test('plan file attachment persists exact Markdown, updates the board and exports plan.md',async()=>{
  const created=(await api('/api/boards','POST',{title:'计划独立保存',goal:'验证计划阅读'})).value;
  const id=created.board.id;
  const markdown='# 第一版计划\n\n## 实施步骤\n\n- [x] 明确范围\n- [ ] 完成验收\n\n| 阶段 | 输出 |\n| --- | --- |\n| 开发 | 可运行版本 |\n';
  const filePath=path.join(dir,'source-plan.md');await fs.writeFile(filePath,markdown);
  const result=await client.callTool({name:'whiteboard_plan',arguments:{boardId:id,filePath}});
  assert.equal(result.isError,undefined);
  assert.equal(await fs.readFile(result.structuredContent.planPath,'utf8'),markdown);
  const saved=(await api(`/api/boards/${id}`)).value;
  assert.equal(saved.board.plan.markdown,markdown);
  assert.equal(saved.board.plan.sourcePath,filePath);
  assert.deepEqual(saved.board.nodes,created.board.nodes);
  assert.ok(Number.isFinite(Date.parse(saved.board.plan.updatedAt)));
  assert.equal((await api('/api/session')).value.revision,saved.revision);
  const exported=(await api(`/api/boards/${id}/export`,'POST',{})).value;
  assert.equal(path.basename(exported.plan),'plan.md');
  assert.equal(await fs.readFile(exported.plan,'utf8'),markdown);
  assert.equal(JSON.parse(await fs.readFile(exported.json,'utf8')).plan.markdown,markdown);
  assert.match(await fs.readFile(exported.markdown,'utf8'),/\[plan.md\]\(plan.md\)/);
  // A source file change alone is not misrepresented as a live document update.
  await fs.writeFile(filePath,'# 修订计划\n');
  assert.equal((await api(`/api/boards/${id}`)).value.board.plan.markdown,markdown);
  await client.callTool({name:'whiteboard_plan',arguments:{boardId:id,filePath}});
  assert.equal((await api(`/api/boards/${id}`)).value.board.plan.markdown,'# 修订计划\n');
});

test('a later plan survives stale non-plan edits and never appears on another board',async()=>{
  const first=(await api('/api/boards','POST',{title:'白板一'})).value;
  const second=(await api('/api/boards','POST',{title:'白板二'})).value;
  const id=first.board.id;
  await client.callTool({name:'whiteboard_plan',arguments:{boardId:id,markdown:'# 只属于白板一'}});
  const local=structuredClone(first.board);local.goal='另一个窗口修改目标';
  const saved=await api(`/api/boards/${id}`,'PUT',{base:first.board,board:local,revision:first.revision});
  assert.equal(saved.status,200);assert.equal(saved.value.board.plan.markdown,'# 只属于白板一');
  assert.equal((await api(`/api/boards/${second.board.id}`)).value.board.plan,undefined);
  const exported=(await api(`/api/boards/${second.board.id}/export`,'POST',{})).value;
  assert.equal(exported.plan,undefined);
});

test('invalid plan sources and empty content leave the previous plan untouched',async()=>{
  const {board}= (await api('/api/boards','POST',{title:'计划边界'})).value;
  await client.callTool({name:'whiteboard_plan',arguments:{boardId:board.id,markdown:'# 已保存的计划'}});
  const before=(await api(`/api/boards/${board.id}`)).value;
  for(const input of [{markdown:'  '},{markdown:'x'.repeat(200001)},{filePath:'relative.md'},{filePath:path.join(dir,'runtime.json')},{filePath:path.join(dir,'missing.md')},{markdown:'# 重复输入',filePath:path.join(dir,'source-plan.md')}]){
    assert.equal((await client.callTool({name:'whiteboard_plan',arguments:{boardId:board.id,...input}})).isError,true);
  }
  assert.equal((await api(`/api/boards/${board.id}/plan`,'POST',{sourcePath:path.join(dir,'runtime.json')})).status,400);
  assert.equal((await client.callTool({name:'whiteboard_ui_request',arguments:{route:`/api/boards/${board.id}/plan`,method:'POST',value:{filePath:path.join(dir,'runtime.json')}}})).isError,true);
  assert.deepEqual((await api(`/api/boards/${board.id}`)).value,before);
});

test('concurrent plan saves keep the file copy equal to the latest board snapshot',async()=>{
  const {board}=(await api('/api/boards','POST',{title:'计划并发保存'})).value;
  const results=await Promise.all(Array.from({length:4},(_,i)=>api(`/api/boards/${board.id}/plan`,'POST',{markdown:`# 计划 ${i}\n`+'内容'.repeat(i%2?2:40000)})));
  assert.ok(results.every(result=>result.status===200));
  const saved=(await api(`/api/boards/${board.id}`)).value;
  const file=path.join(dir,'plans',board.id,'plan.md');
  assert.equal(await fs.readFile(file,'utf8'),saved.board.plan.markdown);
  assert.equal(saved.revision,5);
});
