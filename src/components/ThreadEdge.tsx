import { BaseEdge, type EdgeProps } from '@xyflow/react';

export default function ThreadEdge({ id, sourceX, sourceY, targetX, targetY }: EdgeProps) {
  const path = `M ${sourceX} ${sourceY} Q ${(sourceX + targetX) / 2} ${(sourceY + targetY) / 2 + 10} ${targetX} ${targetY}`;
  return <>
    <path className="thread-shadow" d={path} fill="none" aria-hidden="true" />
    <BaseEdge id={id} path={path} className="evidence-thread" interactionWidth={0} />
    <circle className="thread-end" cx={sourceX} cy={sourceY} r={4} aria-hidden="true" />
    <circle className="thread-end" cx={targetX} cy={targetY} r={4} aria-hidden="true" />
  </>;
}
