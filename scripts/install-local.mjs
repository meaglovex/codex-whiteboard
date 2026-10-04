import {execFileSync} from 'node:child_process';
import {promises as fs} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const codex=process.env.WHITEBOARD_CODEX_BIN||'codex';
const port=Number(process.env.WHITEBOARD_PORT||5210);
async function health(){try{return await(await fetch(`http://127.0.0.1:${port}/api/health`,{signal:AbortSignal.timeout(800)})).json();}catch{return null;}}
if((await health())?.busyBoards?.length)throw new Error('白板正在讨论，等待讨论结束后再安装更新。');
execFileSync(process.platform==='win32'?'npm.cmd':'npm',['run','build:plugin'],{cwd:root,stdio:'inherit'});
const cli=args=>JSON.parse(execFileSync(codex,[...args,'--json'],{cwd:root,encoding:'utf8'}));
cli(['plugin','marketplace','add',root]);
const receipt=cli(['plugin','add','product-whiteboard@product-whiteboard-local']);
const installed=receipt.installedPath;
if(!installed)throw new Error('Codex 未返回安装目录。');
for(const file of ['ui/index.html','server/app.mjs','server/mcp.mjs','server/runtime.mjs','.codex-plugin/plugin.json','.mcp.json','skills/product-whiteboard/SKILL.md','skills/product-whiteboard/references/development-progress.md','skills/product-whiteboard/agents/openai.yaml','README.md','PRIVACY.md','THIRD_PARTY_NOTICES.txt']){
  const hash=async p=>createHash('sha256').update(await fs.readFile(p)).digest('hex');
  if(await hash(path.join(installed,file))!==await hash(path.join(root,'release/product-whiteboard',file)))throw new Error('已安装文件与构建不一致：'+file);
}
const {ensureRuntime}=await import(pathToFileURL(path.join(installed,'server/runtime.mjs')).href);
await ensureRuntime({refresh:true});
const client=new Client({name:'product-whiteboard-local-installer',version:'0.4.0'});
try{
  await client.connect(new StdioClientTransport({command:process.execPath,args:['./server/mcp.mjs'],cwd:installed,env:{...process.env}}));
  const opened=await client.callTool({name:'whiteboard_open',arguments:{}});
  if(opened.isError)throw new Error('已安装的白板工具调用失败。');
  console.log(JSON.stringify({pluginId:receipt.pluginId,version:receipt.version,installedPath:installed,url:opened.structuredContent.url,filesMatch:true},null,2));
}finally{await client.close();}
