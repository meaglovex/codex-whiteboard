import type { Edge, Node } from '@xyflow/react';
import forest from './assets/forest.jpg';
import art from './assets/art.jpg';
import journal from './assets/journal.jpg';

export type Detail = { id: string; title: string; body: string; children?: Detail[] };
export type Kind = 'idea' | 'image' | 'flow' | 'prototype' | 'art';
export type Card = {
  kind: Kind;
  title: string;
  body: string;
  pinned: boolean;
  image?: string;
  steps?: { title: string; sub: string }[];
  details: Detail[];
};
export type BoardNode = Node<Card, 'boardCard'>;
export type Message = { id: string; role: 'ai' | 'user'; text: string };
export type BoardState = { version: 1; nodes: BoardNode[]; edges: Edge[]; messages: Message[] };
export function assetImage(value?: string): string | undefined {
  return value === 'asset:forest' ? forest : value === 'asset:art' ? art : value === 'asset:journal' ? journal : value;
}

const detail = (id: string, title: string, body: string, children?: Detail[]): Detail => ({ id, title, body, children });
export const defaultFlowSteps = [{ title: '捕捉片刻', sub: '拍照、文字、语音…' }, { title: '轻轻整理', sub: '自动归类、加上标签' }, { title: '回看故事', sub: '按时间串起生活' }];
export const initialNodes: BoardNode[] = [
  {
    id: 'idea', type: 'boardCard', dragHandle: '.drag-handle', position: { x: 164, y: 156 },
    data: {
      kind: 'idea', title: '随手记录，慢慢整理', body: '先收下生活里的一个片刻，\n再长成自己的故事。', pinned: true,
      details: [
        detail('who', '给容易忘记生活片刻的人', '优先照顾想留下日常，却不愿每天完成一篇长日记的人。', [detail('scene', '通勤路上的三十秒', '拍一张路边的花，补一句想法，随后继续走。不要先填分类和标签。')]),
        detail('value', '先收下，再整理', '记录当下只需要一个动作。后续的整理可以慢一点。', [detail('boundary', '第一版范围', '支持图片和一句话；复杂编辑与多人协作留到后续讨论。')]),
        detail('debate', '为什么不像普通备忘录', '借相册的回看感，而不是增加更多编辑按钮。保留用户曾提出的“想看见生活长成故事”的目标。', [detail('alternate', '讨论过的备选方案', '日历首页便于查找，但容易让记录成为打卡任务。先采用自由记录，再按时间回看。')]),
      ],
    },
  },
  {
    id: 'landscape', type: 'boardCard', dragHandle: '.drag-handle', position: { x: 644, y: 106 },
    data: { kind: 'image', title: '安静、自然、有呼吸感', body: '视觉方向', pinned: true, image: 'asset:forest', details: [
      detail('atmosphere', '照片表达什么', '用松林、薄雾与水面的留白表达安静和自然。这是讨论氛围的参考素材，不是要求把森林铺满整个产品。'),
      detail('palette', '如何转成界面', '纸白作底，灰绿用于关键动作。文字保持深灰，确保可读。', [detail('accessibility', '交互与可读性', '图像不承载必要操作文案，按钮和正文仍由可编辑组件呈现。')]),
    ] },
  },
  {
    id: 'flow', type: 'boardCard', dragHandle: '.drag-handle', position: { x: 64, y: 515 },
    data: { kind: 'flow', title: '主流程', body: '', pinned: true, steps: defaultFlowSteps, details: [
      detail('capture', '捕捉片刻', '拍照或写一句话，先把片刻保存下来。', [detail('save', '保存与失败', '保存成功后展示记录；失败时保留已输入内容，并提供重试。')]),
      detail('organize', '轻轻整理', '整理发生在记录之后，用户可以跳过。', [detail('labels', '标签建议', '标签只是建议，不自动改变用户的含义。')]),
      detail('review', '回看故事', '以时间串起生活，允许从图片进入某一天。', [detail('empty', '还没有记录', '空状态邀请用户留下第一个片刻，不显示虚构历史。')]),
      detail('unknown', '仍要讨论', '图片和文字的优先级、回看的时间跨度，留在下层继续讨论。'),
    ] },
  },
  {
    id: 'prototype', type: 'boardCard', dragHandle: '.drag-handle', position: { x: 790, y: 459 },
    data: { kind: 'prototype', title: '关键交互', body: '点开试一试', pinned: false, image: 'asset:journal', details: [
      detail('entry', '打开就可以记录', '首页只有一个清楚的主动作：“记下这一刻”。', [detail('input', '点击之后', '展开简短输入，保留画面与文本之间的关联；取消时不产生记录。')]),
      detail('feedback', '记录完成的反馈', '明确告诉用户片刻已经留下，随后回到回看区域。'),
    ] },
  },
  {
    id: 'art', type: 'boardCard', dragHandle: '.drag-handle', position: { x: 1082, y: 252 },
    data: { kind: 'art', title: '纸的触感', body: '艺术参考', pinned: false, image: 'asset:art', details: [detail('paper', '把触感留给素材', '纸张与拼贴可以成为记录素材的视觉参考。界面仍保持整洁，便于长时间思考。')] },
  },
];

export const initialEdges: Edge[] = [
  { id: 'idea-landscape', source: 'idea', sourceHandle: 'right', target: 'landscape', targetHandle: 'left', type: 'default' },
  { id: 'idea-flow', source: 'idea', sourceHandle: 'bottom', target: 'flow', targetHandle: 'top', type: 'default' },
  { id: 'landscape-prototype', source: 'landscape', sourceHandle: 'bottom', target: 'prototype', targetHandle: 'top', type: 'default' },
];
export const initialMessages: Message[] = [
  { id: 'a1', role: 'ai', text: '我建议先保留随手记录，\n把复杂整理放到下一层。' },
  { id: 'u1', role: 'user', text: '但我不想它像普通备忘录。' },
  { id: 'a2', role: 'ai', text: '那我们借一点相册的回看感，\n让记录自然变成故事。' },
];

export function freshBoard(): BoardState {
  return { version: 1, nodes: structuredClone(initialNodes), edges: structuredClone(initialEdges), messages: structuredClone(initialMessages) };
}

export function portableBoard(state: BoardState): BoardState {
  return { ...state, nodes: state.nodes.map(node => ({ ...node, selected: false, dragging: false })) };
}
