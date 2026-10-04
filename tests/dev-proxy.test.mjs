import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'vite';
import { loopbackDevBoundary, whiteboardDevProxy } from '../scripts/dev-proxy.mjs';
async function freePort(){const server=net.createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const port=server.address().port;await new Promise(resolve=>server.close(resolve));return port;}

test('a fresh dev session can authenticate and save while foreign origins remain blocked',async t=>{
  const data=await fs.mkdtemp(path.join(os.tmpdir(),'whiteboard-dev-proxy-')),backendPort=await freePort(),frontendPort=await freePort();
  const backend=spawn(process.execPath,[path.resolve('release/product-whiteboard/server/app.mjs'),'--serve'],{env:{...process.env,WHITEBOARD_PORT:String(backendPort),WHITEBOARD_DATA_DIR:data},stdio:'ignore'});
  let vite;
  t.after(async()=>{await vite?.close();if(backend.exitCode===null){const ended=once(backend,'exit');backend.kill('SIGTERM');await ended;}await fs.rm(data,{recursive:true,force:true});});
  let ready=false;
  for(let i=0;i<100;i++){try{const state=JSON.parse(await fs.readFile(path.join(data,'runtime.json'),'utf8'));if(state.pid===backend.pid){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,50));}
  assert.ok(ready);
  vite=await createServer({configFile:false,logLevel:'silent',plugins:[loopbackDevBoundary()],optimizeDeps:{noDiscovery:true,include:[]},server:{host:'127.0.0.1',port:frontendPort,strictPort:true,proxy:{'/api':whiteboardDevProxy(`http://127.0.0.1:${backendPort}`)}}});
  await vite.listen();const origin=`http://127.0.0.1:${frontendPort}`;
  const bootstrap=await fetch(origin+'/api/session/bootstrap');assert.equal(bootstrap.status,200);
  const cookie=bootstrap.headers.get('set-cookie').split(';')[0];
  const saved=await fetch(origin+'/api/boards',{method:'POST',headers:{Cookie:cookie,Origin:origin,'Sec-Fetch-Site':'same-origin','Content-Type':'application/json'},body:JSON.stringify({title:'Development API'})});
  assert.equal(saved.status,201);assert.equal((await saved.json()).board.title,'Development API');
  const loaded=await fetch(origin+'/api/boards',{headers:{Cookie:cookie}});assert.equal(loaded.status,200);
  assert.ok((await loaded.json()).some(board=>board.title==='Development API'));
  for(const headers of [{Origin:'https://example.com'},{'Sec-Fetch-Site':'cross-site'}]){
    const denied=await fetch(origin+'/api/session/bootstrap',{headers});assert.equal(denied.status,403,Object.keys(headers)[0]);assert.equal(denied.headers.get('set-cookie'),null);
  }
  // fetch normalizes Host; use the HTTP transport to send the actual forged header.
  const rebound=await new Promise((resolve,reject)=>{const req=http.get({hostname:'127.0.0.1',port:frontendPort,path:'/api/session/bootstrap',headers:{Host:'evil.example'}},res=>{res.resume();resolve({status:res.statusCode,cookie:!!res.headers['set-cookie']});});req.on('error',reject);});
  assert.equal(rebound.status,403);assert.equal(rebound.cookie,false);
});
