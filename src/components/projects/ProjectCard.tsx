import Link from 'next/link';
import { ProjectWithStats } from '@/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Badge } from '@/components/ui/badge';
import { Calendar, User, CheckCircle2, AlertCircle, PlayCircle, Ban } from 'lucide-react';
import { formatDate } from '@/lib/utils/dates';

interface ProjectCardProps {
  project: ProjectWithStats;
  hrefPrefix?: string; // '/projects' for PM, '/lead/projects' for Lead, etc.
}

export function ProjectCard({ project, hrefPrefix = '/projects' }: ProjectCardProps) {
  return (
    <Card className="flex flex-col justify-between h-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg font-bold line-clamp-1">
            <Link href={`${hrefPrefix}/${project.id}`} className="hover:text-primary transition-colors">
              {project.name}
            </Link>
          </CardTitle>
          <StatusBadge status={project.status} />
        </div>
        <CardDescription className="line-clamp-2 h-10 mt-1">
          {project.description || 'No description provided.'}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4 flex-1">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <User className="h-4 w-4 shrink-0" />
          <span className="font-medium text-foreground">Lead:</span>
          <span className="truncate">
            {project.teamLead ? project.teamLead.name : 'Unassigned'}
          </span>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4 shrink-0" />
          <span>Deadline: {formatDate(project.deadline)}</span>
        </div>

        <ProgressBar value={project.progressPercent} showText={true} />

        <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            <span>{project.completedTasks} Completed</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <PlayCircle className="h-3.5 w-3.5 text-blue-500" />
            <span>{project.inProgressTasks} In Progress</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Ban className="h-3.5 w-3.5 text-rose-500" />
            <span>{project.blockedTasks} Blocked</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
            <span className={project.overdueTasks > 0 ? 'text-amber-600 font-medium' : ''}>
              {project.overdueTasks} Overdue
            </span>
          </div>
        </div>
      </CardContent>

      <CardFooter className="pt-2 border-t">
        <div className="flex items-center justify-between w-full text-xs text-muted-foreground">
          <span>{project.totalTasks} total tasks</span>
          <Link
            href={`${hrefPrefix}/${project.id}`}
            className="text-primary hover:underline font-semibold"
          >
            View Dashboard →
          </Link>
        </div>
      </CardFooter>
    </Card>
  );
}
