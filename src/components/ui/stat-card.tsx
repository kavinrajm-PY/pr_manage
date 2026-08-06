import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ReactNode } from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtext?: string;
  icon?: ReactNode;
  className?: string;
}

export function StatCard({ title, value, subtext, icon, className = '' }: StatCardProps) {
  return (
    <Card className={`${className}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {title}
        </CardTitle>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtext && (
          <p className="text-xs text-muted-foreground mt-1">
            {subtext}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
