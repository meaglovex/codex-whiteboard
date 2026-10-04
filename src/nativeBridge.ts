import { App } from '@modelcontextprotocol/ext-apps';
import { setHostTheme } from './theme';

declare global { interface Window { __PRODUCT_WHITEBOARD_MCP__?: boolean } }
export const inNativePanel = window.__PRODUCT_WHITEBOARD_MCP__ === true;
const app = inNativePanel ? new App({ name: '产品白板', version: '0.3.1' }, {}, { autoResize: false }) : undefined;
let boardId: string | undefined;
let finishInitial: (() => void) | undefined;
const initial = new Promise<void>(resolve => { finishInitial = resolve; });
if (app) {
  app.onhostcontextchanged = context => { if (context.theme) setHostTheme(context.theme); };
  app.ontoolinput = ({ arguments: input }) => {
    if (typeof input?.boardId === 'string') boardId = input.boardId;
  };
  app.ontoolresult = result => {
    const board = result.structuredContent?.board;
    if (board && typeof board === 'object' && 'id' in board && typeof board.id === 'string') boardId = board.id;
    finishInitial?.();
  };
}
const connection = app?.connect(undefined, { timeout: 15000 });
void connection?.then(() => setHostTheme(app?.getHostContext()?.theme)).catch(() => {});

export async function initialBoardId() {
  if (!app) {
    let previous: string | null = null;
    try { previous = localStorage.getItem('whiteboard-last-id'); } catch { /* sandboxed storage */ }
    return new URLSearchParams(location.search).get('board') || previous;
  }
  await connection;
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([initial, new Promise<void>(resolve => { timer = setTimeout(resolve, 1500); })]);
  if (timer) clearTimeout(timer);
  return boardId;
}

export async function panelRequest<T>(route: string, method: string, value?: unknown): Promise<T> {
  if (!app) throw new Error('白板面板未连接');
  await connection;
  const result = await app.callServerTool({
    name: 'whiteboard_ui_request',
    arguments: { route, method, ...(value === undefined ? {} : { value }) },
  }, { timeout: 240000 });
  if (result.isError) {
    const detail = result.content.find(item => item.type === 'text');
    throw new Error(detail?.type === 'text' ? detail.text : '白板操作失败');
  }
  if (!result.structuredContent || !('data' in result.structuredContent)) throw new Error('白板返回的数据不完整');
  return result.structuredContent.data as T;
}
