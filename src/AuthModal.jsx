import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { logIn, signUp } from "./auth";
import { useAuthModal } from "./AuthModalContext";
import "./App.css";

export default function AuthModal() {
  const { authModalMode, closeAuthModal, switchToLogin, switchToSignUp } = useAuthModal();
  const navigate = useNavigate();
  const overlayRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    if (!authModalMode) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [authModalMode]);

  useEffect(() => {
    if (!authModalMode) return;
    const onKey = (e) => {
      if (e.key === "Escape") closeAuthModal();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [authModalMode, closeAuthModal]);

  if (!authModalMode) return null;

  const onBackdrop = (e) => {
    if (e.target === overlayRef.current) closeAuthModal();
  };

  const node = (
    <div
      ref={overlayRef}
      className="auth-modal-overlay"
      onMouseDown={onBackdrop}
      role="presentation"
    >
      <div
        className="auth-modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="auth-modal-close"
          aria-label="Close dialog"
          onClick={closeAuthModal}
        >
          ×
        </button>
        {authModalMode === "signup" ? (
          <SignUpBody
            titleId={titleId}
            onSuccess={() => {
              closeAuthModal();
              navigate("/app");
            }}
            onSwitchToLogin={switchToLogin}
          />
        ) : (
          <LoginBody
            titleId={titleId}
            onSuccess={() => {
              closeAuthModal();
              navigate("/app");
            }}
            onSwitchToSignUp={switchToSignUp}
          />
        )}
      </div>
    </div>
  );

  return createPortal(node, document.body);
}

function SignUpBody({ titleId, onSuccess, onSwitchToLogin }) {
  const firstFieldRef = useRef(null);

  useEffect(() => {
    firstFieldRef.current?.focus();
  }, []);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    if (name.trim().length < 2) {
      setError("Please enter your name (at least 2 characters).");
      setSubmitting(false);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email.");
      setSubmitting(false);
      return;
    }
    if (password.length < 6) {
      setError("Use at least 6 characters for your password.");
      setSubmitting(false);
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      setSubmitting(false);
      return;
    }
    const result = await signUp({ displayName: name.trim(), email: email.trim(), password });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (result.needsEmailConfirmation) {
      setError("Account created. Check your email to confirm before logging in.");
      return;
    }
    onSuccess();
  };

  return (
    <>
      <h2 id={titleId} className="auth-modal__title">
        Sign up
      </h2>
      <p className="auth-card__sub">Create your Campus rhythm space on this device.</p>
      <p className="auth-card__demo">
        With Supabase configured, this creates a real account. Without config, it stays local for
        development.
      </p>
      <form onSubmit={handleSubmit} className="auth-form">
        {error && <p className="auth-form__error">{error}</p>}
        <label className="auth-label">
          Name
          <input
            ref={firstFieldRef}
            className="auth-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            required
          />
        </label>
        <label className="auth-label">
          Email
          <input
            className="auth-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </label>
        <label className="auth-label">
          Password
          <input
            className="auth-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
        </label>
        <label className="auth-label">
          Confirm password
          <input
            className="auth-input"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
          />
        </label>
        <button type="submit" className="auth-submit">
          {submitting ? "Creating..." : "Create account"}
        </button>
      </form>
      <p className="auth-footer">
        Already registered?{" "}
        <button type="button" className="auth-footer__btn" onClick={onSwitchToLogin}>
          Log in
        </button>
      </p>
    </>
  );
}

function LoginBody({ titleId, onSuccess, onSwitchToSignUp }) {
  const firstFieldRef = useRef(null);

  useEffect(() => {
    firstFieldRef.current?.focus();
  }, []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const result = await logIn({ email, password });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSuccess();
  };

  return (
    <>
      <h2 id={titleId} className="auth-modal__title">
        Log in
      </h2>
      <p className="auth-card__sub">Welcome back—same device, same account you created here.</p>
      <form onSubmit={handleSubmit} className="auth-form">
        {error && <p className="auth-form__error">{error}</p>}
        <label className="auth-label">
          Email
          <input
            ref={firstFieldRef}
            className="auth-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </label>
        <label className="auth-label">
          Password
          <input
            className="auth-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        <button type="submit" className="auth-submit">
          {submitting ? "Logging in..." : "Log in"}
        </button>
      </form>
      <p className="auth-footer">
        New here?{" "}
        <button type="button" className="auth-footer__btn" onClick={onSwitchToSignUp}>
          Sign up
        </button>
      </p>
    </>
  );
}
