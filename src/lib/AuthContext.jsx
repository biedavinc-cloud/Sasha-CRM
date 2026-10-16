import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { api } from '@/api/client';
import { setReferralBase } from '@/lib/format';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [authError, setAuthError] = useState(null);

  const checkUserAuth = useCallback(async () => {
    try {
      setIsLoadingAuth(true);
      const cfg = api.config().then((c) => setReferralBase(c && c.referralBaseUrl)).catch(() => {});
      const me = await api.auth.me();
      await cfg;
      setUser(me);
      setAuthError(null);
    } catch (error) {
      setUser(null);
      // 401 just means "not signed in" — anything else is a real failure (network, server)
      if (error.status !== 401) {
        setAuthError({ type: 'unknown', status: error.status, message: error.message || 'Failed to load your session' });
      } else {
        setAuthError(null);
      }
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  }, []);

  useEffect(() => {
    checkUserAuth();
  }, [checkUserAuth]);

  const logout = async (shouldRedirect = true) => {
    setUser(null);
    await api.auth.logout(shouldRedirect ? '/login' : undefined);
  };

  const navigateToLogin = () => {
    const returnTo = window.location.pathname + window.location.search;
    window.location.href = '/login' + (returnTo !== '/' ? '?returnTo=' + encodeURIComponent(returnTo) : '');
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      isLoadingAuth,
      authError,
      authChecked,
      logout,
      navigateToLogin,
      checkUserAuth,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
