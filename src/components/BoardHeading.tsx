import type { NodeProps } from '@xyflow/react';
import type { HeadingNode } from '../evidenceLayout';

export default function BoardHeading({ data }: NodeProps<HeadingNode>) {
  return <section className="board-intro"><span className="paper-tape tape-left" aria-hidden="true" /><span className="paper-tape tape-right" aria-hidden="true" />
    <h1>{data.title}</h1><p title={data.goal}>{data.goal}</p>
  </section>;
}
