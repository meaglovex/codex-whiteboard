import { promises as fs } from 'node:fs';
import path from 'node:path';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { atomicWrite, dataRoot } from './store.mjs';
import { APP_VERSION, WIRE_VERSION, RUNTIME_CAPABILITIES } from '../shared/version.mjs';

const port=Number(process.env.WHITEBOARD_PORT||5210);
const origin=`http://127.0.0.1:${port}`;
const entrypoint=path.join(path.dirname(fileURLToPath(import.meta.url)),'app.mjs');
const run=promisify(execFile);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const alive=pid=>{try{process.kill(pid,0);return true;}catch(error){return error.code==='EPERM';}};
const handoffFile=path.join(dataRoot,'runtime-handoff.json');
const handoffWait=Math.min(15000,Math.max(100,Number(process.env.WHITEBOARD_HANDOFF_WAIT_MS)||15000));
async function ended(pid){
  if(!alive(pid))return true;
  if(process.platform==='darwin'||process.platform==='linux'){
    try{return /^Z/.test((await run('ps',['-p',String(pid),'-o','stat='])).stdout.trim());}catch{return !alive(pid);}
  }
  return false;
}
async function readHandoff(){try{return JSON.parse(await fs.readFile(handoffFile,'utf8'));}catch(error){if(error.code==='ENOENT')return null;throw error;}}
async function clearHandoff(nonce){const current=await readHandoff();if(current?.nonce===nonce)await fs.unlink(handoffFile);}
async function waitForHandoff(marker){
  const deadline=Date.now()+handoffWait;
  do{if(await ended(marker.pid)){await clearHandoff(marker.nonce);return;}await sleep(100);}while(Date.now()<deadline);
  throw new Error('旧后台仍在完成请求，请稍后重试；没有强制终止或启动第二个写入进程。');
}
function compareVersions(a,b){const left=String(a||'0').split('.').map(Number),right=b.split('.').map(Number);for(let i=0;i<3;i++){const delta=(left[i]||0)-(right[i]||0);if(delta)return delta;}return 0;}
function compatible(health){return health.version===WIRE_VERSION&&compareVersions(health.appVersion,APP_VERSION)>=0&&RUNTIME_CAPABILITIES.every(value=>health.capabilities?.includes(value));}

async function inspect(){
  let response;
  try{response=await fetch(origin+'/api/health',{signal:AbortSignal.timeout(1200)});}catch{return null;}
  let health;try{health=await response.json();}catch{throw new Error(`端口 ${port} 被其他应用占用。`);}
  if(!response.ok||health.name!=='product-whiteboard')throw new Error(`端口 ${port} 被其他应用占用。`);
  let state;
  try{state=JSON.parse(await fs.readFile(path.join(dataRoot,'runtime.json'),'utf8'));}catch{return {health};}
  if(state.port!==port||!Number.isInteger(state.pid)||state.pid<=0||typeof state.token!=='string')return {health};
  try{
    const auth=await fetch(origin+'/api/session',{headers:{Authorization:`Bearer ${state.token}`},signal:AbortSignal.timeout(1200)});
    await auth.arrayBuffer();if(!auth.ok)return {health};
  }catch{return {health};}
  return {health,state};
}

async function withLock(action){
  await fs.mkdir(dataRoot,{recursive:true,mode:0o700});
  const file=path.join(dataRoot,'runtime.lock'),nonce=randomUUID();
  for(let i=0;i<200;i++){
    try{const handle=await fs.open(file,'wx',0o600);try{await handle.writeFile(JSON.stringify({pid:process.pid,nonce}));}finally{await handle.close();}break;}
    catch(error){
      if(error.code!=='EEXIST')throw error;
      try{
        const lock=JSON.parse(await fs.readFile(file,'utf8'));
        if(Number.isInteger(lock.pid)&&lock.pid>0&&await ended(lock.pid)){await fs.unlink(file);continue;}
      }catch(error){if(error.code==='ENOENT')continue;try{const stat=await fs.stat(file);if(Date.now()-stat.mtimeMs>30000&&stat.size===0){await fs.unlink(file);continue;}}catch{}}
      if(i===199)throw new Error('另一进程正在启动或升级白板，请稍后重试。');
      await sleep(100);
    }
  }
  try{return await action();}finally{try{const lock=JSON.parse(await fs.readFile(file,'utf8'));if(lock.nonce===nonce)await fs.unlink(file);}catch{}}
}

