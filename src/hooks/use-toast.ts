import { toast as baseToast } from '@/components/ui/toast';

export function useToast() {
  const toast = ({
    title,
    description,
    variant = 'default',
  }: {
    title?: string;
    description?: string;
    variant?: 'default' | 'destructive' | 'success';
  }) => {
    baseToast.add({
      title: title || '',
      description: description || '',
      type: variant === 'destructive' ? 'error' : variant === 'success' ? 'success' : 'info',
    });
  };

  return { toast };
}
