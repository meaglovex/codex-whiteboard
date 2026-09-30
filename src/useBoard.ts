import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { freshBoard,portableBoard,type BoardState,type Preferences } from './model';
import { mergeBoard } from '../shared/merge.mjs';
type Saved={board:BoardState;revision:number;busy?:boolean};
export type BoardSummary={id:string;title:string;goal:string;example?:boolean};
export async function api<T>(route:string,method='GET',value?:unknown):Promise<T>{const r=await fetch(route,{method,headers:value?{'Content-Type':'application/json'}:{},body:value?JSON.stringify(value):undefined});const result=await r.json();if(!r.ok)throw new Error(result.error||'操作失败');return result;}
export default function useBoard(){
  const [board,writeBoard]=useState(freshBoard),[boards,setBoards]=useState<BoardSummary[]>([]),[ready,setReady]=useState(false),[saveState,setSaveState]=useState('连接中'),[error,setError]=useState(''),[busy,setBusy]=useState(false),[epoch,setEpoch]=useState(0);
  const current=useRef(board),base=useRef<Saved|undefined>(undefined),saving=useRef<Promise<void>|undefined>(undefined),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);current.current=board;
  const history=useRef<BoardState[]>([]),future=useRef<BoardState[]>([]);
  const setBoard:Dispatch<SetStateAction<BoardState>>=useCallback(action=>writeBoard(previous=>{const next=typeof action==='function'?action(previous):action;const before=portableBoard(previous),after=portableBoard(next);if(JSON.stringify(before)!==JSON.stringify(after)&&!previous.nodes.some(n=>n.dragging)&&!next.nodes.some(n=>n.dragging)){history.current.push(before);history.current=history.current.slice(-30);future.current=[];}return next;}),[]);
  const accept=useCallback((state:Saved)=>{base.current=state;current.current=state.board;writeBoard(state.board);setBusy(!!state.busy);setSaveState('已保存');},[]);
  const reconcile=useCallback((state:Saved)=>{const merged=mergeBoard(base.current?.board||state.board,portableBoard(current.current),state.board);base.current=state;current.current=merged;writeBoard(merged);setBusy(!!state.busy);},[]);
  const refreshList=useCallback(async()=>setBoards(await api<BoardSummary[]>('/api/boards')),[]);
  const flush=useCallback(async function persist():Promise<void>{
    if(timer.current)clearTimeout(timer.current);
    while(saving.current)await saving.current;
    const saved=base.current;if(!saved)return;
    const draft=portableBoard(current.current);if(JSON.stringify(draft)===JSON.stringify(saved.board))return;
    setSaveState('保存中');
    const operation=(async()=>{try{const state=await api<Saved>(`/api/boards/${draft.id}`,'PUT',{base:saved.board,board:draft,revision:saved.revision});const latest=portableBoard(current.current);const merged=mergeBoard(draft,latest,state.board);base.current=state;current.current=merged;writeBoard(merged);setSaveState('已保存');setError('');}catch(e){setSaveState('未保存');setError((e as Error).message);throw e;}finally{saving.current=undefined;setEpoch(n=>n+1);}})();saving.current=operation;await operation;if(JSON.stringify(portableBoard(current.current))!==JSON.stringify(base.current?.board))await persist();
  },[]);
  useEffect(()=>{let disposed=false;const initialize=async()=>{try{const list=await api<BoardSummary[]>('/api/boards');if(disposed)return;setBoards(list);const desired=new URLSearchParams(location.search).get('board')||localStorage.getItem('whiteboard-last-id');const id=list.find(b=>b.id===desired)?.id||(list.find(b=>!b.example)||list[0]).id;const state=await api<Saved>(`/api/boards/${id}`);if(!disposed){accept(state);setReady(true);}}catch(e){if(!disposed){setError((e as Error).message);setSaveState('未连接');}}};void initialize();return()=>{disposed=true;};},[accept]);
  useEffect(()=>{if(!ready)return;document.title=`产品白板 · ${board.title}`;const url=new URL(location.href);url.searchParams.set('board',board.id);window.history.replaceState(null,'',url);try{localStorage.setItem('whiteboard-last-id',board.id);}catch{}if(JSON.stringify(portableBoard(board))===JSON.stringify(base.current?.board))return;if(saveState==='未保存')return;setSaveState('保存中');timer.current=setTimeout(()=>{void flush().catch(()=>{});},350);return()=>{if(timer.current)clearTimeout(timer.current);};},[board,ready,epoch,flush,saveState]);
  useEffect(()=>{if(!ready)return;let stopped=false;const poll=setInterval(async()=>{try{if(saving.current||JSON.stringify(portableBoard(current.current))!==JSON.stringify(base.current?.board))return;const id=current.current.id;const state=await api<Saved>(`/api/boards/${id}`);if(stopped||current.current.id!==id||saving.current||JSON.stringify(portableBoard(current.current))!==JSON.stringify(base.current?.board))return;setBusy(!!state.busy);if(state.revision!==base.current?.revision)accept(state);}catch{}},1200);return()=>{stopped=true;clearInterval(poll);};},[ready,accept]);
  const openBoard=async(id:string)=>{await flush();accept(await api<Saved>(`/api/boards/${id}`));history.current=[];future.current=[];};
  const create=async(title:string,goal:string,inspirations:string[])=>{await flush();const state=await api<Saved>('/api/boards','POST',{title,goal,inspirations});accept(state);history.current=[];future.current=[];await refreshList();};
  const discuss=async(text:string)=>{let id=current.current.id;try{await flush();id=current.current.id;setBusy(true);setError('');const state=await api<Saved>(`/api/boards/${id}/chat`,'POST',{text});if(current.current.id===id)reconcile(state);}catch(e){if(current.current.id===id){setError((e as Error).message);try{reconcile(await api<Saved>(`/api/boards/${id}`));}catch{} }}finally{if(current.current.id===id)setBusy(false);}};
  const undo=()=>{const previous=history.current.pop();if(previous){future.current.push(portableBoard(current.current));writeBoard({...previous,messages:current.current.messages});}};
  const redo=()=>{const next=future.current.pop();if(next){history.current.push(portableBoard(current.current));writeBoard({...next,messages:current.current.messages});}};
  const beginDrag=()=>{history.current.push(portableBoard(current.current));history.current=history.current.slice(-30);future.current=[];};
  const exportFiles=async()=>{await flush();return api<{json:string;markdown:string}>(`/api/boards/${current.current.id}/export`,'POST',{});};
  return {board,setBoard,boards,ready,saveState,error,setError,busy,openBoard,create,discuss,undo,redo,beginDrag,exportFiles,refreshList,retrySave:flush,getPreferences:()=>api<Preferences>('/api/preferences'),setPreferences:(values:Preferences)=>api<Preferences>('/api/preferences','PUT',values)};
}
