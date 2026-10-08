import React, { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // sessionStorage is used instead of localStorage so the JWT is not
  // accessible to scripts loaded by other tabs and does not persist
  // beyond the current browser session (mitigates CWE-922 / js/storage-of-sensitive-information).
  const [user, setUser] = useState(() => {
    try {
      const savedUser = sessionStorage.getItem('user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => sessionStorage.getItem('token') || null);

  const isLoggedIn = Boolean(token && user);

  function login(newToken, newUser) {
    setToken(newToken);
    setUser(newUser);
    if (newToken) sessionStorage.setItem('token', newToken);
    if (newUser) sessionStorage.setItem('user', JSON.stringify(newUser));
  }

  function logout() {
    setToken(null);
    setUser(null);
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
  }

  return (
    <AuthContext.Provider value={{ user, token, isLoggedIn, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export default AuthContext;
