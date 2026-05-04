import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getUser, logOut, refreshUser, subscribeToAuth } from "./auth";
import { useAuthModal } from "./AuthModalContext";
import "./App.css";

export default function Navbar() {
  const [user, setUser] = useState(() => getUser());
  const loc = useLocation();
  const navigate = useNavigate();
  const { openLogin, openSignUp } = useAuthModal();
  const onApp = loc.pathname === "/app";

  useEffect(() => {
    let live = true;
    refreshUser().then((freshUser) => live && setUser(freshUser));
    const unsubscribe = subscribeToAuth(setUser);
    return () => {
      live = false;
      unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    await logOut();
    setUser(null);
    navigate("/");
  };

  return (
    <header className="site-nav">
      <Link to="/" className="site-nav__brand">
        Campus rhythm
      </Link>
      <nav className="site-nav__links" aria-label="Main">
        {user ? (
          <>
            <Link
              to="/app"
              className={`site-nav__link ${onApp ? "site-nav__link--active" : ""}`}
            >
              My tracker
            </Link>
            <button type="button" className="site-nav__ghost" onClick={handleSignOut}>
              Sign out
            </button>
          </>
        ) : (
          <>
            <button type="button" className="site-nav__link site-nav__link--btn" onClick={openLogin}>
              Log in
            </button>
            <button type="button" className="site-nav__cta site-nav__cta--btn" onClick={openSignUp}>
              Sign up
            </button>
          </>
        )}
      </nav>
    </header>
  );
}
