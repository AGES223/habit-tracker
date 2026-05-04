import { useEffect, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getUser } from "./auth";
import { useAuthModal } from "./AuthModalContext";
import HeroMockup from "./HeroMockup";
import "./App.css";

const QUOTES = [
  { text: "You don’t have to be extreme—just consistent.", by: "Anonymous" },
  { text: "One hour of focused work beats three hours of drift.", by: "Campus rhythm" },
  { text: "Progress is rarely loud. Keep showing up.", by: "Anonymous" },
  { text: "Your future self is built from today’s small choices.", by: "Anonymous" },
  { text: "Discipline is remembering what you want.", by: "David Campbell" },
  { text: "Start where you are. Use what you have. Do what you can.", by: "Arthur Ashe" },
  { text: "The expert in anything was once a beginner.", by: "Helen Hayes" },
  { text: "Small steps every day add up to a semester you’re proud of.", by: "Campus rhythm" },
  { text: "Energy flows where attention goes.", by: "Campus rhythm" },
  { text: "You are allowed to be both a masterpiece and a work in progress.", by: "Sophia Bush" },
  { text: "What we plant in the soil of contemplation, we reap in the harvest of action.", by: "Meister Eckhart" },
  { text: "It always seems impossible until it’s done.", by: "Nelson Mandela" },
  { text: "Don’t count the days; make the days count.", by: "Muhammad Ali" },
  { text: "The secret of getting ahead is getting started.", by: "Mark Twain" },
  { text: "You may delay, but time will not.", by: "Benjamin Franklin" },
  { text: "Quality is not an act, it is a habit.", by: "Aristotle" },
  { text: "Fall seven times, stand up eight.", by: "Japanese proverb" },
  { text: "A calm mind is a productive mind.", by: "Campus rhythm" },
  { text: "Reading is to the mind what exercise is to the body.", by: "Joseph Addison" },
  { text: "The only way to do great work is to love what you do.", by: "Steve Jobs" },
  { text: "Success is the sum of small efforts, repeated day in and day out.", by: "Robert Collier" },
  { text: "You miss 100% of the shots you don’t take.", by: "Wayne Gretzky" },
  { text: "I am not a product of my circumstances. I am a product of my decisions.", by: "Stephen Covey" },
  { text: "Believe you can and you’re halfway there.", by: "Theodore Roosevelt" },
  { text: "Do what you can, with what you have, where you are.", by: "Theodore Roosevelt" },
  { text: "He who has a why can bear almost any how.", by: "Friedrich Nietzsche" },
  { text: "Rest is not idleness—it fuels your next sprint.", by: "Campus rhythm" },
  { text: "Courage doesn’t always roar. Sometimes it’s the quiet voice at the end of the day saying, I’ll try again tomorrow.", by: "Mary Anne Radmacher" },
  { text: "The best time to plant a tree was 20 years ago. The second best time is now.", by: "Chinese proverb" },
  { text: "You are never too old to set another goal or to dream a new dream.", by: "C.S. Lewis" },
  { text: "What lies behind us and what lies before us are tiny matters compared to what lies within us.", by: "Ralph Waldo Emerson" },
  { text: "If you want to lift yourself up, lift up someone else.", by: "Booker T. Washington" },
  { text: "Hard choices, easy life. Easy choices, hard life.", by: "Jerzy Gregorek" },
  { text: "Your habits will make or break you.", by: "Campus rhythm" },
  { text: "Be stubborn about your goals and flexible about your methods.", by: "Anonymous" },
  { text: "Ship your work—even drafts move you forward.", by: "Campus rhythm" },
  { text: "Comparison is the thief of joy.", by: "Theodore Roosevelt" },
  { text: "Done is better than perfect.", by: "Sheryl Sandberg" },
  { text: "The mind is everything. What you think you become.", by: "Buddha" },
  { text: "Act as if what you do makes a difference. It does.", by: "William James" },
  { text: "Simplicity is the ultimate sophistication.", by: "Leonardo da Vinci" },
  { text: "When you feel like quitting, remember why you started.", by: "Anonymous" },
];

function dailyQuoteIndex() {
  const d = new Date();
  const start = new Date(d.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((d - start) / 86400000);
  return Math.abs((dayOfYear + d.getFullYear() * 367) % QUOTES.length);
}

export default function WelcomePage() {
  const user = getUser();
  const { openSignUp, openLogin } = useAuthModal();
  const location = useLocation();
  const navigate = useNavigate();
  const quote = useMemo(() => QUOTES[dailyQuoteIndex()], []);

  useEffect(() => {
    const m = location.state?.authModal;
    if (m !== "login" && m !== "signup") return;
    if (m === "login") openLogin();
    else openSignUp();
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.state, location.pathname, navigate, openLogin, openSignUp]);

  return (
    <main className="welcome">
      <section className="welcome__hero" aria-labelledby="welcome-heading">
        <div className="welcome__heroGrid">
          <div className="welcome__heroCopy">
            <p className="welcome__eyebrow">Student habit tracker</p>
            <h1 id="welcome-heading" className="welcome__title">
              Build better habits, one day at a time.
            </h1>
            <p className="welcome__lede">
              Track routines, protect your streaks, and see progress with simple weekly views and
              gentle insights—built for busy semesters.
            </p>

            {user ? (
              <div className="welcome__actions">
                <Link to="/app" className="welcome__btn welcome__btn--hero">
                  Open my tracker
                </Link>
                <p className="welcome__signed">
                  Signed in as <strong>{user.displayName || user.email}</strong>
                </p>
              </div>
            ) : (
              <>
                <div className="welcome__actions">
                  <button
                    type="button"
                    className="welcome__btn welcome__btn--hero"
                    onClick={openSignUp}
                  >
                    Get Started Free
                  </button>
                  <button
                    type="button"
                    className="welcome__btn welcome__btn--ghost welcome__btn--heroSecondary"
                    onClick={openLogin}
                  >
                    Log in
                  </button>
                </div>
                <p className="welcome__trust">
                  <span className="welcome__trustBadge" aria-hidden />
                  Private on this device · No paid plan · Focus timer + Mon–Fri habits included
                </p>
              </>
            )}
          </div>

          <div className="welcome__heroVisual">
            <p className="welcome__mockCaption">What you’ll see inside</p>
            <HeroMockup />
          </div>
        </div>
      </section>

      <section className="welcome__quote" aria-live="polite">
        <div className="welcome__quoteInner">
          <span className="welcome__quoteMark" aria-hidden>
            “
          </span>
          <blockquote className="welcome__quoteText">{quote.text}</blockquote>
          <footer className="welcome__quoteBy">— {quote.by}</footer>
          <p className="welcome__quoteHint">A fresh line every calendar day.</p>
        </div>
      </section>
    </main>
  );
}
