import React, { useEffect } from 'react';
import { Trash2, AlertCircle, AlertTriangle } from 'lucide-react';
import { useModalAnimation } from '../hooks/useModalAnimation';

interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  icon?: 'trash' | 'alert';
  theme?: 'dark' | 'light';
  ariaLabelledBy?: string;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDestructive = true,
  icon = 'trash',
  theme = 'dark',
  ariaLabelledBy = 'confirmation-dialog-title',
}) => {
  const { isMounted, isVisible, backdropClasses, cardClasses } = useModalAnimation({
    isOpen,
    onClose,
    zIndex: 60,
    closeOnEscape: true,
  });

  if (!isMounted) return null;

  const isDark = theme === 'dark';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={ariaLabelledBy}
      onClick={onClose}
      className={backdropClasses}
    >
      <div
        className={`w-full max-w-sm rounded-2xl border p-5 shadow-2xl space-y-4 ${
          isDark
            ? 'bg-[#18181b] border-[#2e2e34] text-white'
            : 'bg-white border-neutral-200 text-neutral-900 shadow-neutral-300'
        } ${cardClasses}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
              isDestructive
                ? 'bg-rose-500/15 border border-rose-500/30 text-rose-500'
                : 'bg-amber-500/15 border border-amber-500/30 text-amber-500'
            }`}
          >
            {icon === 'trash' ? (
              <Trash2 className="w-5 h-5" />
            ) : (
              <AlertTriangle className="w-5 h-5" />
            )}
          </div>
          <div className="space-y-1 min-w-0 flex-1">
            <h3 id={ariaLabelledBy} className="text-sm font-semibold">
              {title}
            </h3>
            <div
              className={`text-xs leading-relaxed ${
                isDark ? 'text-neutral-400' : 'text-neutral-600'
              }`}
            >
              {description}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-500/10">
          <button
            type="button"
            onClick={onClose}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
              isDark
                ? 'border-[#2e2e34] hover:bg-[#222227] text-neutral-300'
                : 'border-neutral-300 hover:bg-neutral-100 text-neutral-700'
            }`}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-lg shadow-xs transition-colors cursor-pointer ${
              isDestructive
                ? 'bg-rose-600 hover:bg-rose-700 text-white'
                : 'bg-purple-600 hover:bg-purple-700 text-white'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
