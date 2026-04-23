import { createContext, useContext, useEffect, useState } from "react";
import { authApi, Token } from "../api/client";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [needsSetup, setNeedsSetup] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      const { needsSetup } = await authApi.needsSetup();
      setNeedsSetup(needsSetup);

      if (!needsSetup && Token.get()) {
        try {
          const { user } = await authApi.me();
          setUser(user);
        } catch {
          Token.clear();
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const login = async (username, password) => {
    const { user, token } = await authApi.login(username, password);
    Token.set(token);
    setUser(user);
    setNeedsSetup(false);
  };

  const createFirstUser = async (username, password) => {
    const { user, token } = await authApi.createFirstUser(username, password);
    Token.set(token);
    setUser(user);
    setNeedsSetup(false);
  };

  const logout = () => {
    Token.clear();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, needsSetup, loading, login, createFirstUser, logout, refresh }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};
