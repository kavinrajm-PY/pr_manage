import { Progress } from '@/components/ui/progress';

interface ProgressBarProps {
  value: number; // 0 to 100
  showText?: boolean;
  className?: string;
}

export function ProgressBar({ value, showText = true, className = '' }: ProgressBarProps) {
  const percentage = isNaN(value) ? 0 : Math.min(100, Math.max(0, value));

  return (
    <div className={`w-full space-y-1.5 ${className}`}>
      {showText && (
        <div className="flex justify-between text-xs font-medium text-muted-foreground">
          <span>Progress</span>
          <span>{percentage}%</span>
        </div>
      )}
      <Progress value={percentage} className="h-2 w-full" />
    </div>
  );
}
