import React, { createContext, useContext, useState } from 'react';

// The JWT is stored in an httpOnly cookie set by the backend — it is not
// accessible from JavaScript. This context only tracks the user profile
// object (non-sensitive) in memory so components can show the username etc.

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  const isLoggedIn = Boolean(user);

  function login(newUser) {
    // The backend sets the httpOnly cookie; we only keep the user profile in memory.
    setUser(newUser);
  }

  function logout() {
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, isLoggedIn, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export default AuthContext;
