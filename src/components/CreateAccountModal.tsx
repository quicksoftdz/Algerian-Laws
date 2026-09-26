import React, { useState, useEffect } from 'react';
import {
  UserPlus,
  User,
  AtSign,
  Phone,
  Mail,
  Briefcase,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { CreateAccountInput } from '../types/chat';
import { useModalAnimation } from '../hooks/useModalAnimation';

interface CreateAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSignIn?: () => void;
  theme?: 'dark' | 'light';
}

interface FormErrors {
  firstName?: string;
  lastName?: string;
  username?: string;
  phoneNumber?: string;
  email?: string;
  profession?: string;
  general?: string;
}

export const CreateAccountModal: React.FC<CreateAccountModalProps> = ({
  isOpen,
  onClose,
  onOpenSignIn,
  theme = 'dark',
}) => {
  const { user, register, loginWithGoogle } = useAuth();

  const [formData, setFormData] = useState<CreateAccountInput>({
    firstName: '',
    lastName: '',
    username: '',
    phoneNumber: '',
    email: '',
    profession: '',
  });

  const [touched, setTouched] = useState<Record<keyof CreateAccountInput, boolean>>({
    firstName: false,
    lastName: false,
    username: false,
    phoneNumber: false,
    email: false,
    profession: false,
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isDark = theme === 'dark';

  const { isMounted, isVisible, backdropClasses, cardClasses } = useModalAnimation({
    isOpen: Boolean(isOpen && (!user || successMessage)),
  });

  // If user is already authenticated or becomes authenticated, automatically close modal
  useEffect(() => {
    if (user && isOpen && !successMessage) {
      onClose();
    }
  }, [user, isOpen, successMessage, onClose]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        firstName: '',
        lastName: '',
        username: '',
        phoneNumber: '',
        email: '',
        profession: '',
      });
      setTouched({
        firstName: false,
        lastName: false,
        username: false,
        phoneNumber: false,
        email: false,
        profession: false,
      });
      setErrors({});
      setSuccessMessage(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const validateField = (name: keyof CreateAccountInput, value: string): string | undefined => {
    const trimmed = value.trim();

    switch (name) {
      case 'firstName':
        if (!trimmed) return 'First Name is required.';
        if (trimmed.length < 2) return 'First Name must be at least 2 characters.';
        return undefined;

      case 'lastName':
        if (!trimmed) return 'Last Name is required.';
        if (trimmed.length < 2) return 'Last Name must be at least 2 characters.';
        return undefined;

      case 'username':
        if (!trimmed) return 'Username is required.';
        if (trimmed.length < 3) return 'Username must be at least 3 characters.';
        if (trimmed.length > 30) return 'Username cannot exceed 30 characters.';
        if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
          return 'Username can only contain letters, numbers, underscores, and hyphens.';
        }
        return undefined;

      case 'phoneNumber': {
        if (!trimmed) return 'Phone Number is required.';
        const digitsOnly = trimmed.replace(/[^0-9]/g, '');
        if (digitsOnly.length < 7 || digitsOnly.length > 16) {
          return 'Please enter a valid phone number (e.g. +1 555-0199).';
        }
        return undefined;
      }

      case 'email': {
        if (!trimmed) return 'Email Address is required.';
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(trimmed)) {
          return 'Please enter a valid email address (e.g. name@example.com).';
        }
        return undefined;
      }

      case 'profession':
        if (!trimmed) return 'Profession is required.';
        if (trimmed.length < 2) return 'Profession must be at least 2 characters.';
        return undefined;

      default:
        return undefined;
    }
  };

  const validateAll = (): boolean => {
    const newErrors: FormErrors = {};
    (Object.keys(formData) as (keyof CreateAccountInput)[]).forEach((field) => {
      const err = validateField(field, formData[field]);
      if (err) {
        newErrors[field] = err;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (field: keyof CreateAccountInput, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (touched[field]) {
      const fieldError = validateField(field, value);
      setErrors((prev) => ({ ...prev, [field]: fieldError, general: undefined }));
    }
  };

  const handleBlur = (field: keyof CreateAccountInput) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const fieldError = validateField(field, formData[field]);
    setErrors((prev) => ({ ...prev, [field]: fieldError }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Mark all as touched
    setTouched({
      firstName: true,
      lastName: true,
      username: true,
      phoneNumber: true,
      email: true,
      profession: true,
    });

    if (!validateAll()) {
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const created = await register({
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        username: formData.username.trim(),
        phoneNumber: formData.phoneNumber.trim(),
        email: formData.email.trim().toLowerCase(),
        profession: formData.profession.trim(),
      });

      setSuccessMessage(`Welcome, ${created.displayName}! Your account has been created successfully.`);

      // Automatically close modal after brief confirmation
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error('Account creation error:', err);
      const msg = err.message || 'Failed to create account. Please check your details and try again.';
      setErrors((prev) => ({ ...prev, general: msg }));
    } finally {
      setIsSubmitting(false);
    }
  };

  // If already authenticated and not showing success message, or not mounted, hide completely
  if (!isMounted || (user && !successMessage)) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-account-title"
      className={backdropClasses}
    >
      <div
        className={`w-full max-w-lg rounded-2xl border shadow-2xl flex flex-col overflow-hidden ${
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
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 id="create-account-title" className="text-sm font-bold tracking-tight">
                Create an Account
              </h2>
              <p className="text-xs text-neutral-400">
                Register with your details to save chats and preferences
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isSubmitting}
            className={`p-2 rounded-xl transition-colors cursor-pointer disabled:opacity-50 ${
              isDark ? 'hover:bg-[#27272a] text-neutral-400 hover:text-white' : 'hover:bg-neutral-100 text-neutral-600 hover:text-black'
            }`}
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 overflow-y-auto max-h-[80vh]">
          {successMessage ? (
            <div className="py-8 text-center space-y-3 animate-in zoom-in-95 duration-200">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-emerald-400">Account Created Successfully!</h3>
              <p className="text-xs text-neutral-400">{successMessage}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {/* General Error Banner */}
              {errors.general && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2.5 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errors.general}</span>
                </div>
              )}

              {/* First Name & Last Name (2-column layout on desktop) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 1. First Name */}
                <div className="space-y-1">
                  <label
                    htmlFor="reg-firstName"
                    className="block text-xs font-semibold text-neutral-300"
                  >
                    First Name <span className="text-rose-400">*</span>
                  </label>
                  <div
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-colors ${
                      errors.firstName && touched.firstName
                        ? 'border-rose-500/70 bg-rose-500/5'
                        : isDark
                        ? 'border-[#2e2e34] bg-[#1d1d22] focus-within:border-purple-500 focus-within:ring-1 focus-within:ring-purple-500/30'
                        : 'border-neutral-200 bg-neutral-50 focus-within:border-purple-500 focus-within:ring-1 focus-within:ring-purple-500/30'
                    }`}
                  >
                    <User className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                    <input
                      id="reg-firstName"
                      type="text"
                      autoComplete="given-name"
                      placeholder="e.g. Sarah"
                      value={formData.firstName}
                      onChange={(e) => handleChange('firstName', e.target.value)}
                      onBlur={() => handleBlur('firstName')}
                      disabled={isSubmitting}
                      className="w-full bg-transparent text-xs focus:outline-none placeholder:text-neutral-500"
                    />
                  </div>
                  {errors.firstName && touched.firstName && (
                    <p className="text-[11px] text-rose-400 mt-0.5">{errors.firstName}</p>
                  )}
                </div>

                {/* 2. Last Name */}
                <div className="space-y-1">
                  <label
                    htmlFor="reg-lastName"
                    className="block text-xs font-semibold text-neutral-300"
                  >
                    Last Name <span className="text-rose-400">*</span>
                  </label>
                  <div
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-colors ${
                      errors.lastName && touched.lastName
                        ? 'border-rose-500/70 bg-rose-500/5'
                        : isDark
                        ? 'border-[#2e2e34] bg-[#1d1d22] focus-within:border-purple-500 focus-within:ring-1 focus-within:ring-purple-500/30'
                        : 'border-neutral-200 bg-neutral-50 focus-within:border-purple-500 focus-within:ring-1 focus-within:ring-purple-500/30'
                    }`}
                  >
                    <User className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                    <input
                      id="reg-lastName"
                      type="text"
                      autoComplete="family-name"
                      placeholder="e.g. Connor"
                      value={formData.lastName}
                      onChange={(e) => handleChange('lastName', e.target.value)}
                      onBlur={() => handleBlur('lastName')}
                      disabled={isSubmitting}
                      className="w-full bg-transparent text-xs focus:outline-none placeholder:text-neutral-500"
                    />
                  </div>
                  {errors.lastName && touched.lastName && (
                    <p className="text-[11px] text-rose-400 mt-0.5">{errors.lastName}</p>
                  )}
                </div>
              </div>

              {/* 3. Username */}
              <div className="space-y-1">
                <label
                  htmlFor="reg-username"
                  className="block text-xs font-semibold text-neutral-300"
                >
                  Username <span className="text-rose-400">*</span>
                </label>
                <div
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-colors ${
                    errors.username && touched.username
                      ? 'border-rose-500/70 bg-rose-500/5'
                      : isDark
                      ? 'border-[#2e2e34] bg-[#1d1d22] focus-within:border-purple-500 focus-within:ring-1 focus-within:ring-purple-500/30'
                      : 'border-neutral-200 bg-neutral-50 focus-within:border-purple-500 focus-within:ring-1 focus-within:ring-purple-500/30'
                  }`}
                >
                  <AtSign className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                  <input
                    id="reg-username"
                    type="text"
                    autoComplete="username"
                    placeholder="e.g. sarah_connor"
                    value={formData.username}
                    onChange={(e) => handleChange('username', e.target.value)}
                    onBlur={() => handleBlur('username')}
                    disabled={isSubmitting}
                    className="w-full bg-transparent text-xs focus:outline-none placeholder:text-neutral-500 font-mono"
                  />
                </div>
                {errors.username && touched.username && (
                  <p className="text-[11px] text-rose-400 mt-0.5">{errors.username}</p>
                )}
              </div>

              {/* 4. Phone Number */}
              <div className="space-y-1">
                <label
                  htmlFor="reg-phone"
                  className="block text-xs font-semibold text-neutral-300"
                >
                  Phone Number <span className="text-rose-400">*</span>
                </label>
                <div
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-colors ${
                    errors.phoneNumber && touched.phoneNumber
                      ? 'border-rose-500/70 bg-rose-500/5'
                      : isDark
                      ? 'border-[#2e2e34] bg-[#1d1d22] focus-within:border-purple-500 focus-within:ring-1 focus-within:ring-purple-500/30'
                      : 'border-neutral-200 bg-neutral-50 focus-within:border-purple-500 focus-within:ring-1 focus-within:ring-purple-500/30'
                  }`}
                >
                  <Phone className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                  <input
                    id="reg-phone"
                    type="tel"
                    autoComplete="tel"
                    placeholder="e.g. +1 415-555-2671"
                    value={formData.phoneNumber}
                    onChange={(e) => handleChange('phoneNumber', e.target.value)}
                    onBlur={() => handleBlur('phoneNumber')}
                    disabled={isSubmitting}
                    className="w-full bg-transparent text-xs focus:outline-none placeholder:text-neutral-500 font-mono"
                  />
                </div>
                {errors.phoneNumber && touched.phoneNumber && (
                  <p className="text-[11px] text-rose-400 mt-0.5">{errors.phoneNumber}</p>
                )}
                <p className="text-[10px] text-neutral-500">
                  Include your international country code (e.g., +1 for US, +44 for UK, +33 for FR).
                </p>
              </div>

              {/* 5. Email Address */}
              <div className="space-y-1">
                <label
                  htmlFor="reg-email"
                  className="block text-xs font-semibold text-neutral-300"
                >
                  Email Address <span className="text-rose-400">*</span>
                </label>
                <div
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-colors ${
                    errors.email && touched.email
                      ? 'border-rose-500/70 bg-rose-500/5'
                      : isDark
                      ? 'border-[#2e2e34] bg-[#1d1d22] focus-within:border-purple-500 focus-within:ring-1 focus-within:ring-purple-500/30'
                      : 'border-neutral-200 bg-neutral-50 focus-within:border-purple-500 focus-within:ring-1 focus-within:ring-purple-500/30'
                  }`}
                >
                  <Mail className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                  <input
                    id="reg-email"
                    type="email"
                    autoComplete="email"
                    placeholder="e.g. sarah@example.com"
                    value={formData.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    onBlur={() => handleBlur('email')}
                    disabled={isSubmitting}
                    className="w-full bg-transparent text-xs focus:outline-none placeholder:text-neutral-500"
                  />
                </div>
                {errors.email && touched.email && (
                  <p className="text-[11px] text-rose-400 mt-0.5">{errors.email}</p>
                )}
              </div>

              {/* 6. Profession */}
              <div className="space-y-1">
                <label
                  htmlFor="reg-profession"
                  className="block text-xs font-semibold text-neutral-300"
                >
                  Profession <span className="text-rose-400">*</span>
                </label>
                <div
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-colors ${
                    errors.profession && touched.profession
                      ? 'border-rose-500/70 bg-rose-500/5'
                      : isDark
                      ? 'border-[#2e2e34] bg-[#1d1d22] focus-within:border-purple-500 focus-within:ring-1 focus-within:ring-purple-500/30'
                      : 'border-neutral-200 bg-neutral-50 focus-within:border-purple-500 focus-within:ring-1 focus-within:ring-purple-500/30'
                  }`}
                >
                  <Briefcase className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                  <input
                    id="reg-profession"
                    type="text"
                    placeholder="e.g. Software Engineer / Designer / Researcher"
                    value={formData.profession}
                    onChange={(e) => handleChange('profession', e.target.value)}
                    onBlur={() => handleBlur('profession')}
                    disabled={isSubmitting}
                    className="w-full bg-transparent text-xs focus:outline-none placeholder:text-neutral-500"
                  />
                </div>
                {errors.profession && touched.profession && (
                  <p className="text-[11px] text-rose-400 mt-0.5">{errors.profession}</p>
                )}
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 transition-all shadow-md shadow-purple-900/20 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Creating Account...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Create Account</span>
                    </>
                  )}
                </button>
              </div>

              {/* Or Google Sign-In */}
              <div className="relative my-3">
                <div className="absolute inset-0 flex items-center">
                  <div className={`w-full border-t ${isDark ? 'border-neutral-800' : 'border-neutral-200'}`} />
                </div>
                <div className="relative flex justify-center text-[10px] uppercase">
                  <span className={`px-2 ${isDark ? 'bg-[#151518] text-neutral-500' : 'bg-white text-neutral-400'}`}>
                    Or continue with
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={async () => {
                  try {
                    await loginWithGoogle();
                    onClose();
                  } catch {
                    // Handled in context
                  }
                }}
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2.5 py-2 px-3 rounded-xl text-xs font-medium border border-neutral-700 hover:bg-neutral-800 text-neutral-200 transition-colors cursor-pointer"
              >
                <svg className="w-3.5 h-3.5 bg-white rounded-full p-0.5" viewBox="0 0 24 24">
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
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
