import React, { useState, useEffect, useRef } from 'react';
import { Shield, Lock, User, X, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useModalAnimation } from '../hooks/useModalAnimation';

interface AdminSignInModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme?: 'dark' | 'light';
}

export const AdminSignInModal: React.FC<AdminSignInModalProps> = ({
  isOpen,
  onClose,
  theme = 'dark',
}) => {
  const { loginAsAdmin } = useAuth();

  const [adminIdentifier, setAdminIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const adminInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isDark = theme === 'dark';

  const { isMounted, backdropClasses, cardClasses } = useModalAnimation({
    isOpen,
    onClose: !isSubmitting ? onClose : undefined,
    duration: 180,
    openDuration: 200,
    zIndex: 60,
  });

  // Reset or focus when modal opens
  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setIsSuccess(false);
      setIsSubmitting(false);
      setPassword('');
      // Focus the admin input on opening after animation frame
      const timer = setTimeout(() => {
        adminInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Handle ESC key to close with animation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting && isOpen) {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  // Clean up timeouts
  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const trimmedId = adminIdentifier.trim();
    if (!trimmedId) {
      setErrorMessage('Please enter your administrator username or email.');
      adminInputRef.current?.focus();
      return;
    }

    if (!password) {
      setErrorMessage('Please enter your administrator password.');
      passwordInputRef.current?.focus();
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await loginAsAdmin(trimmedId, password);
      setIsSuccess(true);
      // Allow user to see successful state briefly, then trigger graceful close animation
      successTimeoutRef.current = setTimeout(() => {
        onClose();
      }, 400);
    } catch (err: any) {
      // Security standard: Clear password field, preserve admin field, display generic error
      setPassword('');
      setErrorMessage(err?.message || 'Invalid administrator credentials.');
      passwordInputRef.current?.focus();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (isSubmitting) return;
    onClose();
  };

  if (!isMounted) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-auth-dialog-title"
      className={backdropClasses}
    >
      <div
        className={`w-full max-w-md rounded-2xl border shadow-2xl flex flex-col overflow-hidden ${
          isDark ? 'bg-[#151518] border-[#27272c] text-white' : 'bg-white border-neutral-200 text-neutral-900'
        } ${cardClasses}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-6 py-4 border-b shrink-0 ${
            isDark ? 'bg-[#18181c] border-[#27272c]' : 'bg-neutral-50 border-neutral-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-xs">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 id="admin-auth-dialog-title" className="text-sm font-bold tracking-tight">
                Sign as Admin
              </h2>
              <p className="text-xs text-neutral-400">
                Administrator Authentication
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCancel}
            disabled={isSubmitting}
            aria-label="Close"
            className={`p-2 rounded-xl transition-colors cursor-pointer disabled:opacity-50 ${
              isDark
                ? 'hover:bg-[#27272a] text-neutral-400 hover:text-white'
                : 'hover:bg-neutral-100 text-neutral-600 hover:text-black'
            }`}
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6">
          {isSuccess ? (
            <div className="py-6 text-center space-y-3 animate-in zoom-in-95 duration-200">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-emerald-400">
                Administrator Authenticated
              </h3>
              <p className="text-xs text-neutral-400">
                Admin permissions granted. Closing dialog...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {/* Error Notification */}
              {errorMessage && (
                <div
                  role="alert"
                  className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2.5 animate-in fade-in"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Admin field */}
              <div className="space-y-1">
                <label
                  htmlFor="admin-identifier"
                  className="block text-xs font-semibold text-neutral-300"
                >
                  Admin <span className="text-rose-400">*</span>
                </label>
                <div
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-colors ${
                    isDark
                      ? 'border-[#2e2e34] bg-[#1d1d22] focus-within:border-purple-500 focus-within:ring-1 focus-within:ring-purple-500/30'
                      : 'border-neutral-200 bg-neutral-50 focus-within:border-purple-500 focus-within:ring-1 focus-within:ring-purple-500/30'
                  }`}
                >
                  <User className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                  <input
                    ref={adminInputRef}
                    id="admin-identifier"
                    name="admin"
                    type="text"
                    autoComplete="username"
                    placeholder="Username or email address"
                    value={adminIdentifier}
                    onChange={(e) => setAdminIdentifier(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full bg-transparent text-xs focus:outline-none placeholder:text-neutral-500 font-mono"
                  />
                </div>
              </div>

              {/* Password field */}
              <div className="space-y-1">
                <label
                  htmlFor="admin-password"
                  className="block text-xs font-semibold text-neutral-300"
                >
                  Password <span className="text-rose-400">*</span>
                </label>
                <div
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-colors ${
                    isDark
                      ? 'border-[#2e2e34] bg-[#1d1d22] focus-within:border-purple-500 focus-within:ring-1 focus-within:ring-purple-500/30'
                      : 'border-neutral-200 bg-neutral-50 focus-within:border-purple-500 focus-within:ring-1 focus-within:ring-purple-500/30'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                  <input
                    ref={passwordInputRef}
                    id="admin-password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full bg-transparent text-xs focus:outline-none placeholder:text-neutral-500 font-mono"
                  />
                </div>
              </div>

              {/* Form Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-inherit">
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={isSubmitting}
                  className={`px-4 py-2 text-xs font-medium rounded-xl border transition-colors cursor-pointer disabled:opacity-50 ${
                    isDark
                      ? 'border-[#2e2e34] hover:bg-[#222227] text-neutral-300'
                      : 'border-neutral-300 hover:bg-neutral-100 text-neutral-700'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !adminIdentifier.trim() || !password}
                  className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#DC143C] hover:bg-[#b81032] active:bg-[#9c0d2a] disabled:opacity-50 disabled:pointer-events-none transition-all shadow-sm shadow-red-950/30 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Authenticating...</span>
                    </>
                  ) : (
                    <>
                      <Shield className="w-3.5 h-3.5 text-white" />
                      <span>Sign as Admin</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
