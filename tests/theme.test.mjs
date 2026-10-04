import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const compiled=await build({entryPoints:['src/theme.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const {observeTheme}=await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
function surface(dark=true){
  const listeners=new Set(),classes=new Set();
  const root={dataset:{},style:{},classList:{toggle(name,enabled){enabled?classes.add(name):classes.delete(name);}}};
  const media={matches:dark,addEventListener(_,fn){listeners.add(fn);},removeEventListener(_,fn){listeners.delete(fn);}};
  const controller=observeTheme(root,media);
  const change=dark=>{media.matches=dark;for(const fn of listeners)fn();};
  return {root,classes,listeners,controller,change};
}
test('system appearance is applied at startup and follows live changes',()=>{
  const s=surface(true);
  assert.equal(s.root.dataset.theme,'dark');assert.equal(s.root.style.colorScheme,'dark');assert.ok(s.classes.has('dark'));
  s.change(false);assert.equal(s.root.dataset.theme,'light');assert.equal(s.root.style.colorScheme,'light');assert.ok(!s.classes.has('dark'));
  s.change(true);assert.equal(s.root.dataset.theme,'dark');
});
test('native host appearance overrides system appearance and can release that override',()=>{
  const s=surface(true);
  s.controller.setHostTheme('light');assert.equal(s.root.dataset.theme,'light');
  s.change(false);s.change(true);assert.equal(s.root.dataset.theme,'light');
  s.controller.setHostTheme('dark');assert.equal(s.root.dataset.theme,'dark');
  s.change(false);assert.equal(s.root.dataset.theme,'dark');
  s.controller.setHostTheme(undefined);assert.equal(s.root.dataset.theme,'light');
});
test('theme observer removes its event listener when disposed',()=>{
  const s=surface(true);assert.equal(s.listeners.size,1);
  s.controller.dispose();assert.equal(s.listeners.size,0);
  s.change(false);assert.equal(s.root.dataset.theme,'dark');
});
