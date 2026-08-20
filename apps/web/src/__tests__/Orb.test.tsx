import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Orb } from '@/components/media/orb/Orb';

describe('Orb', () => {
  it('renders as a button with accessible label when onClick provided', () => {
    render(<Orb state="dormant" intensity={0} onClick={() => {}} ariaLabel="Start recording" />);
    const button = screen.getByRole('button', { name: 'Start recording' });
    expect(button).toBeDefined();
  });

  it('renders as a div when no onClick provided', () => {
    const { container } = render(<Orb state="active" intensity={0.5} />);
    const button = container.querySelector('button');
    expect(button).toBeNull();
  });

  it('applies dormant state class', () => {
    const { container } = render(<Orb state="dormant" intensity={0} />);
    const orb = container.firstElementChild as HTMLElement;
    expect(orb.dataset.state).toBe('dormant');
  });

  it('applies active state class', () => {
    const { container } = render(<Orb state="active" intensity={0.8} />);
    const orb = container.firstElementChild as HTMLElement;
    expect(orb.dataset.state).toBe('active');
  });

  it('applies resting state class', () => {
    const { container } = render(<Orb state="resting" intensity={0} />);
    const orb = container.firstElementChild as HTMLElement;
    expect(orb.dataset.state).toBe('resting');
  });

  it('sets --orb-intensity CSS variable from intensity prop', () => {
    const { container } = render(<Orb state="active" intensity={0.75} />);
    const orb = container.firstElementChild as HTMLElement;
    expect(orb.style.getPropertyValue('--orb-intensity')).toBe('0.75');
  });
});
