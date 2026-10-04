import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { applyProgress, validateProgress } from '../server/progress.mjs';

const compiled=await build({entryPoints:['src/progressModel.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const {taskCounts,milestoneSummaries,progressGraph}=await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
const base={id:'project',title:'项目',nodes:[{id:'idea',data:{title:'保留构思'}}],edges:[],messages:[],plan:{markdown:'# 实际计划'}};
const passed={id:'test',kind:'test',label:'测试通过',reference:'npm test',result:'passed',detail:'隔离测试中的验证记录'};
const start={eventId:'start',summary:'开始实现',projectPath:'/projects/example',milestones:[{id:'build',title:'实现'},{id:'ship',title:'交付',dependsOn:['build']}],tasks:[{id:'core',milestoneId:'build',title:'核心功能',acceptance:'相关测试通过',status:'in_progress',description:'原始说明',dependsOn:[]},{id:'release',milestoneId:'ship',title:'交付验收',acceptance:'交付清单通过',dependsOn:['core']}]};
const begin=()=>applyProgress(structuredClone(base),start,'2026-10-04T00:00:00Z');
test('starting development preserves product discovery and plan, with real task counts',()=>{
  const board=begin();assert.equal(board.phase,'development');assert.deepEqual(board.nodes,base.nodes);assert.deepEqual(board.plan,base.plan);
  assert.deepEqual(taskCounts(board.progress.tasks),{total:2,done:0,blocked:0,active:1,review:0,ratio:0});
  const stages=milestoneSummaries(board.progress);assert.equal(stages[0].status,'in_progress');assert.equal(stages[1].status,'locked');
});
test('partial status updates retain dependencies, acceptance criteria and prior evidence',()=>{
  let board=begin();
  board=applyProgress(board,{eventId:'review',summary:'进入验收',tasks:[{id:'core',status:'review',evidence:[passed]}]});
  board=applyProgress(board,{eventId:'block',summary:'发现阻塞',tasks:[{id:'core',status:'blocked',blocker:'等待测试环境'}]});
  const task=board.progress.tasks[0];assert.equal(task.description,'原始说明');assert.equal(task.acceptance,'相关测试通过');assert.equal(task.evidence[0].id,'test');
  assert.deepEqual(board.progress.tasks[1].dependsOn,['core']);assert.deepEqual(board.progress.milestones[1].dependsOn,['build']);
});
test('event retries are idempotent and cannot reuse an id for a different update',()=>{
  const board=begin();assert.equal(applyProgress(board,start),null);
  assert.throws(()=>applyProgress(board,{...start,summary:'不同内容'}),/事件 ID/);
});
test('completion needs fresh passing evidence, blocked work needs a reason, reopening needs a note',()=>{
  const board=begin();
  assert.throws(()=>applyProgress(board,{eventId:'bad',summary:'未验证',tasks:[{id:'core',status:'done'}]}),/验收依据/);
  assert.throws(()=>applyProgress(board,{eventId:'bad',summary:'未知阻塞',tasks:[{id:'core',status:'blocked'}]}),/说明原因/);
  const done=applyProgress(board,{eventId:'pass',summary:'验收通过',tasks:[{id:'core',status:'done',evidence:[passed]}]});
  assert.equal(milestoneSummaries(done.progress)[1].status,'todo');
  assert.throws(()=>applyProgress(done,{eventId:'reopen',summary:'重新实现',tasks:[{id:'core',status:'in_progress'}]}),/重新打开/);
  const reopened=applyProgress(done,{eventId:'reopen',summary:'新范围',tasks:[{id:'core',status:'in_progress',note:'用户增加验收条件'}]});
  assert.throws(()=>applyProgress(reopened,{eventId:'again',summary:'旧证据不足',tasks:[{id:'core',status:'done'}]}),/同时提交/);
});
test('dangling dependencies, cycles and duplicate ids are rejected without mutating the input',()=>{
  const board=begin(), original=structuredClone(board);
  for(const input of [
    {milestones:[{id:'build',dependsOn:['ship']}]},
    {tasks:[{id:'core',dependsOn:['release']}]},
    {tasks:[{id:'core',dependsOn:['missing']}]},
    {tasks:[{id:'core',milestoneId:'missing'}]},
    {tasks:[{id:'core',title:'一'},{id:'core',title:'二'}]},
  ]) assert.throws(()=>applyProgress(board,{eventId:'invalid',summary:'无效更新',...input}));
  assert.deepEqual(board,original);
  assert.throws(()=>applyProgress(board,{eventId:'percent',summary:'不能猜测进度',percent:90}));
});
test('cancelled tasks are excluded from the denominator and cannot fake completion',()=>{
  const board=applyProgress(begin(),{eventId:'cancel',summary:'缩小范围',tasks:[{id:'release',status:'cancelled',blocker:'用户取消此交付项'}]});
  assert.equal(taskCounts(board.progress.tasks).total,1);assert.equal(taskCounts(board.progress.tasks).done,0);
  assert.equal(milestoneSummaries(board.progress)[1].status,'cancelled');
});
test('readable routes use only real dependency edges, keep stable geometry and fit a single mobile column',()=>{
  let board=begin();
  const items=milestoneSummaries(board.progress),graph=progressGraph(items,false);
  assert.equal(graph.edges.length,1);assert.equal(graph.edges[0].source,'build');assert.equal(graph.edges[0].target,'ship');
  board=applyProgress(board,{eventId:'progress',summary:'完成实现',tasks:[{id:'core',status:'done',evidence:[passed]}]});
  assert.deepEqual(progressGraph(milestoneSummaries(board.progress),false).nodes.map(n=>n.position),graph.nodes.map(n=>n.position));
  const mobile=progressGraph(items,true);assert.ok(mobile.nodes.every(n=>n.position.x===0&&n.width===330));
  assert.ok(mobile.nodes[1].position.y>=mobile.nodes[0].position.y+mobile.nodes[0].height);
  assert.equal(validateProgress(board.progress).tasks[0].status,'done');
});
