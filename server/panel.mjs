import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { request } from './runtime.mjs';

export const panelUri = 'ui://product-whiteboard/board-v0.1.2.html';
export async function panelResource() {
  const html = await fs.readFile(path.join(path.dirname(fileURLToPath(import.meta.url)), '../ui/index.html'), 'utf8');
  return { contents: [{
    uri: panelUri,
    mimeType: 'text/html;profile=mcp-app',
    text: html.replace('<head>', '<head><script>window.__PRODUCT_WHITEBOARD_MCP__=true;</script>'),
    _meta: { ui: { prefersBorder: false, csp: { connectDomains: [], resourceDomains: [] } } },
  }] };
}

export async function panelRequest({ route, method = 'GET', value }) {
  const collection = route === '/api/boards' && ['GET', 'POST'].includes(method);
  const preferences = route === '/api/preferences' && ['GET', 'PUT'].includes(method);
  const session = route === '/api/session' && method === 'GET';
  const board = /^\/api\/boards\/([a-zA-Z0-9-]{1,100})(?:\/(chat|export))?$/.exec(route);
  const boardOperation = board && (board[2] ? method === 'POST' : ['GET', 'PUT'].includes(method));
  if (!collection && !preferences && !boardOperation && !session) throw new Error('面板不允许访问这个接口');
  if (method === 'GET' && value !== undefined) throw new Error('读取请求不能附带写入数据');
  return { content: [], structuredContent: { data: await request(route, method, value) } };
}
