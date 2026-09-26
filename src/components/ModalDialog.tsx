import React, { useEffect, useRef } from 'react';
import { useModalAnimation } from '../hooks/useModalAnimation';

export interface ModalDialogProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  backdropClassName?: string;
  zIndex?: number;
  closeOnBackdropClick?: boolean;
  closeOnEscape?: boolean;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  theme?: 'dark' | 'light';
}

/**
 * Universal ModalDialog wrapper component.
 * Provides synchronized backdrop and modal entrance/exit animations.
 * Ensures the dialog remains mounted until exit transition finishes.
 */
export const ModalDialog: React.FC<ModalDialogProps> = ({
  isOpen,
  onClose,
  children,
  className = '',
  backdropClassName = '',
  zIndex = 50,
  closeOnBackdropClick = true,
  closeOnEscape = true,
  ariaLabel,
  ariaLabelledBy,
  ariaDescribedBy,
  theme = 'dark',
}) => {
  const { isMounted, isVisible, backdropClasses, cardClasses } = useModalAnimation({
    isOpen,
    onClose,
    zIndex,
    closeOnEscape,
  });

  const dialogRef = useRef<HTMLDivElement>(null);

  if (!isMounted) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy}
      onClick={closeOnBackdropClick ? onClose : undefined}
      className={`${backdropClasses} ${backdropClassName}`}
    >
      <div
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
        className={`${cardClasses} ${className}`}
      >
        {children}
      </div>
    </div>
  );
};
