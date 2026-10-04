import { spawn, execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { once } from 'node:events';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
process.env.WHITEBOARD_PORT ||= '5220';
process.env.WHITEBOARD_DATA_DIR ||= path.join(root,'.test-data/development');
execFileSync(process.platform==='win32'?'npm.cmd':'npm',['run','build:plugin'],{cwd:root,stdio:'inherit'});
const backend=spawn(process.execPath,[path.join(root,'release/product-whiteboard/server/app.mjs'),'--serve'],{cwd:root,env:process.env,stdio:'inherit'});
let vite,stopping=false;
async function stop(){
  if(stopping)return;stopping=true;
  await vite?.close();
  if(backend.exitCode===null){const ended=once(backend,'exit');backend.kill('SIGTERM');await ended;}
}
process.on('SIGINT',()=>void stop());process.on('SIGTERM',()=>void stop());
try{
  let ready=false;
  for(let i=0;i<100;i++){
    if(backend.exitCode!==null)throw new Error(`开发后台未启动，请检查端口 ${process.env.WHITEBOARD_PORT}。`);
    try{
      const response=await fetch(`http://127.0.0.1:${process.env.WHITEBOARD_PORT}/api/health`,{signal:AbortSignal.timeout(800)});
      const runtime=JSON.parse(await fs.readFile(path.join(process.env.WHITEBOARD_DATA_DIR,'runtime.json'),'utf8'));
      if(response.ok&&runtime.pid===backend.pid){ready=true;break;}
    }catch{}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  if(!ready)throw new Error('开发后台启动超时。');
  vite=await createServer({root});await vite.listen();vite.printUrls();
}catch(error){await stop();throw error;}
