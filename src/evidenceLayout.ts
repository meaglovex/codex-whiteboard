import type { Node } from '@xyflow/react';
import type { BoardState, Card } from './model';

export type Paper = 'lead' | 'sticky' | 'dossier' | 'flow' | 'index' | 'notebook';
export type EvidenceNode = Node<Card & { paper: Paper; tilt: number }, 'boardCard'>;
export type HeadingNode = Node<{ title: string; goal: string }, 'boardHeading'>;
export type CanvasNode = EvidenceNode | HeadingNode;
export const headingId = '__evidence_board_heading__';

const slots: { x: number; y: number; width: number; height: number; paper: Paper; tilt: number }[] = [
  { x: 70, y: 250, width: 530, height: 370, paper: 'lead', tilt: -1.3 },
  { x: 1135, y: 55, width: 300, height: 300, paper: 'sticky', tilt: -2.8 },
  { x: 1120, y: 485, width: 315, height: 400, paper: 'dossier', tilt: .7 },
  { x: 505, y: 665, width: 565, height: 350, paper: 'flow', tilt: -.5 },
  { x: 35, y: 700, width: 385, height: 280, paper: 'index', tilt: -2 },
  { x: 675, y: 135, width: 395, height: 365, paper: 'notebook', tilt: .8 },
];

/** A presentation-only arrangement. Never rewrite saved positions, content or relations. */
export function evidenceLayout(board: BoardState, narrow: boolean): CanvasNode[] {
  const heading: HeadingNode = { id: headingId, type: 'boardHeading', position: { x: narrow ? 24 : 30, y: 25 },
    data: { title: board.title, goal: board.goal }, width: narrow ? 340 : 555, height: narrow ? 180 : 170,
    draggable: false, selectable: false, focusable: false };
  let cursor = 255;
  const used = new Set<number>();
  const occupied = [{ x: heading.position.x, y: heading.position.y, width: heading.width!, height: heading.height! }];
  return [heading, ...board.nodes.map((node, i): EvidenceNode => {
    const preferences = i === 0 ? [0] : node.data.kind === 'flow' ? [3] : node.data.kind === 'prototype' ? [1, 2] : node.data.image ? [5, 4] : [1, 2, 4, 5, 3];
    const slotIndex = [...preferences, 0, 1, 2, 3, 4, 5].find(index => !used.has(index)) ?? i % slots.length;
    used.add(slotIndex);
    const slot = slots[slotIndex];
    const paper = node.data.kind === 'flow' ? 'flow' : slot.paper;
    const width = narrow ? 340 : node.data.kind === 'flow' ? 565 : slot.width;
    const height = node.data.kind === 'prototype' ? (node.data.image ? 730 : 530)
      : node.data.image ? 465
      : node.data.kind === 'flow' ? (narrow ? 500 : node.data.body ? 350 : 260)
      : narrow ? 380 : slot.height;
    const position = narrow ? { x: 24, y: cursor } : { x: slot.x, y: slot.y + Math.floor(i / slots.length) * 1080 };
    // Extra media, long prototypes and unusual node orders still need clear gutters.
    if (!narrow) {
      let collision;
      while ((collision = occupied.find(box => position.x < box.x + box.width + 32 && position.x + width + 32 > box.x && position.y < box.y + box.height + 48 && position.y + height + 48 > box.y))) position.y = collision.y + collision.height + 64;
    }
    occupied.push({ ...position, width, height });
    cursor += height + 65;
    return { ...node, position, width, height, style: { width, height }, draggable: false, selectable: false, focusable: false,
      data: { ...node.data, paper, tilt: narrow ? slot.tilt * .3 : slot.tilt } };
  })];
}
