import React, { useEffect, useState } from 'react';
import { Lock, LogIn, UserPlus, X, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useModalAnimation } from '../hooks/useModalAnimation';

interface AuthRequiredModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCreateAccount: () => void;
  onLoginSuccess?: () => void;
  theme?: 'dark' | 'light';
}

export const AuthRequiredModal: React.FC<AuthRequiredModalProps> = ({
  isOpen,
  onClose,
  onOpenCreateAccount,
  onLoginSuccess,
  theme = 'dark',
}) => {
  const { user, loginWithGoogle, error, clearError } = useAuth();
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const isDark = theme === 'dark';

  const { isMounted, isVisible, backdropClasses, cardClasses } = useModalAnimation({
    isOpen: Boolean(isOpen && !user),
  });

  // Handle ESC key to cancel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoggingIn) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoggingIn, onClose]);

  // If user becomes authenticated, close dialog and trigger login success callback
  useEffect(() => {
    if (isOpen && user) {
      onClose();
      if (onLoginSuccess) {
        onLoginSuccess();
      }
    }
  }, [isOpen, user, onClose, onLoginSuccess]);

  const handleLogInClick = async () => {
    setIsLoggingIn(true);
    clearError();
    try {
      await loginWithGoogle();
    } catch {
      // Error handled in AuthContext
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleCreateAccountClick = () => {
    onClose();
    onOpenCreateAccount();
  };

  if (!isMounted || user) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-required-title"
      aria-describedby="auth-required-desc"
      className={backdropClasses}
    >
      <div
        className={`w-full max-w-sm rounded-2xl border p-6 shadow-2xl flex flex-col text-center space-y-5 ${
          isDark
            ? 'bg-[#151518] border-[#27272c] text-white'
            : 'bg-white border-neutral-200 text-neutral-900 shadow-neutral-200'
        } ${cardClasses}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Lock Icon Badge */}
        <div className="mx-auto w-12 h-12 rounded-2xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-xs">
          <Lock className="w-6 h-6" />
        </div>

        {/* Title & Description */}
        <div className="space-y-1.5">
          <h2 id="auth-required-title" className="text-base font-bold tracking-tight">
            Sign in to continue
          </h2>
          <p id="auth-required-desc" className="text-xs text-neutral-400 leading-relaxed">
            Please sign in or create an account to continue using the AI.
          </p>
        </div>

        {/* Auth Error Banner if any */}
        {error && (
          <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs text-left">
            <span>{error}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2.5 pt-1">
          {/* 1. Log In Button */}
          <button
            type="button"
            onClick={handleLogInClick}
            disabled={isLoggingIn}
            className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-[#4285f4] hover:bg-[#3367d6] transition-all shadow-md shadow-blue-900/20 disabled:opacity-60 cursor-pointer"
          >
            {isLoggingIn ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Signing In...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4 bg-white rounded-full p-0.5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Log In</span>
              </>
            )}
          </button>

          {/* 2. Create an Account Button */}
          <button
            type="button"
            onClick={handleCreateAccountClick}
            disabled={isLoggingIn}
            className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer ${
              isDark
                ? 'bg-purple-600 hover:bg-purple-500 text-white border border-purple-500/30 shadow-purple-950/20'
                : 'bg-purple-600 hover:bg-purple-700 text-white border border-purple-600 shadow-purple-100'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>Create an Account</span>
          </button>

          {/* 3. Cancel Button */}
          <button
            type="button"
            onClick={onClose}
            disabled={isLoggingIn}
            className={`w-full py-2 px-4 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
              isDark
                ? 'text-neutral-400 hover:text-white hover:bg-[#222227]'
                : 'text-neutral-600 hover:text-black hover:bg-neutral-100'
            }`}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
