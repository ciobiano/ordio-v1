import { clsx, type ClassValue } from 'clsx';

/** Merge Tailwind classes safely — use instead of template literal concatenation */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
