import { createContext, useContext, useMemo, useState } from "react";

const AuthModalContext = createContext(null);

export function AuthModalProvider({ children }) {
  const [mode, setMode] = useState(null);

  const value = useMemo(
    () => ({
      authModalOpen: mode !== null,
      authModalMode: mode,
      openLogin: () => setMode("login"),
      openSignUp: () => setMode("signup"),
      switchToLogin: () => setMode("login"),
      switchToSignUp: () => setMode("signup"),
      closeAuthModal: () => setMode(null),
    }),
    [mode]
  );

  return <AuthModalContext.Provider value={value}>{children}</AuthModalContext.Provider>;
}

export function useAuthModal() {
  const ctx = useContext(AuthModalContext);
  if (!ctx) throw new Error("useAuthModal must be used within AuthModalProvider");
  return ctx;
}
