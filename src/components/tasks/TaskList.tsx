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
  showProjectName?: boolean;
  projectsMap?: Record<string, string>;
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
            <TableHead>Progress</TableHead>
            <TableHead className="text-right">Deadline</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => {
            const isTaskOverdue = isOverdue(task);
            const pct = task.completionPercent ?? 0;
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
                <TableCell className="min-w-[96px]">
                  {task.status === 'COMPLETED' ? (
                    <div className="flex items-center gap-1.5">
                      <div className="w-16 h-1.5 rounded-full bg-emerald-500" />
                      <span className="text-xs font-semibold text-emerald-600">100%</span>
                    </div>
                  ) : pct > 0 ? (
                    <div className="flex items-center gap-1.5">
                      <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${pct}%`,
                            background: 'linear-gradient(90deg, #7c4d96, #a855f7)',
                          }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-primary">{pct}%</span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
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
                colSpan={showProjectName ? 7 : 6}
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
