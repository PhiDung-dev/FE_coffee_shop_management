import { createContext, useState, useEffect, useCallback } from 'react';
import authService from '../service/authService';
import { parseJwt, isTokenExpired } from '../utils/jwtUtils';

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext(null);

const normalizeUserData = (result, token) => {
  const claims = parseJwt(token) || {};

  const rawScope = result?.role || result?.roles || claims?.scope || '';
  const roles = Array.isArray(rawScope)
    ? rawScope
    : typeof rawScope === 'string' && rawScope.trim() !== ''
      ? rawScope.trim().split(/\s+/)
      : [];

  const primaryRole = roles[0]?.replace(/^ROLE_/, '') || null;
  const email = result?.email ?? claims?.sub ?? '';

  return {
    accountId: result?.accountId ?? result?.id ?? claims?.accountId ?? null,
    username: result?.username ?? email,
    fullName: result?.fullName ?? '',
    email,
    role: primaryRole,
    roles,
  };
};

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem('access_token'));
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    const storedToken = localStorage.getItem('access_token');
    if (storedToken) {
      if (isTokenExpired(storedToken)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        logout();
      } else if (!user) {
        const restoredUser = normalizeUserData({}, storedToken);
        setUser(restoredUser);
        localStorage.setItem('user', JSON.stringify(restoredUser));
      }
    }
    setLoading(false);
  }, [logout, user]);

  const login = async (credentials) => {
    const response = await authService.login(credentials);
    const result = response?.result;
    const accessToken = result?.token || result?.accessToken;

    if (!accessToken) {
      throw new Error('Không nhận được token xác thực từ máy chủ');
    }

    const userData = normalizeUserData(result, accessToken);

    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('user', JSON.stringify(userData));

    setToken(accessToken);
    setUser(userData);

    return userData;
  };

  const hasRole = useCallback(
    (allowedRoles = []) => {
      if (!user || !user.role) return false;
      const list = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
      return list.some(
        (r) => r.replace(/^ROLE_/, '').toUpperCase() === user.role.toUpperCase()
      );
    },
    [user]
  );

  const value = {
    user,
    token,
    loading,
    isAuthenticated: Boolean(token && user),
    login,
    logout,
    hasRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};