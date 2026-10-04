import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { BoardState } from './model';
import { inNativePanel, initialBoardId, panelRequest, subscribeNativeSelection, getNativeSelection } from './nativeBridge';
import { useI18n } from './i18n';

type Saved = { board: BoardState; revision: number; updatedAt?: string };
type Active = { boardId: string | null; revision?: number; generation: number };
export type BoardSummary = { id: string; title: string; goal: string; example?: boolean; phase?: 'discovery' | 'development'; projectPath?: string; progressUpdatedAt?: string };
let bootstrap: Promise<void> | undefined;
let sessionReady = false;
function bootstrapSession() {
  if (sessionReady) return Promise.resolve();
  if (!bootstrap) bootstrap = fetch('/api/session/bootstrap', { signal: AbortSignal.timeout(15000) }).then(async response => {
    if (!response.ok) throw new Error('请从本机白板页面重新打开');
    await response.arrayBuffer(); sessionReady = true;
  }).finally(() => { bootstrap = undefined; });
  return bootstrap;
}
export async function api<T>(route: string, method = 'GET', value?: unknown): Promise<T> {
  if (inNativePanel) return panelRequest<T>(route, method, value);
  await bootstrapSession();
  const send = () => fetch(route, { method, headers: value === undefined ? {} : { 'Content-Type': 'application/json' }, body: value === undefined ? undefined : JSON.stringify(value), signal: AbortSignal.timeout(15000) });
  let response = await send();
  if (response.status === 401) { await response.arrayBuffer(); sessionReady = false; await bootstrapSession(); response = await send(); }
  let result;
  try { result = await response.json(); } catch { throw new Error(response.status >= 500 ? 'Failed to fetch' : '白板返回的数据不完整'); }
  if (!response.ok) throw new Error(result.error || '操作失败');
  return result;
}
const waiting: BoardState = { version: 1, id: 'waiting', title: '', goal: '', inspirations: [], nodes: [], edges: [], messages: [] };
export default function useBoard() {
  const { t, locale } = useI18n();
  const nativeSelection = useSyncExternalStore(subscribeNativeSelection, getNativeSelection, getNativeSelection);
  const [board, setBoard] = useState<BoardState>(waiting), [boards, setBoards] = useState<BoardSummary[]>([]);
  const [ready, setReady] = useState(false), [error, setError] = useState(''), [revision, setRevision] = useState(0), [following, setFollowing] = useState(true);
  const current = useRef<Saved>({ board: waiting, revision: 0 }), followRef = useRef(true), generation = useRef(-1), requestSerial = useRef(0);
  const accept = useCallback((state: Saved) => {
    const previousId = current.current.board.id;
    current.current = state; setBoard(state.board); setRevision(state.revision); setError('');
    if (!inNativePanel) {
      const url = new URL(location.href); url.searchParams.set('board', state.board.id);
      if (previousId !== 'waiting' && previousId !== state.board.id) { url.searchParams.delete('view'); url.searchParams.delete('milestone'); }
      window.history.replaceState(null, '', url);
    }
  }, []);
  useEffect(() => { document.title = board.id === 'waiting' ? t('appName') : `${t('appName')} · ${board.title}`; }, [board.id, board.title, t]);
  useEffect(() => {
    let disposed = false, retry: ReturnType<typeof setTimeout> | undefined, attempts = 0;
    const serial = ++requestSerial.current;
    setReady(false);
    const valid = () => !disposed && serial === requestSerial.current;
    const load = async () => {
      try {
        const [list, active, desired] = await Promise.all([api<BoardSummary[]>('/api/boards'), api<Active>('/api/session'), initialBoardId()]);
        if (!valid()) return;
        if (desired && !/^[a-zA-Z0-9-]{1,100}$/.test(desired)) throw new Error('白板不存在');
        const id = desired || active.boardId;
        const state = id ? await api<Saved>(`/api/boards/${id}`) : undefined;
        if (!valid()) return;
        followRef.current = !desired; setFollowing(!desired);
        setBoards(list); generation.current = active.generation;
        if (state) accept(state);
        setReady(true); setError('');
      } catch (failure) {
        if (valid()) { setError((failure as Error).message); retry = setTimeout(() => void load(), Math.min(1000 * 2 ** attempts++, 10000)); }
      }
    };
    void load();
    return () => { disposed = true; if (retry) clearTimeout(retry); };
  }, [accept, nativeSelection]);
  useEffect(() => {
    if (!ready) return;
    let disposed = false, running = false;
    const timer = setInterval(async () => {
      if (running) return;
      running = true;
      const serial = requestSerial.current, valid = () => !disposed && serial === requestSerial.current;
      try {
        const active = await api<Active>('/api/session');
        if (!valid()) return;
        const id = followRef.current && active.boardId ? active.boardId : current.current.board.id;
        setError(''); if (id === 'waiting') return;
        if (active.generation === generation.current && id === current.current.board.id && active.boardId) return;
        const [state, list] = await Promise.all([api<Saved>(`/api/boards/${id}`), api<BoardSummary[]>('/api/boards')]);
        if (!valid()) return;
        generation.current = active.generation;
        if (state.revision !== current.current.revision || id !== current.current.board.id) accept(state);
        setBoards(list);
      } catch (failure) { if (valid()) setError((failure as Error).message); }
      finally { running = false; }
    }, 900);
    return () => { disposed = true; clearInterval(timer); };
  }, [ready, accept]);
  const openBoard = async (id: string) => {
    const serial = ++requestSerial.current; followRef.current = false; setFollowing(false);
    const state = await api<Saved>(`/api/boards/${encodeURIComponent(id)}`);
    if (serial === requestSerial.current) { accept(state); setReady(true); }
  };
  const follow = async () => {
    const serial = ++requestSerial.current; followRef.current = true; setFollowing(true);
    const active = await api<Active>('/api/session');
    if (active.boardId) {
      const state = await api<Saved>(`/api/boards/${active.boardId}`);
      if (serial === requestSerial.current) { generation.current = active.generation; accept(state); setReady(true); }
    }
  };
  return { board, boards, ready, error, revision, following, openBoard, follow, exportFiles: () => api<{ json: string; markdown: string; plan?: string }>(`/api/boards/${current.current.board.id}/export`, 'POST', { locale }) };
}
