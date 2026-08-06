import { Badge } from '@/components/ui/badge';
import { TaskPriority } from '@/types';

interface PriorityBadgeProps {
  priority: TaskPriority;
}

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  let variantClass = '';

  switch (priority) {
    case 'LOW':
      variantClass = 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900/10 dark:text-slate-400 dark:border-slate-800';
      break;
    case 'MEDIUM':
      variantClass = 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/10 dark:text-blue-400 dark:border-blue-800';
      break;
    case 'HIGH':
      variantClass = 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/10 dark:text-amber-400 dark:border-amber-800';
      break;
    case 'URGENT':
      variantClass = 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800';
      break;
  }

  return (
    <Badge variant="outline" className={`font-semibold text-xs ${variantClass}`}>
      {priority}
    </Badge>
  );
}
