import { promises as fs } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dataRoot } from './store.mjs';
const port=Number(process.env.WHITEBOARD_PORT||5210);
export async function ensureRuntime(){
  async function ready(){try{const r=await fetch(`http://127.0.0.1:${port}/api/health`,{signal:AbortSignal.timeout(1200)});const x=await r.json();if(x.name==='product-whiteboard'&&x.version==='0.1.1'){const state=JSON.parse(await fs.readFile(path.join(dataRoot,'runtime.json'),'utf8'));if(state.port===port)return state;}}catch{}return null;}
  let state=await ready();if(state)return state;
  const child=spawn(process.execPath,[path.join(path.dirname(fileURLToPath(import.meta.url)),'app.mjs'),'--serve'],{detached:true,stdio:'ignore',env:process.env});child.unref();
  for(let i=0;i<60;i++){await new Promise(r=>setTimeout(r,100));state=await ready();if(state)return state;}
  throw new Error('本机白板未能启动，可能是端口 5210 被其他应用占用。');
}
export async function request(route,method='GET',value){const r=await ensureRuntime();const response=await fetch(`http://127.0.0.1:${r.port}${route}`,{method,headers:{Authorization:`Bearer ${r.token}`,...(value?{'Content-Type':'application/json'}:{})},body:value?JSON.stringify(value):undefined});const result=await response.json();if(!response.ok)throw new Error(result.error||'白板操作失败');return result;}
