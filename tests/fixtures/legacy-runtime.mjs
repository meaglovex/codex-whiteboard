// A pre-handoff server: old wire version, authenticated session, no new APIs.
import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
const port=Number(process.env.WHITEBOARD_PORT),data=process.env.WHITEBOARD_DATA_DIR;
const token=randomBytes(32).toString('hex');
const board={version:1,id:'legacy',title:'旧项目原文',goal:'before handoff',inspirations:[],nodes:[],edges:[],messages:[]};
await fs.mkdir(path.join(data,'boards'),{recursive:true});
await fs.writeFile(path.join(data,'boards/legacy.json'),JSON.stringify({board,revision:1,updatedAt:new Date().toISOString()}),{mode:0o600});
await fs.writeFile(path.join(data,'active.json'),JSON.stringify({boardId:'legacy',revision:1,generation:1}),{mode:0o600});
const server=http.createServer((req,res)=>{
  res.setHeader('Content-Type','application/json');
  if(req.url==='/api/health'){res.end(JSON.stringify({name:'product-whiteboard',version:'0.1.2',appVersion:'0.3.1',busyBoards:process.env.WHITEBOARD_FIXTURE_BUSY?['legacy']:[]}));return;}
  if(req.headers.authorization!==`Bearer ${token}`){res.writeHead(401);res.end('{}');return;}
  if(req.url==='/api/session'){res.end(JSON.stringify({boardId:'legacy',revision:1,generation:1}));return;}
  res.writeHead(404);res.end(JSON.stringify({error:'接口不存在'}));
});
await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));
await fs.writeFile(path.join(data,'runtime.json'),JSON.stringify({port,pid:process.pid,token,version:'0.1.2'}),{mode:0o600});
process.on('SIGTERM',()=>{
  server.close();
  setTimeout(async()=>{
    board.goal='legacy write completed';
    await fs.writeFile(path.join(data,'boards/legacy.json'),JSON.stringify({board,revision:2,updatedAt:new Date().toISOString()}),{mode:0o600});
    process.exit(0);
  },Number(process.env.WHITEBOARD_FIXTURE_EXIT_DELAY||0));
});
