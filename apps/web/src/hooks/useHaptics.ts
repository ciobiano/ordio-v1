import { useCallback, useRef, useEffect } from 'react';

type HapticFeedbackType = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

const IOS_SWITCH_CSS = `
  .haptics-switch {
    position: absolute;
    opacity: 0;
    pointer-events: none;
    width: 0;
    height: 0;
  }
`;

function triggerIOSHaptic() {
  const style = document.createElement('style');
  style.textContent = IOS_SWITCH_CSS;
  document.head.appendChild(style);

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'haptics-switch';
  checkbox.setAttribute('data-haptic', 'true');
  document.body.appendChild(checkbox);

  checkbox.click();

  requestAnimationFrame(() => {
    checkbox.remove();
    style.remove();
  });
}

export function useHaptics() {
  const styleRef = useRef<HTMLStyleElement | null>(null);

  useEffect(() => {
    return () => {
      if (styleRef.current) {
        styleRef.current.remove();
      }
    };
  }, []);

  const trigger = useCallback((type: HapticFeedbackType = 'light') => {
    if (typeof window === 'undefined') return;

    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
    const safariVersion = navigator.userAgent.match(/Version\/(\d+\.\d+)/);
    const supportsHaptics = safariVersion && parseFloat(safariVersion[1]) >= 17.4;

    if (isIOS && isSafari && supportsHaptics) {
      const count = { light: 1, medium: 2, heavy: 3, success: 2, warning: 3, error: 4 }[type];
      for (let i = 0; i < count; i++) {
        setTimeout(() => triggerIOSHaptic(), i * 50);
      }
      return;
    }

    if (typeof navigator.vibrate !== 'undefined') {
      try {
        switch (type) {
          case 'light':
            navigator.vibrate(10);
            break;
          case 'medium':
            navigator.vibrate(20);
            break;
          case 'heavy':
            navigator.vibrate(30);
            break;
          case 'success':
            navigator.vibrate([10, 30, 20]);
            break;
          case 'warning':
            navigator.vibrate([20, 20, 20]);
            break;
          case 'error':
            navigator.vibrate([30, 20, 30, 20, 30]);
            break;
        }
      } catch {
        // Ignore errors
      }
    }
  }, []);

  return { trigger };
}
