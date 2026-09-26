import React, { useState, useRef, useEffect, useCallback } from 'react';
import { User, LogOut, Settings, Database, Shield, UserCheck, Loader2, BarChart3, UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface UserAuthMenuProps {
  onOpenSettings: () => void;
  onOpenAdminDashboard?: () => void;
  onOpenCreateAccount?: () => void;
  onOpenAdminSignIn?: () => void;
  theme: 'dark' | 'light';
}

const OPEN_ANIMATION_DURATION = 210; // ms (within 180-240ms)
const CLOSE_ANIMATION_DURATION = 160; // ms (within 150-200ms)

export const UserAuthMenu: React.FC<UserAuthMenuProps> = ({
  onOpenSettings,
  onOpenAdminDashboard,
  onOpenCreateAccount,
  onOpenAdminSignIn,
  theme,
}) => {
  const { user, userProfile, loading, role, isAdmin, isActualAdmin, permissions, toggleRole, loginWithGoogle, logout, error, clearError } = useAuth();
  
  // Menu visibility & animation states
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const triggerButtonRef = useRef<HTMLButtonElement>(null);
  const closingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rAFRef = useRef<number | null>(null);

  // Detect user's reduced-motion OS preference
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, []);

  // Coordinated entrance and exit animation lifecycle
  useEffect(() => {
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

      if (prefersReducedMotion) {
        setIsVisible(true);
      } else {
        // Double requestAnimationFrame ensures initial closed styling is painted before transitioning to open
        rAFRef.current = requestAnimationFrame(() => {
          rAFRef.current = requestAnimationFrame(() => {
            setIsVisible(true);
          });
        });
      }
    } else {
      // Initiate closing animation
      setIsVisible(false);

      if (prefersReducedMotion) {
        setIsMounted(false);
      } else if (isMounted) {
        // Wait for closing animation to finish before unmounting from DOM
        closingTimeoutRef.current = setTimeout(() => {
          setIsMounted(false);
          closingTimeoutRef.current = null;
        }, CLOSE_ANIMATION_DURATION);
      }
    }
  }, [isOpen, isMounted, prefersReducedMotion]);

  // Outside click, Escape key, and window blur handling
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(false);
        triggerButtonRef.current?.focus();
      }
    };

    const handleWindowBlur = () => {
      setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [isOpen]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (closingTimeoutRef.current) {
        clearTimeout(closingTimeoutRef.current);
      }
      if (rAFRef.current) {
        cancelAnimationFrame(rAFRef.current);
      }
    };
  }, []);

  const handleFocusOut = (e: React.FocusEvent<HTMLDivElement>) => {
    if (menuRef.current && e.relatedTarget && !menuRef.current.contains(e.relatedTarget as Node)) {
      setIsOpen(false);
    }
  };

  const handleToggleMenu = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const handleSignIn = async () => {
    setIsSigningIn(true);
    try {
      await loginWithGoogle();
      setIsOpen(false);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    setIsOpen(false);
  };

  const isDark = theme === 'dark';

  return (
    <div className="relative" ref={menuRef} onBlur={handleFocusOut}>
      {/* Trigger Button with interactive indicator state */}
      <button
        ref={triggerButtonRef}
        type="button"
        onClick={handleToggleMenu}
        aria-label="User profile and account"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        title={
          user
            ? `Signed in as ${user.displayName || user.email} (${isAdmin ? 'Admin' : 'Regular User'})`
            : 'Account and Sign In'
        }
        className={`ml-1 p-0.5 rounded-full border transition-all duration-150 cursor-pointer flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/70 relative select-none ${
          isAdmin
            ? isOpen
              ? 'border-purple-400 ring-2 ring-purple-500/50 shadow-sm shadow-purple-500/20 bg-purple-950/30'
              : 'border-purple-500/50 hover:border-purple-400 ring-1 ring-purple-500/20'
            : isDark
            ? isOpen
              ? 'border-purple-500/70 ring-2 ring-purple-500/30 bg-[#272730]'
              : 'border-[#2e2e34] hover:border-neutral-500 bg-[#202025]'
            : isOpen
            ? 'border-purple-500 ring-2 ring-purple-500/25 bg-purple-50/60'
            : 'border-[#e4e4e7] hover:border-neutral-400 bg-white'
        }`}
      >
        {user?.photoURL || userProfile?.photoURL ? (
          <img
            src={user?.photoURL || userProfile?.photoURL || ''}
            alt={user?.displayName || userProfile?.displayName || 'User'}
            referrerPolicy="no-referrer"
            className="w-7 h-7 rounded-full object-cover"
          />
        ) : (
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center ${
              user
                ? isDark
                  ? 'bg-purple-900/40 text-purple-300'
                  : 'bg-purple-100 text-purple-700'
                : isDark
                ? 'bg-neutral-800 text-neutral-300'
                : 'bg-neutral-100 text-neutral-700'
            }`}
          >
            <User className="w-3.5 h-3.5" />
          </div>
        )}
        {isAdmin && (
          <span
            className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-purple-500 rounded-full ring-2 ring-[#121214]"
            title="System Admin"
          />
        )}
      </button>

      {/* Animated Dropdown Menu */}
      {isMounted && (
        <div
          role="menu"
          aria-orientation="vertical"
          style={{
            transformOrigin: 'top right',
            transitionDuration: prefersReducedMotion
              ? '0ms'
              : isVisible
              ? `${OPEN_ANIMATION_DURATION}ms`
              : `${CLOSE_ANIMATION_DURATION}ms`,
            transitionTimingFunction: isVisible
              ? 'cubic-bezier(0.16, 1, 0.3, 1)'
              : 'cubic-bezier(0.4, 0, 1, 1)',
          }}
          className={`absolute right-0 mt-2 w-72 sm:w-80 max-w-[calc(100vw-24px)] rounded-2xl border p-3.5 z-50 origin-top-right select-none transition-all ${
            isDark
              ? 'bg-[#18181b]/98 backdrop-blur-xl border-[#2e2e34] text-white shadow-2xl shadow-black/75 ring-1 ring-white/5'
              : 'bg-white/98 backdrop-blur-xl border-[#e4e4e7] text-neutral-900 shadow-2xl shadow-neutral-900/15 ring-1 ring-black/5'
          } ${
            prefersReducedMotion
              ? isVisible
                ? 'opacity-100 pointer-events-auto'
                : 'opacity-0 pointer-events-none'
              : isVisible
              ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto'
              : 'opacity-0 scale-[0.97] -translate-y-1 pointer-events-none'
          } will-change-[opacity,transform] motion-reduce:transition-none motion-reduce:transform-none`}
        >
          {user ? (
            /* Signed In State */
            <div className="space-y-3">
              <div className="flex items-center gap-3 pb-3 border-b border-inherit">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    referrerPolicy="no-referrer"
                    className="w-9 h-9 rounded-full object-cover shrink-0 ring-1 ring-neutral-500"
                  />
                ) : (
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                      isDark ? 'bg-purple-900/50 text-purple-300' : 'bg-purple-100 text-purple-800'
                    }`}
                  >
                    <User className="w-4 h-4" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold truncate">
                      {user.displayName || userProfile?.displayName || 'Authenticated User'}
                    </span>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold tracking-wider uppercase shrink-0 ${
                        isAdmin
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          : 'bg-neutral-500/20 text-neutral-400 border border-neutral-500/30'
                      }`}
                    >
                      {isAdmin ? 'Admin' : 'User'}
                    </span>
                  </div>
                  <div className="text-[11px] text-neutral-400 truncate">
                    {userProfile?.username ? `@${userProfile.username} • ` : ''}
                    {user.email || 'Registered User'}
                  </div>
                  {userProfile?.profession && (
                    <div className="text-[10px] text-purple-400 font-medium truncate mt-0.5">
                      {userProfile.profession}
                    </div>
                  )}
                </div>
              </div>

              {/* Firestore sync status */}
              <div
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-[11px] ${
                  isDark ? 'bg-[#202025] text-neutral-300' : 'bg-neutral-50 text-neutral-700'
                }`}
              >
                <Database className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate">Synced with Firestore Database</span>
              </div>

              {/* Test Mode Section - Hidden from regular users, visible only to authenticated administrator */}
              {isActualAdmin && (
                <div
                  className={`p-2.5 rounded-xl border ${
                    isDark ? 'border-[#27272c] bg-[#141416]' : 'border-neutral-200 bg-neutral-50'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] mb-1.5">
                    <span className="text-neutral-400 font-medium">Test Mode:</span>
                    <span className={`font-mono font-semibold ${isAdmin ? 'text-purple-400' : 'text-neutral-300'}`}>
                      {isAdmin ? 'System Admin' : 'Regular User'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={toggleRole}
                    className={`w-full flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-colors duration-150 cursor-pointer border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50 ${
                      isAdmin
                        ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border-neutral-700'
                        : 'bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border-purple-500/40'
                    }`}
                    title={`Switch to ${isAdmin ? 'Regular User' : 'Administrator'} mode`}
                  >
                    {isAdmin ? <UserCheck className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
                    <span>Switch to {isAdmin ? 'Regular User' : 'Administrator'} Role</span>
                  </button>
                </div>
              )}

              {/* Actions */}
              <div className="space-y-1 pt-1 border-t border-inherit">
                {/* Admin Only: Dashboard Button */}
                {permissions.canAccessAdminDashboard && onOpenAdminDashboard && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenAdminDashboard();
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50 ${
                      isDark
                        ? 'bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30'
                        : 'bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200'
                    }`}
                  >
                    <BarChart3 className="w-3.5 h-3.5 text-purple-400" />
                    <span>Admin Dashboard (Usage & Logs)</span>
                  </button>
                )}

                {/* Non-admin signed-in user: Sign as Admin */}
                {!isAdmin && onOpenAdminSignIn && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      onOpenAdminSignIn();
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-white bg-[#DC143C] hover:bg-[#b81032] active:bg-[#9c0d2a] border border-[#DC143C]/40 transition-colors duration-150 cursor-pointer shadow-sm shadow-red-950/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                  >
                    <Shield className="w-3.5 h-3.5 text-white shrink-0" />
                    <span className="text-white font-medium">Sign as Admin</span>
                  </button>
                )}

                {permissions.canAccessSettings && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenSettings();
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50 ${
                      isDark
                        ? 'hover:bg-[#27272a] text-neutral-300 hover:text-white'
                        : 'hover:bg-neutral-100 text-neutral-700 hover:text-black'
                    }`}
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>Settings & Configuration</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs text-rose-500 hover:bg-rose-500/10 transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/50"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          ) : (
            /* Signed Out State */
            <div className="space-y-3">
              <div className="text-left">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold">Account & Authentication</div>
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-semibold bg-neutral-500/20 text-neutral-400">
                    Not Logged In
                  </span>
                </div>
                <div className="text-[11px] text-neutral-400 mt-0.5">
                  Sign in or create an account to persist conversations across devices.
                </div>
              </div>

              {/* Create Account Primary Button */}
              {onOpenCreateAccount && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onOpenCreateAccount();
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 transition-all duration-150 shadow-sm shadow-purple-950/30 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Create Account</span>
                </button>
              )}

              {/* Sign as Admin Button (Directly underneath Create Account) */}
              {!isAdmin && onOpenAdminSignIn && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onOpenAdminSignIn();
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold text-white bg-[#DC143C] hover:bg-[#b81032] active:bg-[#9c0d2a] border border-[#DC143C]/40 transition-all duration-150 shadow-sm shadow-red-950/30 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                >
                  <Shield className="w-3.5 h-3.5 text-white" />
                  <span className="text-white">Sign as Admin</span>
                </button>
              )}

              {/* Sign in with Google Button */}
              <button
                type="button"
                onClick={handleSignIn}
                disabled={isSigningIn || loading}
                className="w-full flex items-center justify-center gap-2.5 py-2 px-3 rounded-xl text-xs font-medium bg-[#4285f4] hover:bg-[#3367d6] text-white transition-colors duration-150 shadow-sm disabled:opacity-60 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                {isSigningIn ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Connecting to Google...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5 bg-white rounded-full p-0.5 shrink-0" viewBox="0 0 24 24">
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
                    <span>Sign in with Google</span>
                  </>
                )}
              </button>

              {error && (
                <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[11px] flex items-start justify-between">
                  <span>{error}</span>
                  <button onClick={clearError} className="ml-1 text-xs cursor-pointer">✕</button>
                </div>
              )}

              {/* Test Mode Section in guest state - Hidden from regular users, visible only to authenticated administrator */}
              {isActualAdmin && (
                <div
                  className={`p-2.5 rounded-xl border ${
                    isDark ? 'border-[#27272c] bg-[#141416]' : 'border-neutral-200 bg-neutral-50'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] mb-1.5">
                    <span className="text-neutral-400 font-medium">Test Mode:</span>
                    <span className={`font-mono font-semibold ${isAdmin ? 'text-purple-400' : 'text-neutral-300'}`}>
                      {isAdmin ? 'System Admin' : 'Regular User'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={toggleRole}
                    className={`w-full flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-colors duration-150 cursor-pointer border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50 ${
                      isAdmin
                        ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border-neutral-700'
                        : 'bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border-purple-500/40'
                    }`}
                    title={`Switch to ${isAdmin ? 'Regular User' : 'Administrator'} mode`}
                  >
                    {isAdmin ? <UserCheck className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
                    <span>Switch to {isAdmin ? 'Regular User' : 'Administrator'} Role</span>
                  </button>
                </div>
              )}

              {/* Actions in guest mode */}
              <div className="space-y-1 pt-1 border-t border-inherit">
                {permissions.canAccessAdminDashboard && onOpenAdminDashboard && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenAdminDashboard();
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50 ${
                      isDark
                        ? 'bg-purple-600/20 text-purple-300 hover:bg-purple-600/30'
                        : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                    }`}
                  >
                    <BarChart3 className="w-3.5 h-3.5 text-purple-400" />
                    <span>Admin Dashboard</span>
                  </button>
                )}

                {permissions.canAccessSettings && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenSettings();
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50 ${
                      isDark
                        ? 'text-neutral-400 hover:text-white hover:bg-[#202025]'
                        : 'text-neutral-600 hover:text-black hover:bg-neutral-100'
                    }`}
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>Open Settings & Configuration</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
