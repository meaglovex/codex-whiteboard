import { Circle, CircleCheck, CircleDot, Clock3, LockKeyhole, Ban, CircleAlert } from 'lucide-react';
import { Badge } from '../ui/badge';
import { statusLabels, type MilestoneStatus } from '../../progressModel';

export const statusIcons = { todo: Circle, in_progress: CircleDot, review: Clock3, blocked: CircleAlert, done: CircleCheck, locked: LockKeyhole, cancelled: Ban };
export default function StatusBadge({ status }: { status: MilestoneStatus }) {
  const Icon = statusIcons[status];
  return <Badge variant="outline" className="project-status" data-status={status}><Icon aria-hidden="true" />{statusLabels[status]}</Badge>;
}
