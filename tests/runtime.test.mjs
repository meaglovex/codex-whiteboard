import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { APP_VERSION, RUNTIME_CAPABILITIES } from '../shared/version.mjs';

const bundle=path.resolve('release/product-whiteboard');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function freePort(){const server=net.createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const port=server.address().port;await new Promise(resolve=>server.close(resolve));return port;}
async function fixture(t,{legacy=false,busy=false,foreign=false,staleLock=false,removedCache=false,slowHandoff=false}={}){
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'whiteboard runtime checks ')),data=path.join(root,'data'),port=await freePort();
  await fs.mkdir(data,{recursive:true});
  const env={...process.env,WHITEBOARD_PORT:String(port),WHITEBOARD_DATA_DIR:data,WHITEBOARD_FIXTURE_BUSY:busy?'1':'',WHITEBOARD_FIXTURE_EXIT_DELAY:slowHandoff?'1200':'300',WHITEBOARD_HANDOFF_WAIT_MS:slowHandoff?'150':'15000'};
  let child,currentBundle=bundle;const clients=[];
  t.after(async()=>{
    await Promise.allSettled(clients.map(client=>client.close()));
    let runtime;try{runtime=JSON.parse(await fs.readFile(path.join(data,'runtime.json'),'utf8'));}catch{}
    if(runtime?.pid&&runtime.pid!==child?.pid){
      try{await fetch(`http://127.0.0.1:${port}/api/runtime/stop`,{method:'POST',headers:{Authorization:`Bearer ${runtime.token}`,'Content-Type':'application/json'},body:'{}'});}catch{}
      for(let i=0;i<60;i++){try{process.kill(runtime.pid,0);}catch{break;}await sleep(50);}
    }
    if(child&&child.exitCode===null){const ended=once(child,'exit');child.kill('SIGTERM');await ended;}
    await fs.rm(root,{recursive:true,force:true});
  });
  if(staleLock){const lock=path.join(data,'runtime.lock');await fs.writeFile(lock,'');await fs.utimes(lock,new Date(0),new Date(0));}
  if(legacy){
    const old=removedCache?path.join(root,'cache/product-whiteboard/0.3.1'):path.join(root,'old package');await fs.mkdir(path.join(old,'server'),{recursive:true});await fs.mkdir(path.join(old,'.codex-plugin'));
    await fs.copyFile('tests/fixtures/legacy-runtime.mjs',path.join(old,'server/app.mjs'));
    await fs.writeFile(path.join(old,'.codex-plugin/plugin.json'),JSON.stringify({name:foreign?'unrelated-app':'product-whiteboard',version:'0.3.1'}));
    child=spawn(process.execPath,[path.join(old,'server/app.mjs'),'--serve'],{env,stdio:'ignore'});
    let ready=false;
    for(let i=0;i<100;i++){try{const runtime=JSON.parse(await fs.readFile(path.join(data,'runtime.json'),'utf8'));if(runtime.pid===child.pid){ready=true;break;}}catch{}await sleep(50);}
    assert.ok(ready,'legacy fixture started');
    if(removedCache){
      currentBundle=path.join(root,'cache/product-whiteboard',APP_VERSION);
      await fs.mkdir(path.join(currentBundle,'server'),{recursive:true});await fs.mkdir(path.join(currentBundle,'.codex-plugin'));
      for(const file of ['server/mcp.mjs','server/app.mjs','.codex-plugin/plugin.json'])await fs.copyFile(path.join(bundle,file),path.join(currentBundle,file));
      await fs.rm(old,{recursive:true});
    }
  }
  const connect=async()=>{
    const client=new Client({name:'runtime-regression',version:'1'});clients.push(client);
    await client.connect(new StdioClientTransport({command:process.execPath,args:[path.join(currentBundle,'server/mcp.mjs')],env}));return client;
  };
  return {data,port,child,connect};
}

