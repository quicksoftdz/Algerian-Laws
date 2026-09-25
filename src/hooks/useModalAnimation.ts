import { useState, useEffect, useRef, useCallback } from 'react';

// Module-level counter to ensure body scroll is only restored when ALL modals are closed
let openModalsCount = 0;

interface UseModalAnimationOptions {
  isOpen: boolean;
  onClose?: () => void;
  duration?: number; // Close animation duration in ms (default: 200ms)
  openDuration?: number; // Open animation duration in ms (default: 200ms)
  zIndex?: number; // Stacking context z-index (default: 50)
  closeOnEscape?: boolean; // Automatically listen to Escape key (default: false to allow custom modal handlers)
  lockScroll?: boolean; // Lock body scroll while modal is mounted (default: true)
}

/**
 * Universal, accessible modal animation hook that coordinates entrance and exit animations.
 * Keeps dialog mounted in the DOM until the exit animation finishes.
 * Handles rapid toggling, reduced motion, body scroll locking, and backdrop synchronization.
 */
export function useModalAnimation({
  isOpen,
  onClose,
  duration = 180,
  openDuration = 200,
  zIndex = 50,
  closeOnEscape = false,
  lockScroll = true,
}: UseModalAnimationOptions) {
  const [isMounted, setIsMounted] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(false);
  const closingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rAFRef = useRef<number | null>(null);
  const scrollLockedRef = useRef(false);

  // Check if user prefers reduced motion
  const getPrefersReducedMotion = useCallback(() => {
    return (
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }, []);

  // Manage body scroll lock
  const lockBodyScroll = useCallback(() => {
    if (!lockScroll || scrollLockedRef.current) return;
    openModalsCount++;
    if (openModalsCount === 1) {
      document.body.style.overflow = 'hidden';
      // Add padding-right compensation if scrollbar exists to prevent layout shift
      const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
      if (scrollBarWidth > 0) {
        document.body.style.paddingRight = `${scrollBarWidth}px`;
      }
    }
    scrollLockedRef.current = true;
  }, [lockScroll]);

  const unlockBodyScroll = useCallback(() => {
    if (!lockScroll || !scrollLockedRef.current) return;
    openModalsCount = Math.max(0, openModalsCount - 1);
    if (openModalsCount === 0) {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    }
    scrollLockedRef.current = false;
  }, [lockScroll]);

  // Main lifecycle orchestration
  useEffect(() => {
    const prefersReducedMotion = getPrefersReducedMotion();

    if (isOpen) {
      // Cancel any ongoing closing sequence
      if (closingTimeoutRef.current) {
        clearTimeout(closingTimeoutRef.current);
        closingTimeoutRef.current = null;
      }
      if (rAFRef.current) {
        cancelAnimationFrame(rAFRef.current);
        rAFRef.current = null;
      }

      setIsMounted(true);
      lockBodyScroll();

      if (prefersReducedMotion) {
        setIsVisible(true);
      } else {
        // Double requestAnimationFrame ensures DOM is committed with initial hidden state
        // before transitioning to visible state, guaranteeing the browser triggers the transition.
        rAFRef.current = requestAnimationFrame(() => {
          rAFRef.current = requestAnimationFrame(() => {
            setIsVisible(true);
          });
        });
      }
    } else {
      if (isMounted) {
        setIsVisible(false);

        if (prefersReducedMotion) {
          setIsMounted(false);
          unlockBodyScroll();
        } else {
          // Allow closing animation to finish before unmounting from DOM
          closingTimeoutRef.current = setTimeout(() => {
            setIsMounted(false);
            unlockBodyScroll();
            closingTimeoutRef.current = null;
          }, duration);
        }
      }
    }
  }, [isOpen, isMounted, duration, getPrefersReducedMotion, lockBodyScroll, unlockBodyScroll]);

  // Escape key handler if enabled
  useEffect(() => {
    if (!closeOnEscape || !isOpen || !onClose) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeOnEscape, isOpen, onClose]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (closingTimeoutRef.current) {
        clearTimeout(closingTimeoutRef.current);
      }
      if (rAFRef.current) {
        cancelAnimationFrame(rAFRef.current);
      }
      unlockBodyScroll();
    };
  }, [unlockBodyScroll]);

  return {
    isMounted,
    isVisible,
    backdropClasses: `fixed inset-0 ${
      zIndex === 60 ? 'z-60' : zIndex === 70 ? 'z-70' : zIndex === 90 ? 'z-90' : 'z-50'
    } flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-md transition-opacity duration-200 ease-out motion-reduce:transition-none ${
      isVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
    }`,
    cardClasses: `transition-all duration-200 ease-out motion-reduce:transition-none transform ${
      isVisible
        ? 'opacity-100 scale-100 translate-y-0'
        : 'opacity-0 scale-[0.96] translate-y-2'
    }`,
  };
}
