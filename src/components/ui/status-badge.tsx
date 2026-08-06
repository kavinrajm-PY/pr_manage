import { Badge } from '@/components/ui/badge';
import { ProjectStatus, TaskStatus } from '@/types';

interface StatusBadgeProps {
  status: ProjectStatus | TaskStatus;
  label?: string;
}

export function StatusBadge({ status, label: labelOverride }: StatusBadgeProps) {
  let label = labelOverride || status.replace('_', ' ');
  let variantClass = '';

  switch (status) {
    // Project Statuses
    case 'NOT_STARTED':
      variantClass = 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800/40 dark:text-slate-300 dark:border-slate-700';
      break;
    case 'IN_PROGRESS':
      variantClass = 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800';
      break;
    case 'ON_HOLD':
      variantClass = 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800';
      break;
    case 'COMPLETED':
      variantClass = 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800';
      break;
    
    // Task Statuses
    case 'TODO':
      variantClass = 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800/40 dark:text-slate-300 dark:border-slate-700';
      break;
    // IN_PROGRESS and COMPLETED match projects
    case 'BLOCKED':
      variantClass = 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-800';
      break;
  }

  return (
    <Badge variant="outline" className={`font-medium capitalize ${variantClass}`}>
      {label.toLowerCase()}
    </Badge>
  );
}
