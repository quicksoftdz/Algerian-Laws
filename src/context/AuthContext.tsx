import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { User as FirebaseUser, onAuthStateChanged } from 'firebase/auth';
import {
  auth,
  signInWithGoogle,
  logOut,
  syncUserProfile,
  createAccountInFirestore,
  getUserProfileFromFirestore,
  authenticateAdminCredentials,
} from '../lib/firebase';
import { UserRole, UserPermissions, UserProfile, CreateAccountInput } from '../types/chat';
import { getPermissionsForRole } from '../utils/permissions';

const ADMIN_EMAIL = 'kerbadou.g@gmail.com';

export interface AppAuthUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

interface AuthContextType {
  user: AppAuthUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  role: UserRole;
  isAdmin: boolean;
  isActualAdmin: boolean;
  permissions: UserPermissions;
  setRole: (role: UserRole) => void;
  toggleRole: () => void;
  loginWithGoogle: () => Promise<void>;
  register: (input: CreateAccountInput) => Promise<UserProfile>;
  loginAsAdmin: (identifier: string, password: string) => Promise<UserProfile>;
  logout: () => Promise<void>;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  loading: true,
  role: 'user',
  isAdmin: false,
  isActualAdmin: false,
  permissions: getPermissionsForRole('user'),
  setRole: () => {},
  toggleRole: () => {},
  loginWithGoogle: async () => {},
  register: async () => {
    throw new Error('Not implemented');
  },
  loginAsAdmin: async () => {
    throw new Error('Not implemented');
  },
  logout: async () => {},
  error: null,
  clearError: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppAuthUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Stored role preference (supports live testing/demonstration of roles)
  const [roleOverride, setRoleOverride] = useState<UserRole | null>(() => {
    try {
      const saved = localStorage.getItem('app_user_role_override');
      return saved === 'admin' || saved === 'user' ? saved : null;
    } catch {
      return null;
    }
  });

  // Calculate whether current user is an authenticated administrator
  const isActualAdmin = useMemo(() => {
    if (user?.email && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
      return true;
    }
    if (userProfile?.role === 'admin') {
      return true;
    }
    return false;
  }, [user, userProfile]);

  // Calculate user role:
  // 1. If user is an actual admin and actively testing the regular user view via roleOverride, respect it.
  // 2. If authenticated administrator, role is 'admin'.
  // 3. Regular users and unauthenticated guests are always 'user'.
  const role: UserRole = useMemo(() => {
    if (isActualAdmin && roleOverride) {
      return roleOverride;
    }
    if (isActualAdmin) {
      return 'admin';
    }
    return 'user';
  }, [isActualAdmin, roleOverride]);

  const isAdmin = role === 'admin';
  const permissions = useMemo(() => getPermissionsForRole(role), [role]);

  // Load any local registered account profile on mount
  useEffect(() => {
    try {
      const savedProfile = localStorage.getItem('app_registered_user_profile');
      if (savedProfile) {
        const parsed: UserProfile = JSON.parse(savedProfile);
        if (parsed && parsed.uid) {
          setUserProfile(parsed);
          setUser({
            uid: parsed.uid,
            displayName: parsed.displayName,
            email: parsed.email,
            photoURL: parsed.photoURL || null,
          });
        }
      }
    } catch (e) {
      console.debug('No local user profile', e);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const authUser: AppAuthUser = {
          uid: currentUser.uid,
          displayName: currentUser.displayName,
          email: currentUser.email,
          photoURL: currentUser.photoURL,
        };
        setUser(authUser);
        // Fetch or sync full profile
        try {
          const profile = await getUserProfileFromFirestore(currentUser.uid);
          if (profile) {
            setUserProfile(profile);
          }
        } catch {
          // ignore
        }
      } else {
        // If not signed into Firebase Auth, check if we have a locally stored registered session
        try {
          const savedProfile = localStorage.getItem('app_registered_user_profile');
          if (savedProfile) {
            const parsed: UserProfile = JSON.parse(savedProfile);
            if (parsed && parsed.uid) {
              setUserProfile(parsed);
              setUser({
                uid: parsed.uid,
                displayName: parsed.displayName,
                email: parsed.email,
                photoURL: parsed.photoURL || null,
              });
            } else {
              setUser(null);
              setUserProfile(null);
            }
          } else {
            setUser(null);
            setUserProfile(null);
          }
        } catch {
          setUser(null);
          setUserProfile(null);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSetRole = (newRole: UserRole) => {
    setRoleOverride(newRole);
    try {
      localStorage.setItem('app_user_role_override', newRole);
    } catch {
      // ignore
    }
    if (auth.currentUser) {
      syncUserProfile(auth.currentUser, newRole).catch(console.error);
    }
  };

  const handleToggleRole = () => {
    if (!isActualAdmin) return;
    const nextRole: UserRole = role === 'admin' ? 'user' : 'admin';
    handleSetRole(nextRole);
  };

  const handleLogin = async () => {
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Sign-in popup was closed. Please try again.');
      } else if (err.code === 'auth/popup-blocked') {
        setError('Pop-up was blocked by the browser. Please allow popups for this site.');
      } else {
        setError(err.message || 'Failed to sign in with Google');
      }
    }
  };

  const handleRegister = async (input: CreateAccountInput): Promise<UserProfile> => {
    setError(null);
    try {
      const createdProfile = await createAccountInFirestore(input);
      setUserProfile(createdProfile);
      const authUser: AppAuthUser = {
        uid: createdProfile.uid,
        displayName: createdProfile.displayName,
        email: createdProfile.email,
        photoURL: createdProfile.photoURL || null,
      };
      setUser(authUser);
      try {
        localStorage.setItem('app_registered_user_profile', JSON.stringify(createdProfile));
      } catch {
        // ignore
      }
      return createdProfile;
    } catch (err: any) {
      console.error('Registration failed:', err);
      setError(err.message || 'Failed to create account.');
      throw err;
    }
  };

  const handleAdminLogin = async (identifier: string, password: string): Promise<UserProfile> => {
    setError(null);
    try {
      const adminProfile = await authenticateAdminCredentials(identifier, password);
      setUserProfile(adminProfile);
      const authUser: AppAuthUser = {
        uid: adminProfile.uid,
        displayName: adminProfile.displayName,
        email: adminProfile.email,
        photoURL: adminProfile.photoURL || null,
      };
      setUser(authUser);
      setRoleOverride('admin');
      try {
        localStorage.setItem('app_registered_user_profile', JSON.stringify(adminProfile));
        localStorage.setItem('app_user_role_override', 'admin');
      } catch {
        // ignore
      }
      return adminProfile;
    } catch (err: any) {
      console.error('Admin authentication failed:', err);
      setError(err.message || 'Invalid administrator credentials.');
      throw err;
    }
  };

  const handleLogout = async () => {
    setError(null);
    try {
      try {
        localStorage.removeItem('app_registered_user_profile');
        localStorage.removeItem('app_user_role_override');
      } catch {
        // ignore
      }
      setUser(null);
      setUserProfile(null);
      setRoleOverride(null);
      if (auth.currentUser) {
        await logOut();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to sign out');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        loading,
        role,
        isAdmin,
        isActualAdmin,
        permissions,
        setRole: handleSetRole,
        toggleRole: handleToggleRole,
        loginWithGoogle: handleLogin,
        register: handleRegister,
        loginAsAdmin: handleAdminLogin,
        logout: handleLogout,
        error,
        clearError: () => setError(null),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
