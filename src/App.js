import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./Navbar";
import WelcomePage from "./WelcomePage";
import AuthModal from "./AuthModal";
import HabitTracker from "./habit-tracker";
import { AuthModalProvider } from "./AuthModalContext";
import { getUser, refreshUser, subscribeToAuth } from "./auth";
import "./App.css";

function ProtectedApp() {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState(() => getUser());

  useEffect(() => {
    let live = true;
    refreshUser().then((freshUser) => {
      if (!live) return;
      setUser(freshUser);
      setReady(true);
    });
    const unsubscribe = subscribeToAuth((freshUser) => {
      setUser(freshUser);
      setReady(true);
    });
    return () => {
      live = false;
      unsubscribe();
    };
  }, []);

  if (!ready) return <div className="route-loader">Loading your tracker...</div>;
  if (!user) {
    return <Navigate to="/" replace />;
  }
  return <HabitTracker />;
}

/** Old /login /signup bookmarks: redirect home with state so Welcome opens the modal. */
function AuthDeepLinkRoute({ modal }) {
  return <Navigate to="/" replace state={{ authModal: modal }} />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<WelcomePage />} />
      <Route path="/signup" element={<AuthDeepLinkRoute modal="signup" />} />
      <Route path="/login" element={<AuthDeepLinkRoute modal="login" />} />
      <Route path="/app" element={<ProtectedApp />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthModalProvider>
        <div className="app-shell">
          <Navbar />
          <AuthModal />
          <AppRoutes />
        </div>
      </AuthModalProvider>
    </BrowserRouter>
  );
}
