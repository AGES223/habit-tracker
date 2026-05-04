/** Decorative preview only — not live app data. */
export default function HeroMockup() {
  return (
    <div className="hero-mock" aria-hidden="true">
      <div className="hero-mock__chrome">
        <span className="hero-mock__dots" />
        Campus rhythm · preview
      </div>

      <div className="hero-mock__row hero-mock__row--habit">
        <span className="hero-mock__accent" />
        <div>
          <div className="hero-mock__habit-title">Deep study block</div>
          <div className="hero-mock__meta">
            Study · <span className="hero-mock__streak">12-day streak</span>
          </div>
        </div>
        <span className="hero-mock__pct">92%</span>
      </div>

      <div className="hero-mock__week" aria-hidden>
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d, i) => (
          <span key={d} className={`hero-mock__dow ${i >= 2 && i <= 5 ? "hero-mock__dow--on" : ""}`}>
            {d}
          </span>
        ))}
      </div>

      <div className="hero-mock__chartWrap">
        <svg className="hero-mock__chart" viewBox="0 0 280 72" preserveAspectRatio="none">
          <defs>
            <linearGradient id="heroMockGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#111" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#111" stopOpacity="0.03" />
            </linearGradient>
          </defs>
          <path
            className="hero-mock__chartFill"
            d="M0,52 L28,46 L56,48 L84,38 L112,42 L140,28 L168,32 L196,22 L224,26 L252,14 L280,18 L280,72 L0,72 Z"
            fill="url(#heroMockGrad)"
          />
          <path
            className="hero-mock__chartLine"
            fill="none"
            stroke="#111"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M0,52 L28,46 L56,48 L84,38 L112,42 L140,28 L168,32 L196,22 L224,26 L252,14 L280,18"
          />
        </svg>
        <div className="hero-mock__chartLabel">Insights · completion trend</div>
      </div>

      <ul className="hero-mock__list">
        <li>
          <span className="hero-mock__check hero-mock__check--done" /> Review lecture notes
        </li>
        <li>
          <span className="hero-mock__check hero-mock__check--done" /> Morning reading
        </li>
        <li>
          <span className="hero-mock__check" /> Lights out on time
        </li>
      </ul>
    </div>
  );
}
