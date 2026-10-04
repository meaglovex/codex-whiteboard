import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

// Bundle the pure TypeScript module so this test also runs on the supported Node 20.
const compiled = await build({ entryPoints: ['src/evidenceLayout.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
const { evidenceLayout } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);

function board(count = 6) {
  return { id: 'layout-test', title: '证据墙', goal: '保留内容与关系', edges: [], nodes: Array.from({ length: count }, (_, i) => ({
    id: `node-${i}`, type: 'boardCard', position: { x: i * 80, y: i * 100 },
    data: { kind: i === 3 ? 'flow' : 'idea', title: `想法 ${i}`, body: '需要保留的原文', pinned: i % 2 === 0, details: [{ id: `detail-${i}`, title: '依据', body: '完整依据' }] },
  })) };
}
function assertNoOverlap(nodes) {
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    const a = nodes[i], b = nodes[j];
    assert.ok(a.position.x + a.width <= b.position.x || b.position.x + b.width <= a.position.x || a.position.y + a.height <= b.position.y || b.position.y + b.height <= a.position.y, `${a.id} overlaps ${b.id}`);
  }
}
test('presentation keeps original board positions, exact content and relationship data', () => {
  const source = board(), original = structuredClone(source);
  const result = evidenceLayout(source, false);
  assert.deepEqual(source, original);
  assert.equal(result.length, source.nodes.length + 1);
  for (const node of source.nodes) {
    const presented = result.find(n => n.id === node.id);
    assert.equal(presented.data.body, node.data.body);
    assert.deepEqual(presented.data.details, node.data.details);
  }
  assertNoOverlap(result);
});
test('photo and prototype cards do not overlap when boards exceed six ideas', () => {
  const source = board(14);
  for (const [i, node] of source.nodes.entries()) { if (i % 3 === 0) node.data.image = 'asset:forest'; if (i % 4 === 0) node.data.kind = 'prototype'; }
  assertNoOverlap(evidenceLayout(source, false));
  assertNoOverlap(evidenceLayout(source, true));
});
test('narrow boards keep readable single-column cards including tall flow/media content', () => {
  const source = board(); source.nodes[1].data.image = 'asset:forest'; source.nodes[4].data.kind = 'prototype';
  const result = evidenceLayout(source, true);
  assert.ok(result.every(n => n.width === 340));
  assert.ok(result.slice(1).every(n => n.position.y >= 255));
  assertNoOverlap(result);
});
