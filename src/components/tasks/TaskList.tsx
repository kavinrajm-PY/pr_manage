import Link from 'next/link';
import { TaskWithUsers } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/status-badge';
import { PriorityBadge } from '@/components/ui/priority-badge';
import { formatDate, isOverdue } from '@/lib/utils/dates';
import { AlertCircle } from 'lucide-react';

interface TaskListProps {
  tasks: TaskWithUsers[];
  emptyMessage?: string;
  showProjectName?: boolean; // In case we show cross-project list on dashboard
  projectsMap?: Record<string, string>; // Maps projectId to projectName
}

export function TaskList({
  tasks,
  emptyMessage = 'No tasks found.',
  showProjectName = false,
  projectsMap = {},
}: TaskListProps) {
  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Task Title</TableHead>
            {showProjectName && <TableHead>Project</TableHead>}
            <TableHead>Assigned To</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Deadline</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => {
            const isTaskOverdue = isOverdue(task);
            return (
              <TableRow key={task.id} className="hover:bg-muted/30">
                <TableCell className="font-semibold">
                  <Link href={`/tasks/${task.id}`} className="hover:underline text-foreground hover:text-primary">
                    {task.title}
                  </Link>
                </TableCell>
                {showProjectName && (
                  <TableCell className="font-medium text-xs">
                    {projectsMap[task.projectId] || 'Unknown Project'}
                  </TableCell>
                )}
                <TableCell className="text-sm">
                  {task.assignedToUser ? task.assignedToUser.name : 'Unassigned'}
                </TableCell>
                <TableCell>
                  <PriorityBadge priority={task.priority} />
                </TableCell>
                <TableCell>
                  <StatusBadge status={task.status} />
                </TableCell>
                <TableCell className="text-right text-sm font-medium">
                  <div className="inline-flex items-center gap-1.5 justify-end">
                    {isTaskOverdue && <AlertCircle className="h-3.5 w-3.5 text-rose-600 animate-pulse" />}
                    <span className={isTaskOverdue ? 'text-rose-600 font-bold' : ''}>
                      {formatDate(task.deadline)}
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
          {tasks.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={showProjectName ? 6 : 5}
                className="h-24 text-center text-muted-foreground"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
