import http from 'node:http';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { atomicWrite, createBoard, listBoards, getBoard, saveBoard, changeBoard, getPreferences, setPreferences, exportBoard, dataRoot, getActiveSession, beginSession, activateBoard } from './store.mjs';
import { syncConversation } from '../shared/sync.mjs';
import { brainstorm } from './model.mjs';
import { parseBoard, cardSchema } from './schema.mjs';

export const packageRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const busy=new Set();
function json(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));}
async function body(req){let buf=Buffer.alloc(0);for await(const chunk of req){buf=Buffer.concat([buf,chunk]);if(buf.length>9000000){const e=new Error('白板数据超过 9 MB');e.status=413;throw e;}}try{return JSON.parse(buf.toString());}catch{throw new Error('无效的 JSON');}}
function blank(title,goal=''){return {version:1,id:randomUUID(),title,goal,inspirations:[],nodes:[],edges:[],messages:[]};}

export async function startHttp(port=5210){
  await fs.mkdir(dataRoot,{recursive:true,mode:0o700});
  if(!(await listBoards()).length){const example=JSON.parse(await fs.readFile(path.join(packageRoot,'example.json'),'utf8'));await createBoard(example);}
  const token=randomBytes(32).toString('hex');
  const server=http.createServer(async(req,res)=>{
    const expected=`127.0.0.1:${port}`,host=req.headers.host;
    if(host!==expected&&host!==`localhost:${port}`){json(res,403,{error:'拒绝不匹配的主机'});return;}
    const url=new URL(req.url,`http://${expected}`);
    if(req.headers.origin&&!['http://'+expected,`http://localhost:${port}`,'http://127.0.0.1:5199'].includes(req.headers.origin)){json(res,403,{error:'拒绝跨站访问'});return;}
    if(req.headers['sec-fetch-site']==='cross-site'){json(res,403,{error:'拒绝跨站访问'});return;}
    try{
      if(url.pathname==='/api/health'){json(res,200,{name:'product-whiteboard',version:'0.1.2',busyBoards:[...busy]});return;}
      if(!url.pathname.startsWith('/api/')){
        if(req.method!=='GET'||url.pathname!=='/'){json(res,404,{error:'页面不存在'});return;}
        res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Set-Cookie':`whiteboard_session=${token}; HttpOnly; SameSite=Strict; Path=/`,'Content-Security-Policy':"default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'"});res.end(await fs.readFile(path.join(packageRoot,'ui/index.html')));return;
      }
      const auth=req.headers.authorization===`Bearer ${token}`||req.headers.cookie?.split(';').some(c=>c.trim()===`whiteboard_session=${token}`);
      if(!auth){json(res,401,{error:'请从本机白板页面重新打开'});return;}
      if(['POST','PUT','PATCH'].includes(req.method)&&!req.headers['content-type']?.startsWith('application/json')){json(res,415,{error:'请求需要 JSON 内容'});return;}
      if(url.pathname==='/api/session'&&req.method==='GET'){json(res,200,await getActiveSession());return;}
      if(url.pathname==='/api/session/begin'&&req.method==='POST'){json(res,200,await beginSession(await body(req)));return;}
      if(url.pathname==='/api/boards'&&req.method==='GET'){json(res,200,await listBoards());return;}
      if(url.pathname==='/api/boards'&&req.method==='POST'){const input=await body(req);json(res,201,await createBoard(input.board?parseBoard(input.board):{...blank(input.title||'新的产品',input.goal||''),inspirations:input.inspirations||[]}));return;}
      if(url.pathname==='/api/preferences'){
        if(req.method==='GET')json(res,200,await getPreferences());else if(req.method==='PUT')json(res,200,await setPreferences(await body(req)));else json(res,405,{error:'不支持的操作'});return;
      }
      const match=/^\/api\/boards\/([a-zA-Z0-9-]+)(?:\/(chat|apply|export|sync))?$/.exec(url.pathname);
      if(!match){json(res,404,{error:'接口不存在'});return;}
      const [,id,action]=match;
      if(!action&&req.method==='GET'){json(res,200,{...await getBoard(id),busy:busy.has(id)});return;}
      if(!action&&req.method==='PUT'){const input=await body(req);json(res,200,await saveBoard(id,input.base,input.board,input.revision));return;}
      if(action==='export'&&req.method==='POST'){json(res,200,await exportBoard(id));return;}
      if(action==='sync'&&req.method==='POST'){const input=await body(req);const state=await changeBoard(id,b=>syncConversation(b,input));await activateBoard(id);json(res,200,state);return;}
      if(action==='apply'&&req.method==='POST'){
        const {operations}=await body(req);if(!Array.isArray(operations)||operations.length>100)throw new Error('无效的变更操作');
        const state=await changeBoard(id,b=>{
          for(const op of operations){
            if(op.action==='add'){const card=cardSchema.parse(op.card);b.nodes.push({id:op.nodeId||randomUUID(),type:'boardCard',dragHandle:'.drag-handle',position:op.position||{x:164+b.nodes.length%3*360,y:156+Math.floor(b.nodes.length/3)*300},data:card});}
            else if(op.action==='remove'){b.nodes=b.nodes.filter(n=>n.id!==op.nodeId);b.edges=b.edges.filter(e=>e.source!==op.nodeId&&e.target!==op.nodeId);}
            else if(op.action==='update'||op.action==='pin'){const n=b.nodes.find(n=>n.id===op.nodeId);if(!n)throw new Error('节点不存在');n.data=op.action==='pin'?{...n.data,pinned:op.pinned}:cardSchema.parse({...n.data,...op.card});}
            else if(op.action==='message'){if(!['ai','user'].includes(op.role)||typeof op.text!=='string')throw new Error('无效的讨论');b.messages.push({id:randomUUID(),role:op.role,text:op.text,createdAt:new Date().toISOString()});}
            else throw new Error('未知变更操作');
          }return b;
        });await activateBoard(id);json(res,200,state);return;
      }
      if(action==='chat'&&req.method==='POST'){
        if(busy.has(id)){json(res,409,{error:'这一轮还在讨论，请稍候'});return;}
        const input=await body(req);if(typeof input.text!=='string'||!input.text.trim()||input.text.length>6000)throw new Error('请填写 6000 字以内的讨论内容');
        busy.add(id);
        try{const current=await changeBoard(id,b=>{b.messages.push({id:randomUUID(),role:'user',text:input.text,createdAt:new Date().toISOString()});return b;});
          const message=await brainstorm(current.board,await getPreferences(),input.text,path.join(packageRoot,'assets'));
          const state=await changeBoard(id,b=>{b.messages.push(message);return b;});json(res,200,state);
        }finally{busy.delete(id);}return;
      }
      json(res,405,{error:'不支持的操作'});
    }catch(e){json(res,e.status||400,{error:e.name==='ZodError'?'白板数据格式不完整，请检查内容':e.message||'操作失败'});}
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  await atomicWrite(path.join(dataRoot,'runtime.json'),{port,pid:process.pid,token,version:'0.1.2'});
  return server;
}
if(process.argv.includes('--serve')){
  startHttp(Number(process.env.WHITEBOARD_PORT||5210)).then(server=>{const stop=()=>server.close(()=>process.exit(0));process.on('SIGTERM',stop);process.on('SIGINT',stop);}).catch(()=>process.exit(1));
}
