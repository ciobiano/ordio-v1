import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const skeleton = cva('overflow-hidden relative', {
  variants: {
    variant: {
      avatar: 'rounded-full',
      circle: 'rounded-full',
      text: 'rounded-md',
      button: 'rounded-full',
      card: 'rounded-2xl',
    },
    size: {
      xs: 'w-4 h-4',
      sm: 'w-6 h-6',
      md: 'w-9 h-9',
      lg: 'w-10 h-10',
      xl: 'w-12 h-12',
      '2xl': 'w-16 h-16',
    },
    animation: {
      pulse: 'animate-pulse',
      shimmer: '',
      ping: '',
    },
  },
  compoundVariants: [
    {
      variant: 'avatar',
      animation: 'shimmer',
      class:
        'bg-gradient-to-br from-white/10 via-white/5 to-white/10 bg-[length:200%_200%] animate-[shimmer_2.8s_ease-in-out_infinite]',
    },
    {
      variant: 'avatar',
      animation: 'ping',
      class: 'bg-white/10 animate-ping [animation-duration:1.5s]',
    },
    {
      variant: 'text',
      class: 'bg-white/10',
    },
    {
      variant: 'button',
      class: 'bg-white/10',
    },
    {
      variant: 'card',
      class: 'bg-white/5',
    },
    {
      variant: 'circle',
      class: 'bg-white/10 animate-pulse',
    },
  ],
  defaultVariants: {
    variant: 'text',
    size: 'md',
    animation: 'pulse',
  },
});

interface SkeletonProps {
  variant?: 'avatar' | 'circle' | 'text' | 'button' | 'card';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  animation?: 'pulse' | 'shimmer' | 'ping';
  className?: string;
}

export function Skeleton({ variant, size, animation, className }: SkeletonProps) {
  return <div className={cn(skeleton({ variant, size, animation }), className)} />;
}