async function verifiedLegacyEntrypoint(state){
  if(state.pid===process.pid)throw new Error('不能停止当前调用进程。');
  let arguments_;
  if(process.platform==='linux')arguments_=(await fs.readFile(`/proc/${state.pid}/cmdline`,'utf8')).split('\0');
  else if(process.platform==='darwin'){
    const [{stdout:command},{stdout:executable}]=await Promise.all([run('ps',['-ww','-p',String(state.pid),'-o','command=']),run('ps',['-p',String(state.pid),'-o','comm='])]);
    const full=command.trim(),prefix=executable.trim();
    const tail=full.startsWith(prefix+' ')?full.slice(prefix.length+1):full.replace(/^\S+\s+/,'');
    const end=tail.lastIndexOf(' --serve');
    arguments_=end<0?[]:[tail.slice(0,end),'--serve'];
  }else throw new Error('旧后台需要退出后再升级；无法安全确认该平台的旧进程。');
  const script=arguments_.find(value=>path.isAbsolute(value)&&path.basename(value)==='app.mjs'&&path.basename(path.dirname(value))==='server');
  if(!script||!arguments_.includes('--serve'))throw new Error('无法确认旧白板进程归属，已保留该进程。');
  const legacyRoot=path.dirname(path.dirname(script));
  try{
    const manifest=JSON.parse(await fs.readFile(path.join(legacyRoot,'.codex-plugin/plugin.json'),'utf8'));
    if(manifest.name!=='product-whiteboard')throw new Error('无法确认旧白板进程归属，已保留该进程。');
  }catch(error){
    if(error.code!=='ENOENT')throw error;
    // Codex can remove the previous version's cache before the old daemon exits.
    // Only accept a sibling version of this verified installed plugin, after the
    // data-directory token has authenticated the server in inspect().
    const currentRoot=path.dirname(path.dirname(entrypoint));
    const current=JSON.parse(await fs.readFile(path.join(currentRoot,'.codex-plugin/plugin.json'),'utf8'));
    const [legacyFamily,currentFamily]=await Promise.all([fs.realpath(path.dirname(legacyRoot)),fs.realpath(path.dirname(currentRoot))]);
    const sameFamily=legacyFamily===currentFamily;
    if(current.name!=='product-whiteboard'||path.basename(currentRoot)!==current.version||!sameFamily||!/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(path.basename(legacyRoot)))throw new Error('无法确认旧白板进程归属，已保留该进程。');
  }
  return script;
}

async function stopPrevious({health,state}){
  if(!state)throw new Error('无法核实当前后台与数据目录的对应关系，请检查白板服务。');
  if(health.busyBoards?.length)throw new Error('白板正在讨论，暂时不能升级后台。');
  if(compareVersions(health.appVersion,APP_VERSION)>0)throw new Error('当前后台版本较新但接口不兼容，请更新插件。');
  const graceful=health.capabilities?.includes('graceful-stop-v1');
  if(!graceful)await verifiedLegacyEntrypoint(state);
  const marker={pid:state.pid,nonce:randomUUID()};
  // A retry after this caller exits must still wait for the old writer to finish.
  await atomicWrite(handoffFile,marker);
  if(graceful){
    const response=await fetch(origin+'/api/runtime/stop',{method:'POST',headers:{Authorization:`Bearer ${state.token}`,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(2000)});
    const result=await response.json();if(!response.ok){await clearHandoff(marker.nonce);throw new Error(result.error||'后台暂时不能退出。');}
  }else{
    try{process.kill(state.pid,'SIGTERM');}catch(error){if(error.code!=='ESRCH')throw error;}
  }
  // Wait for in-flight writes to finish, not merely for the listening port to close.
  await waitForHandoff(marker);
}

async function ensure(refresh){
  const running=await inspect();
  if(!refresh&&running?.state&&compatible(running.health)&&!await readHandoff())return running.state;
  return withLock(async()=>{
    let previous=await inspect();
    for(let i=0;previous&&!previous.state&&i<20;i++){await sleep(100);previous=await inspect();}
    const handoff=await readHandoff();
    if(handoff){
      if(await ended(handoff.pid))await clearHandoff(handoff.nonce);
      else if(previous?.state?.pid===handoff.pid){await stopPrevious(previous);previous=null;}
      else{await waitForHandoff(handoff);previous=await inspect();}
    }
    if(!refresh&&previous?.state&&compatible(previous.health))return previous.state;
    if(previous)await stopPrevious(previous);
    const child=spawn(process.execPath,[entrypoint,'--serve'],{detached:true,stdio:'ignore',env:process.env});
    let failed;child.on('error',error=>{failed=error;});child.unref();
    for(let i=0;i<100;i++){
      await sleep(100);
      const current=await inspect();
      if(current?.state&&compatible(current.health))return current.state;
      if(failed||child.exitCode!==null)throw new Error('白板后台启动失败，请检查插件安装文件。');
    }
    throw new Error(`本机白板未能启动，请检查端口 ${port} 和数据目录。`);
  });
}
let pending;
export function ensureRuntime({refresh=false}={}){if(!pending)pending=ensure(refresh).finally(()=>{pending=undefined;});return pending;}
export async function request(route,method='GET',value){
  const runtime=await ensureRuntime();
  const response=await fetch(`http://127.0.0.1:${runtime.port}${route}`,{method,headers:{Authorization:`Bearer ${runtime.token}`,...(value!==undefined?{'Content-Type':'application/json'}:{})},body:value!==undefined?JSON.stringify(value):undefined});
  const result=await response.json();if(!response.ok)throw new Error(result.error||'白板操作失败');return result;
}
