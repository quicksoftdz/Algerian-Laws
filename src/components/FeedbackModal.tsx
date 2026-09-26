import React, { useState, useEffect, useRef } from 'react';
import { X, Send, CheckCircle2, MessageSquare } from 'lucide-react';
import { useModalAnimation } from '../hooks/useModalAnimation';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme?: 'dark' | 'light';
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  isOpen,
  onClose,
  theme = 'dark',
}) => {
  const [feedbackType, setFeedbackType] = useState<'bug' | 'feature' | 'aesthetic'>('aesthetic');
  const [comments, setComments] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const { isMounted, isVisible, backdropClasses, cardClasses } = useModalAnimation({
    isOpen,
  });

  // Close dialog on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isMounted) return null;

  const isDark = theme === 'dark';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!comments.trim()) return;
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setComments('');
      onClose();
    }, 1400);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-modal-title"
      className={backdropClasses}
    >
      <div
        ref={dialogRef}
        className={`w-full max-w-md rounded-2xl shadow-2xl p-5 border transition-colors outline-none ${
          isDark
            ? 'bg-[#18181b] border-[#2e2e34] text-white'
            : 'bg-white border-[#e4e4e7] text-neutral-900 shadow-neutral-200'
        } ${cardClasses}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`flex items-center justify-between pb-3 border-b ${
            isDark ? 'border-[#27272a]' : 'border-[#e4e4e7]'
          }`}
        >
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            <h2 id="feedback-modal-title" className="text-sm font-semibold">
              Send Feedback
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close feedback modal"
            className={`p-1 rounded-lg transition-colors cursor-pointer ${
              isDark ? 'text-neutral-400 hover:text-white hover:bg-[#27272a]' : 'text-neutral-500 hover:text-black hover:bg-neutral-100'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {submitted ? (
          <div className="py-8 text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto animate-in zoom-in-50 duration-200" />
            <h3 className="text-sm font-semibold">Thank you!</h3>
            <p className="text-xs text-neutral-400">Your feedback has been recorded.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-3">
            <div>
              <label className="block text-xs text-neutral-400 mb-1.5">Feedback Topic</label>
              <div className="grid grid-cols-3 gap-2">
                {(['aesthetic', 'feature', 'bug'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setFeedbackType(type)}
                    className={`py-1.5 px-2 rounded-lg text-xs capitalize border transition-colors cursor-pointer ${
                      feedbackType === type
                        ? isDark
                          ? 'bg-[#27272a] text-white border-neutral-400 font-medium'
                          : 'bg-neutral-900 text-white border-neutral-900 font-medium'
                        : isDark
                        ? 'bg-[#202024] text-neutral-400 border-[#2b2b31] hover:text-white'
                        : 'bg-neutral-100 text-neutral-600 border-neutral-200 hover:text-black'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs text-neutral-400 mb-1.5">Your Thoughts</label>
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Tell us what you like or what can be improved..."
                rows={4}
                required
                className={`w-full p-3 rounded-xl text-xs leading-relaxed focus:outline-none resize-none border ${
                  isDark
                    ? 'bg-[#202024] border-[#2e2e34] text-white focus:border-neutral-400'
                    : 'bg-neutral-50 border-neutral-200 text-neutral-900 focus:border-neutral-400'
                }`}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className={`px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                  isDark ? 'text-neutral-400 hover:text-white hover:bg-[#27272a]' : 'text-neutral-600 hover:text-black hover:bg-neutral-100'
                }`}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-sm ${
                  isDark ? 'bg-white text-black hover:bg-neutral-200' : 'bg-neutral-900 text-white hover:bg-black'
                }`}
              >
                <Send className="w-3.5 h-3.5" />
                Submit
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
