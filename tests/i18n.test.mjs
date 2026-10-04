import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { messages, resolveLocale, translate, translateError, formatDateTime } from '../shared/i18n.mjs';

test('system language preferences resolve script and regional variants with an English fallback',()=>{
  for(const [input,expected] of [['zh-CN','zh-CN'],['zh-Hans-SG','zh-CN'],['zh-Hant','zh-TW'],['zh-HK','zh-TW'],['zh-MO','zh-TW'],['zh_TW','zh-TW'],['en-GB','en'],['fr-FR','en']])assert.equal(resolveLocale(input),expected);
  assert.equal(resolveLocale(['fr-FR','zh-Hant-TW','en-US']),'zh-TW');
  assert.equal(resolveLocale([]),'en');
});

test('all languages preserve interpolation fields and leave user values unchanged',()=>{
  const parameters=text=>[...text.matchAll(/\{(\w+)\}/g)].map(match=>match[1]).sort();
  for(const [key,row] of Object.entries(messages)){
    assert.equal(row.length,3,key);assert.ok(row.every(value=>typeof value==='string'&&value.length>0),key);
    assert.deepEqual(parameters(row[1]),parameters(row[0]),key);assert.deepEqual(parameters(row[2]),parameters(row[0]),key);
  }
  assert.equal(translate('en','viewStageTasks',{title:'原始项目名称'}),'View tasks · 原始项目名称');
  assert.equal(translate('zh-HK','viewPlan'),'查看計劃');
  assert.equal(translateError('en','白板不存在'),'This board does not exist.');
});

test('date formats follow the selected locale and retain an invalid source value',()=>{
  const date='2026-10-04T10:06:00Z',options={year:'numeric',month:'long',day:'numeric',timeZone:'UTC'};
  assert.equal(formatDateTime('en-GB',date,options),'4 October 2026');
  assert.match(formatDateTime('zh-CN',date,options),/2026年10月4日/);
  assert.equal(formatDateTime('en','unavailable',options),'unavailable');
});

const compiled=await build({entryPoints:['src/nativeSelection.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const {createNativeSelection}=await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
test('a mounted native panel observes later project selections, including a repeated result',()=>{
  const state=createNativeSelection(),seen=[];
  const firstSnapshot=state.getSnapshot();assert.equal(state.getSnapshot(),firstSnapshot);
  const unsubscribe=state.subscribe(()=>seen.push(state.getSnapshot()));
  state.confirm('project-a');state.confirm('project-b');state.confirm('project-b');state.confirm('../invalid');
  assert.deepEqual(seen.map(value=>value.boardId),['project-a','project-b','project-b']);
  assert.equal(seen[2].sequence,3);assert.notEqual(seen[1],seen[2]);
  unsubscribe();state.confirm('project-c');assert.equal(seen.length,3);
});
