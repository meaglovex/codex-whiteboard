// Manual browser acceptance host: real MCP calls, isolated test storage, no Codex UI automation.
import http from 'node:http';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { spawn } from 'node:child_process';
import { build } from 'esbuild';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
const root=path.resolve('release/product-whiteboard'),data=path.resolve('.test-data/native-viewer');
await fs.mkdir(data,{recursive:true,mode:0o700});
const env={...process.env,WHITEBOARD_DATA_DIR:data,WHITEBOARD_PORT:'5322'};
const service=spawn(process.execPath,[path.join(root,'server/app.mjs'),'--serve'],{env,stdio:'ignore'});
const client=new Client({name:'whiteboard-panel-acceptance',version:'0.1.2'});
await client.connect(new StdioClientTransport({command:process.execPath,args:[path.join(root,'server/mcp.mjs')],env}));
const {tools}=await client.listTools(),entry=tools.find(t=>t.name==='whiteboard_open');
const output=await client.callTool({name:entry.name,arguments:{boardId:'example'}});
const {contents}=await client.readResource({uri:entry._meta.ui.resourceUri});
const bundle=await build({stdin:{contents:`
import {AppBridge,PostMessageTransport} from '@modelcontextprotocol/ext-apps/app-bridge';
const frame=document.querySelector('iframe');
const boot=await(await fetch('/boot')).json();
const bridge=new AppBridge(null,{name:'Native panel acceptance host',version:'0.1.2'},{serverTools:{},logging:{}});
bridge.oncalltool=async params=>{const response=await fetch('/tool',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(params)});if(!response.ok)throw new Error('MCP forwarding failed');return response.json();};
bridge.oninitialized=async()=>{await bridge.sendToolInput({arguments:{boardId:'example'}});await bridge.sendToolResult(boot.output);document.querySelector('#status').textContent='MCP Apps bridge connected · real isolated data';};
await bridge.connect(new PostMessageTransport(frame.contentWindow,frame.contentWindow));
frame.srcdoc=boot.html;
`,resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'browser'});
const host=http.createServer(async(req,res)=>{
  if(req.headers.host!=='127.0.0.1:5321'){res.writeHead(403).end();return;}
  res.setHeader('Cache-Control','no-store');
  if(req.url==='/boot'&&req.method==='GET'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({html:contents[0].text,output}));return;}
  if(req.url==='/host.js'&&req.method==='GET'){res.setHeader('Content-Type','application/javascript');res.end(bundle.outputFiles[0].text);return;}
  if(req.url==='/tool'&&req.method==='POST'){
    if(req.headers.origin!=='http://127.0.0.1:5321'){res.writeHead(403).end();return;}
    try{let body='';for await(const chunk of req){body+=chunk;if(body.length>9000000)throw new Error('Too large');}const input=JSON.parse(body);if(input.name!=='whiteboard_ui_request')throw new Error('Only the panel bridge is allowed');const result=await client.callTool(input,undefined,{timeout:240000});res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));}catch{res.writeHead(400).end();}return;
  }
  if(req.url!=='/'||req.method!=='GET'){res.writeHead(404).end();return;}
  res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><meta charset="utf-8"><title>Product Whiteboard · MCP panel acceptance</title><style>html,body{margin:0;height:100%;font:12px system-ui}#status{height:28px;padding:0 14px;line-height:28px;background:#eef1e9;color:#435641}iframe{border:0;width:100%;height:calc(100% - 28px)}</style></head><body><div id="status">Connecting the real MCP Apps bridge…</div><iframe title="产品白板 MCP 面板" sandbox="allow-scripts allow-forms allow-downloads"></iframe><script type="module" src="/host.js"></script></body></html>');
});
await new Promise(resolve=>host.listen(5321,'127.0.0.1',resolve));
console.log('MCP panel acceptance host: http://127.0.0.1:5321 (isolated storage)');
async function stop(){host.close();await client.close();service.kill('SIGTERM');process.exit(0);}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