test('a newer MCP upgrades an owned legacy backend after pending writes finish',async t=>{
  const f=await fixture(t,{legacy:true});const client=await f.connect();
  const opened=await client.callTool({name:'whiteboard_open',arguments:{boardId:'legacy'}});
  assert.equal(opened.isError,undefined);
  assert.equal(opened.structuredContent.board.goal,'legacy write completed');
  assert.equal(opened.structuredContent.board.title,'旧项目原文');
  const runtime=JSON.parse(await fs.readFile(path.join(f.data,'runtime.json'),'utf8'));
  assert.notEqual(runtime.pid,f.child.pid);assert.equal(f.child.exitCode,0);
  const session=JSON.parse(await fs.readFile(path.join(f.data,'active.json'),'utf8'));
  assert.equal(session.revision,2);assert.ok(session.generation>1);
  const health=await(await fetch(`http://127.0.0.1:${f.port}/api/health`)).json();
  assert.equal(health.appVersion,APP_VERSION);assert.ok(RUNTIME_CAPABILITIES.every(value=>health.capabilities.includes(value)));
});

test('a busy legacy backend is preserved and reports why an upgrade cannot proceed',async t=>{
  const f=await fixture(t,{legacy:true,busy:true});const client=await f.connect();
  const result=await client.callTool({name:'whiteboard_open',arguments:{boardId:'legacy'}});
  assert.equal(result.isError,true);assert.match(result.content[0].text,/正在讨论/);assert.equal(f.child.exitCode,null);
});

test('an installed sibling version can replace its daemon after Codex removes the old cache',async t=>{
  const f=await fixture(t,{legacy:true,removedCache:true});const client=await f.connect();
  const result=await client.callTool({name:'whiteboard_open',arguments:{boardId:'legacy'}});
  assert.equal(result.isError,undefined,JSON.stringify(result.content));assert.equal(result.structuredContent.board.goal,'legacy write completed');
  assert.equal(f.child.exitCode,0);
});

test('a process with an unrelated package manifest is never stopped',async t=>{
  const f=await fixture(t,{legacy:true,foreign:true});const client=await f.connect();
  const result=await client.callTool({name:'whiteboard_open',arguments:{boardId:'legacy'}});
  assert.equal(result.isError,true);assert.match(result.content[0].text,/无法确认/);assert.equal(f.child.exitCode,null);
});

test('an upgrade retry cannot start a second writer while the previous process is draining',async t=>{
  const f=await fixture(t,{legacy:true,slowHandoff:true});const client=await f.connect();
  const first=await client.callTool({name:'whiteboard_open',arguments:{boardId:'legacy'}});
  assert.equal(first.isError,true);assert.match(first.content[0].text,/仍在完成请求/);
  const second=await client.callTool({name:'whiteboard_open',arguments:{boardId:'legacy'}});
  assert.equal(second.isError,true);assert.equal(f.child.exitCode,null);
  assert.equal(JSON.parse(await fs.readFile(path.join(f.data,'runtime.json'),'utf8')).pid,f.child.pid);
  await once(f.child,'exit');
  const ready=await client.callTool({name:'whiteboard_open',arguments:{boardId:'legacy'}});
  assert.equal(ready.isError,undefined);assert.equal(ready.structuredContent.board.goal,'legacy write completed');
  await assert.rejects(fs.access(path.join(f.data,'runtime-handoff.json')),error=>error.code==='ENOENT');
});

test('concurrent MCP startup recovers an abandoned empty lock and shares one healthy runtime',async t=>{
  const f=await fixture(t,{staleLock:true});const clients=await Promise.all([f.connect(),f.connect(),f.connect()]);
  const results=await Promise.all(clients.map(client=>client.callTool({name:'whiteboard_list',arguments:{}})));
  assert.ok(results.every(result=>!result.isError));
  const first=JSON.parse(await fs.readFile(path.join(f.data,'runtime.json'),'utf8'));
  await Promise.all(clients.map(client=>client.callTool({name:'whiteboard_open',arguments:{boardId:'example'}})));
  const second=JSON.parse(await fs.readFile(path.join(f.data,'runtime.json'),'utf8'));
  assert.equal(first.pid,second.pid);assert.equal(second.appVersion,APP_VERSION);
  await assert.rejects(fs.access(path.join(f.data,'runtime.lock')),error=>error.code==='ENOENT');
});
