const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function mergeBoard(base,local,remote,pathName='白板'){
  if(equal(local,base))return remote;if(equal(remote,base)||equal(local,remote))return local;
  if(base&&local&&remote&&typeof base==='object'&&typeof local==='object'&&typeof remote==='object'){
    if(Array.isArray(base)&&Array.isArray(local)&&Array.isArray(remote)&&[...base,...local,...remote].every(x=>x&&typeof x.id==='string')){
      const maps=[base,local,remote].map(xs=>new Map(xs.map(x=>[x.id,x])));const ids=[...new Set([...remote,...local].map(x=>x.id))];
      return ids.map(id=>mergeBoard(maps[0].get(id),maps[1].get(id),maps[2].get(id),`${pathName}/${id}`)).filter(x=>x!==undefined);
    }
    if(!Array.isArray(base)&&!Array.isArray(local)&&!Array.isArray(remote)){
      const out={};for(const k of new Set([...Object.keys(base),...Object.keys(local),...Object.keys(remote)])){const v=mergeBoard(base[k],local[k],remote[k],`${pathName}/${k}`);if(v!==undefined)out[k]=v;}return out;
    }
  }
  const e=new Error(`同一内容在另一窗口发生更新：${pathName}。当前改动仍留在此窗口，请先导出再重载。`);e.status=409;throw e;
}
