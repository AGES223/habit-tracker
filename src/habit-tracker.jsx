import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createHabitStorage } from "./storage";

if (typeof window !== "undefined" && !window.storage) {
  window.storage = createHabitStorage();
}

const PALETTE = [
  "#1B4080",
  "#2D6A4F",
  "#C1440E",
  "#7B2D8B",
  "#B5860D",
  "#1A6B72",
  "#5C3317",
  "#C0392B",
];
const CATEGORIES = ["Study", "Sleep", "Wellness", "Campus", "Social", "Other"];
const LEGACY_CATEGORY_MAP = {
  Health: "Wellness",
  Work: "Study",
  Mind: "Study",
  Social: "Social",
  Creative: "Campus",
  Other: "Other",
};
const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const QUICK_HABITS = [
  { name: "Deep study block", category: "Study" },
  { name: "Review lecture notes", category: "Study" },
  { name: "Reading or problem set", category: "Study" },
  { name: "Lights out on time", category: "Sleep" },
  { name: "Walk or stretch break", category: "Wellness" },
];

const POMODORO_WORK_SEC = 25 * 60;
const POMODORO_BREAK_SEC = 5 * 60;

function buildCalendarDates() {
  const today = new Date();
  const day = today.getDay();
  const week = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - day + i);
    week.push(d.toDateString());
  }
  const todayKey = today.toDateString();
  const todayWeekIndex = week.indexOf(todayKey);
  const year = today.getFullYear();
  const month = today.getMonth();
  const days = new Date(year, month + 1, 0).getDate();
  const monthDates = Array.from({ length: days }, (_, i) =>
    new Date(year, month, i + 1).toDateString()
  );
  const offset = new Date(year, month, 1).getDay();
  return { todayKey, weekDates: week, todayWeekIndex, monthDates, offset };
}

function migrateHabit(h) {
  const mapped = LEGACY_CATEGORY_MAP[h.category] ?? h.category;
  const category = CATEGORIES.includes(mapped) ? mapped : "Other";
  return { ...h, category, weekdaysOnly: !!h.weekdaysOnly };
}

function isWeekendDateKey(dateKey) {
  const dow = new Date(dateKey).getDay();
  return dow === 0 || dow === 6;
}

function streakForHabit(habitId, completions, weekdaysOnly) {
  let s = 0;
  const d = new Date();
  for (let guard = 0; guard < 400; guard++) {
    const key = d.toDateString();
    const dow = d.getDay();
    const weekend = dow === 0 || dow === 6;
    if (weekdaysOnly && weekend) {
      d.setDate(d.getDate() - 1);
      continue;
    }
    if (completions[`${habitId}_${key}`]) {
      s++;
      d.setDate(d.getDate() - 1);
    } else break;
  }
  return s;
}

function habitsDueOnDate(habits, dateKey) {
  return habits.filter((h) => !h.weekdaysOnly || !isWeekendDateKey(dateKey));
}

function statsForDay(habits, completions, dateKey) {
  const due = habitsDueOnDate(habits, dateKey);
  if (due.length === 0) return { done: 0, total: 0, pct: 0, empty: true };
  let done = 0;
  for (const h of due) {
    if (completions[`${h.id}_${dateKey}`]) done++;
  }
  return { done, total: due.length, pct: done / due.length, empty: false };
}

function buildDailySeries(habits, completions, numDays) {
  const out = [];
  const today = new Date();
  for (let i = numDays - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toDateString();
    const s = statsForDay(habits, completions, key);
    out.push({
      key,
      dow: d.getDay(),
      dayNum: d.getDate(),
      month: d.getMonth(),
      pct: s.empty ? null : s.pct,
      done: s.done,
      total: s.total,
      empty: s.empty,
    });
  }
  return out;
}

function categoryCompletionCounts(habits, completions) {
  const byCat = Object.fromEntries(CATEGORIES.map((c) => [c, 0]));
  const habitMap = Object.fromEntries(habits.map((h) => [String(h.id), h]));
  for (const k of Object.keys(completions)) {
    if (!completions[k]) continue;
    const u = k.indexOf("_");
    if (u < 0) continue;
    const id = k.slice(0, u);
    const h = habitMap[id];
    if (h && byCat[h.category] !== undefined) byCat[h.category]++;
  }
  return byCat;
}

const CAT_CHART_COLORS = {
  Study: "#1B4080",
  Sleep: "#7B2D8B",
  Wellness: "#2D6A4F",
  Campus: "#B5860D",
  Social: "#1A6B72",
  Other: "#5C3317",
};

function InsightsPanel({ habits, completions, accent }) {
  const [animateBars, setAnimateBars] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimateBars(true));
    return () => cancelAnimationFrame(id);
  }, [habits, completions]);

  const series = useMemo(() => buildDailySeries(habits, completions, 14), [habits, completions]);
  const series7 = useMemo(() => buildDailySeries(habits, completions, 7), [habits, completions]);

  const avg7 = useMemo(() => {
    const valid = series7.filter((d) => d.pct != null);
    if (!valid.length) return null;
    return valid.reduce((a, d) => a + d.pct, 0) / valid.length;
  }, [series7]);

  const bestDay = useMemo(() => {
    let best = null;
    for (const d of series) {
      if (d.pct == null) continue;
      if (!best || d.pct > best.pct) best = d;
    }
    return best;
  }, [series]);

  const catCounts = useMemo(() => categoryCompletionCounts(habits, completions), [habits, completions]);
  const catMax = Math.max(1, ...Object.values(catCounts));

  const W = 340;
  const H = 132;
  const padL = 30;
  const padR = 8;
  const padT = 14;
  const padB = 28;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const n = series.length;
  const xAt = (i) => padL + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const yAt = (pct) => padT + plotH * (1 - pct);

  const points = series.map((d, i) => {
    const p = d.pct == null ? 0 : d.pct;
    return { x: xAt(i), y: yAt(p), raw: d };
  });

  const lineD = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaD =
    points.length > 0
      ? `${lineD} L${points[points.length - 1].x.toFixed(1)},${padT + plotH} L${points[0].x.toFixed(1)},${padT + plotH} Z`
      : "";

  if (habits.length === 0) {
    return (
      <div className="insights-empty" style={st.insightsEmpty}>
        <div style={st.insightsEmptyEmoji}>📊</div>
        <div style={st.insightsEmptyTitle}>no data yet</div>
        <div style={st.insightsEmptySub}>add habits — charts appear like magic (almost)</div>
      </div>
    );
  }

  return (
    <div className="insights-root">
      <div className="insights-hero" style={st.insightsHero}>
        <div style={st.insightsHeroTop}>
          <span style={st.insightsBadge}>orbit check</span>
          <span style={st.insightsSparkle} aria-hidden>
            ✦
          </span>
        </div>
        <div style={st.insightsHeroGrid}>
          <div>
            <div style={st.insightsHeroLabel}>7-day average</div>
            <div style={{ ...st.insightsHeroBig, color: accent }}>
              {avg7 == null ? "—" : `${Math.round(avg7 * 100)}%`}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={st.insightsHeroLabel}>best day (14d)</div>
            <div style={st.insightsHeroSmall}>
              {bestDay
                ? `${DAY_LABELS[bestDay.dow]} ${bestDay.month + 1}/${bestDay.dayNum} · ${Math.round(bestDay.pct * 100)}%`
                : "—"}
            </div>
          </div>
        </div>
      </div>

      <div style={st.insightsCard}>
        <div style={st.insightsCardTitle}>daily completion</div>
        <div style={st.insightsCardSub}>last 14 days · % of habits you marked done</div>
        <div className="insights-chart-wrap" style={st.insightsChartWrap}>
          <svg
            className="insights-svg"
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label="Line chart of daily completion rate for the last fourteen days"
          >
            <defs>
              <linearGradient id="orbitFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={accent} stopOpacity="0.35" />
                <stop offset="100%" stopColor={accent} stopOpacity="0.02" />
              </linearGradient>
              <linearGradient id="orbitLine" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#2D6A4F" />
                <stop offset="50%" stopColor={accent} />
                <stop offset="100%" stopColor="#C1440E" />
              </linearGradient>
            </defs>
            {[0, 0.25, 0.5, 0.75, 1].map((t) => (
              <line
                key={t}
                x1={padL}
                x2={W - padR}
                y1={yAt(t)}
                y2={yAt(t)}
                stroke="#ede9e2"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
            ))}
            {areaD && <path d={areaD} fill="url(#orbitFill)" className="insights-area" />}
            {lineD && (
              <path
                d={lineD}
                fill="none"
                stroke="url(#orbitLine)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="insights-line"
              />
            )}
            {points.map((p, i) => (
              <g key={p.raw.key}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={p.raw.pct == null ? 3 : 4.5}
                  fill={p.raw.pct == null ? "#e0dbd3" : "#fff"}
                  stroke={p.raw.pct == null ? "#ddd" : accent}
                  strokeWidth="2"
                  className="insights-dot"
                  style={{ animationDelay: `${i * 0.04}s` }}
                />
                <text
                  x={p.x}
                  y={H - 6}
                  textAnchor="middle"
                  fill="#aaa"
                  fontSize="8"
                  fontFamily="IBM Plex Mono, monospace"
                >
                  {DAY_LABELS[p.raw.dow]}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </div>

      <div style={st.insightsCard}>
        <div style={st.insightsCardTitle}>check-ins by category</div>
        <div style={st.insightsCardSub}>all time · every tick you logged</div>
        <div style={st.insightsBars}>
          {CATEGORIES.map((cat, idx) => {
            const c = catCounts[cat] || 0;
            const w = animateBars ? (c / catMax) * 100 : 0;
            return (
              <div key={cat} style={st.insightsBarRow}>
                <span style={st.insightsBarLabel}>{cat}</span>
                <div style={st.insightsBarTrack}>
                  <div
                    className="insights-bar-fill"
                    style={{
                      ...st.insightsBarFill,
                      width: `${w}%`,
                      background: CAT_CHART_COLORS[cat] || accent,
                      transitionDelay: `${idx * 0.06}s`,
                    }}
                  />
                </div>
                <span style={st.insightsBarCount}>{c}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function FocusTimer({ accent }) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState("work");
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const [left, setLeft] = useState(POMODORO_WORK_SEC);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setLeft((t) => {
        if (t <= 1) {
          setRunning(false);
          const next = phaseRef.current === "work" ? "break" : "work";
          setPhase(next);
          return next === "break" ? POMODORO_BREAK_SEC : POMODORO_WORK_SEC;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  const label = phase === "work" ? "focus" : "break";

  if (!open) {
    return (
      <button
        type="button"
        className="focus-pill"
        style={{ ...st.focusPill, borderColor: accent }}
        onClick={() => setOpen(true)}
      >
        25m focus
      </button>
    );
  }

  return (
    <div style={{ ...st.focusPanel, borderColor: accent }}>
      <div style={st.focusHead}>
        <span style={{ ...st.focusPhase, color: accent }}>{label}</span>
        <button type="button" style={st.focusClose} onClick={() => setOpen(false)}>
          ×
        </button>
      </div>
      <div style={st.focusClock}>
        {mm}:{ss}
      </div>
      <div style={st.focusActions}>
        <button
          type="button"
          style={{ ...st.focusBtn, background: accent, color: "#fff" }}
          onClick={() => setRunning((r) => !r)}
        >
          {running ? "pause" : "start"}
        </button>
        <button
          type="button"
          style={st.focusBtnGhost}
          onClick={() => {
            setRunning(false);
            setLeft(phase === "work" ? POMODORO_WORK_SEC : POMODORO_BREAK_SEC);
          }}
        >
          reset
        </button>
        <button
          type="button"
          style={st.focusBtnGhost}
          onClick={() => {
            setRunning(false);
            setPhase(phase === "work" ? "break" : "work");
            setLeft(phase === "work" ? POMODORO_BREAK_SEC : POMODORO_WORK_SEC);
          }}
        >
          {phase === "work" ? "skip to break" : "skip to focus"}
        </button>
      </div>
    </div>
  );
}

export default function HabitTracker() {
  const [habits, setHabits] = useState([]);
  const [completions, setCompletions] = useState({});
  const [view, setView] = useState("week");
  const [showAdd, setShowAdd] = useState(false);
  const [editNoteId, setEditNoteId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState("All");
  const [dayTick, setDayTick] = useState(0);
  const [form, setForm] = useState({
    name: "",
    color: PALETTE[0],
    category: "Study",
    note: "",
    weekdaysOnly: false,
  });

  const { todayKey, weekDates, todayWeekIndex, monthDates, offset } = useMemo(() => {
    void dayTick;
    return buildCalendarDates();
  }, [dayTick]);

  useEffect(() => {
    const bump = () => setDayTick((t) => t + 1);
    const onVis = () => {
      if (document.visibilityState === "visible") bump();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", bump);
    const id = setInterval(bump, 5 * 60 * 1000);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", bump);
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const h = await window.storage.get("ht_habits");
        const c = await window.storage.get("ht_completions");
        if (h) setHabits(JSON.parse(h.value).map(migrateHabit));
        if (c) setCompletions(JSON.parse(c.value));
      } catch {
        /* ignore */
      }
      setLoading(false);
    }
    load();
  }, []);

  const persist = useCallback(async (h, c) => {
    try {
      await window.storage.set("ht_habits", JSON.stringify(h));
      await window.storage.set("ht_completions", JSON.stringify(c));
    } catch {
      /* ignore */
    }
  }, []);

  const addHabit = (partial) => {
    const name = (partial?.name ?? form.name).trim();
    if (!name) return;
    const h = {
      id: Date.now(),
      name,
      color: partial?.color ?? form.color,
      category: partial?.category ?? form.category,
      note: partial?.note ?? form.note ?? "",
      weekdaysOnly: partial?.weekdaysOnly ?? form.weekdaysOnly,
    };
    const updated = [...habits, h];
    setHabits(updated);
    setForm({
      name: "",
      color: PALETTE[updated.length % PALETTE.length],
      category: "Study",
      note: "",
      weekdaysOnly: false,
    });
    setShowAdd(false);
    persist(updated, completions);
  };

  const quickAdd = (preset) => {
    const h = {
      id: Date.now(),
      name: preset.name,
      color: PALETTE[habits.length % PALETTE.length],
      category: preset.category,
      note: "",
      weekdaysOnly: false,
    };
    const updated = [...habits, h];
    setHabits(updated);
    persist(updated, completions);
  };

  const deleteHabit = (id) => {
    const updated = habits.filter((h) => h.id !== id);
    setHabits(updated);
    persist(updated, completions);
  };

  const saveNote = (id, note) => {
    const updated = habits.map((h) => (h.id === id ? { ...h, note } : h));
    setHabits(updated);
    setEditNoteId(null);
    persist(updated, completions);
  };

  const toggleWeekdaysOnly = (id) => {
    const updated = habits.map((h) =>
      h.id === id ? { ...h, weekdaysOnly: !h.weekdaysOnly } : h
    );
    setHabits(updated);
    persist(updated, completions);
  };

  const toggle = (habitId, dateKey, weekdaysOnly) => {
    if (dateKey !== todayKey) return;
    if (weekdaysOnly && isWeekendDateKey(dateKey)) return;
    const key = `${habitId}_${dateKey}`;
    const updated = { ...completions, [key]: !completions[key] };
    if (!updated[key]) delete updated[key];
    setCompletions(updated);
    persist(habits, updated);
  };

  const isDone = (habitId, dateKey) => !!completions[`${habitId}_${dateKey}`];

  const todayDone = habits.filter(
    (h) => !h.weekdaysOnly || !isWeekendDateKey(todayKey)
  ).filter((h) => isDone(h.id, todayKey)).length;
  const todayTotal = habits.filter(
    (h) => !h.weekdaysOnly || !isWeekendDateKey(todayKey)
  ).length;

  const filtered =
    filterCat === "All" ? habits : habits.filter((h) => h.category === filterCat);

  const accentColor = habits[0]?.color ?? "#1B4080";
  const todayPct = todayTotal ? Math.round((todayDone / todayTotal) * 100) : 0;
  const activeStreak = habits.reduce(
    (best, habit) => Math.max(best, streakForHabit(habit.id, completions, habit.weekdaysOnly)),
    0
  );
  const completedAllToday = todayTotal > 0 && todayDone === todayTotal;
  const dashboardStats = [
    {
      label: "today",
      value: todayTotal ? `${todayDone}/${todayTotal}` : "rest",
      sub: todayTotal ? `${todayPct}% complete` : "no habits due",
    },
    {
      label: "best streak",
      value: `${activeStreak}`,
      sub: activeStreak === 1 ? "day active" : "days active",
    },
    {
      label: "library",
      value: `${habits.length}`,
      sub: habits.length === 1 ? "habit saved" : "habits saved",
    },
  ];

  if (loading)
    return (
      <div style={st.loader}>
        <span style={st.loaderText}>loading...</span>
      </div>
    );

  return (
    <div className="tracker-shell" style={st.root}>
      <style>{css}</style>

      <div className="tracker-hero" style={st.header}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={st.kicker}>{completedAllToday ? "daily rhythm locked" : "today's rhythm"}</div>
          <div style={st.title}>campus rhythm</div>
          <div style={st.meta}>
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
            {habits.length > 0 &&
              (todayTotal > 0
                ? ` · ${todayDone}/${todayTotal} checked today`
                : " · weekend — Mon–Fri habits rest")}
          </div>
        </div>
        <div style={st.headerActions}>
          <FocusTimer accent={accentColor} />
          <button
            type="button"
            className="icon-btn"
            style={st.addBtn}
            onClick={() => setShowAdd((v) => !v)}
            aria-expanded={showAdd}
            aria-label={showAdd ? "Close add habit form" : "Add a habit"}
          >
            {showAdd ? "×" : "+"}
          </button>
        </div>
      </div>

      <div className="tracker-stats" style={st.statsGrid} aria-label="Tracker summary">
        {dashboardStats.map((stat) => (
          <div key={stat.label} style={st.statCard}>
            <span style={st.statLabel}>{stat.label}</span>
            <strong style={{ ...st.statValue, color: stat.label === "today" ? accentColor : "#141414" }}>
              {stat.value}
            </strong>
            <span style={st.statSub}>{stat.sub}</span>
          </div>
        ))}
      </div>

      {habits.length < 6 && (
        <div style={st.quickRow}>
          <span style={st.quickLabel}>quick add</span>
          <div style={st.quickChips}>
            {QUICK_HABITS.map((q) => (
              <button
                type="button"
                key={q.name}
                className="quick-chip"
                style={st.quickChip}
                onClick={() => quickAdd(q)}
              >
                {q.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {showAdd && (
        <div style={st.addPanel}>
          <input
            style={st.input}
            placeholder="habit name (e.g. library session)..."
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            onKeyDown={(e) => e.key === "Enter" && addHabit()}
            autoFocus
          />
          <textarea
            style={{ ...st.input, height: 56, resize: "none", marginTop: 8 }}
            placeholder="context: class, goal, or link (optional)..."
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
          />
          <label style={st.weekdayCheck}>
            <input
              type="checkbox"
              checked={form.weekdaysOnly}
              onChange={(e) =>
                setForm((f) => ({ ...f, weekdaysOnly: e.target.checked }))
              }
            />
            <span>Mon–Fri only (classes & study blocks)</span>
          </label>
          <div style={st.row}>
            {CATEGORIES.map((cat) => (
              <button
                type="button"
                key={cat}
                className="cat-chip"
                style={{
                  ...st.chip,
                  background: form.category === cat ? "#111" : "#f0ede8",
                  color: form.category === cat ? "#fff" : "#666",
                }}
                onClick={() => setForm((f) => ({ ...f, category: cat }))}
              >
                {cat}
              </button>
            ))}
          </div>
          <div style={st.row}>
            {PALETTE.map((c) => (
              <button
                type="button"
                key={c}
                className="color-dot"
                style={{
                  ...st.colorDot,
                  background: c,
                  outlineColor: form.color === c ? c : "transparent",
                }}
                onClick={() => setForm((f) => ({ ...f, color: c }))}
              />
            ))}
          </div>
          <button
            type="button"
            style={{ ...st.confirmBtn, background: form.color }}
            onClick={() => addHabit()}
          >
            add habit
          </button>
        </div>
      )}

      <div className="tracker-toolbar" style={st.toolbar}>
        <div style={{ ...st.row, flex: 1, minWidth: 0 }}>
          {[
            ["week", "week"],
            ["month", "month"],
            ["stats", "insights"],
          ].map(([v, label]) => (
            <button
              type="button"
              key={v}
              className="view-btn"
              style={{
                ...st.viewBtn,
                background: view === v ? "#111" : "transparent",
                color: view === v ? "#fff" : "#aaa",
              }}
              onClick={() => setView(v)}
            >
              {label}
            </button>
          ))}
        </div>
        {view !== "stats" ? (
          <select
            style={st.select}
            value={filterCat}
            onChange={(e) => setFilterCat(e.target.value)}
          >
            <option>All</option>
            {CATEGORIES.map((c) => (
              <option key={c}>
                {c}
              </option>
            ))}
          </select>
        ) : (
          <span style={st.insightsFilterSpacer} aria-hidden />
        )}
      </div>

      {view === "week" && (
        <>
          <div style={st.weekHead}>
            <div style={{ flex: 1 }} />
            {weekDates.map((d, i) => (
              <div
                key={d}
                style={{
                  ...st.dayLabel,
                  fontWeight: i === todayWeekIndex ? 700 : 400,
                  color: i === todayWeekIndex ? "#111" : "#ccc",
                }}
              >
                {DAY_LABELS[i]}
              </div>
            ))}
            <div style={{ width: 32 }} />
          </div>
          <div style={st.list}>
            {filtered.length === 0 && <Empty />}
            {filtered.map((habit) => {
              const s = streakForHabit(habit.id, completions, habit.weekdaysOnly);
              return (
                <div key={habit.id} style={st.card} className="habit-card">
                  <div style={st.cardTop} className="habit-card__top">
                    <div style={st.habitLeft}>
                      <div style={{ ...st.colorBar, background: habit.color }} />
                      <div style={{ minWidth: 0 }}>
                        <div style={st.habitName}>{habit.name}</div>
                        <div style={st.subRow}>
                          <span style={{ ...st.catBadge, color: habit.color }}>
                            {habit.category}
                          </span>
                          {habit.weekdaysOnly && (
                            <span style={st.weekdayBadge}>Mon–Fri</span>
                          )}
                          {s > 0 && <span style={st.streakBadge}>{s}-day streak</span>}
                        </div>
                        <button
                          type="button"
                          style={st.weekdayToggle}
                          onClick={() => toggleWeekdaysOnly(habit.id)}
                        >
                          {habit.weekdaysOnly ? "count weekends too" : "Mon–Fri only"}
                        </button>
                      </div>
                    </div>
                    <div style={st.checks} className="habit-card__checks">
                      {weekDates.map((d, i) => {
                        const done = isDone(habit.id, d);
                        const isToday = d === todayKey;
                        const future = i > todayWeekIndex;
                        const weekendOff =
                          habit.weekdaysOnly && isWeekendDateKey(d);
                        const disabled = future || weekendOff || !isToday;
                        return (
                          <button
                            type="button"
                            key={d}
                            className={isToday ? "check-today" : ""}
                            title={weekendOff ? "weekend — not counted" : undefined}
                            aria-label={`${habit.name}, ${DAY_LABELS[i]}${done ? ", complete" : ""}`}
                            style={{
                              ...st.check,
                              background: done
                                ? habit.color
                                : isToday
                                  ? "#f0ede8"
                                  : "transparent",
                              border: done
                                ? `2px solid ${habit.color}`
                                : isToday
                                  ? "2px solid #d8d3cc"
                                  : "2px solid #ede9e2",
                              opacity: future || weekendOff ? 0.22 : 1,
                              cursor: !disabled ? "pointer" : "default",
                            }}
                            onClick={() =>
                              !disabled && toggle(habit.id, d, habit.weekdaysOnly)
                            }
                          >
                            {done && <span className="checkmark" aria-hidden="true" />}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      className="del-btn"
                      style={st.del}
                      onClick={() => deleteHabit(habit.id)}
                      aria-label={`Delete ${habit.name}`}
                    >
                      ×
                    </button>
                  </div>
                  {editNoteId === habit.id ? (
                    <NoteEditor
                      initial={habit.note}
                      color={habit.color}
                      onSave={(note) => saveNote(habit.id, note)}
                      onCancel={() => setEditNoteId(null)}
                    />
                  ) : habit.note ? (
                    <div
                      style={st.notePreview}
                      onClick={() => setEditNoteId(habit.id)}
                      onKeyDown={(e) => e.key === "Enter" && setEditNoteId(habit.id)}
                      role="button"
                      tabIndex={0}
                    >
                      {habit.note}
                    </div>
                  ) : (
                    <div
                      style={st.noteAdd}
                      onClick={() => setEditNoteId(habit.id)}
                      onKeyDown={(e) => e.key === "Enter" && setEditNoteId(habit.id)}
                      role="button"
                      tabIndex={0}
                    >
                      + context
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {view === "month" && (
        <div>
          <div style={st.monthTitle}>
            {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </div>
          <div style={st.monthDayRow}>
            {DAY_LABELS.map((d) => (
              <div key={d} style={st.monthDayLabel}>
                {d}
              </div>
            ))}
          </div>
          {filtered.length === 0 && <Empty />}
          {filtered.map((habit) => (
            <div key={habit.id} style={st.monthBlock}>
              <div style={st.monthHabitLabel}>
                <div style={{ ...st.colorBar, background: habit.color, height: 14 }} />
                <span style={st.habitName}>{habit.name}</span>
                {habit.weekdaysOnly && (
                  <span style={st.monthWeekdayHint}>Mon–Fri</span>
                )}
              </div>
              <div style={st.monthGrid}>
                {Array.from({ length: offset }).map((_, i) => (
                  <div key={`off-${i}`} style={st.mCell} />
                ))}
                {monthDates.map((d, i) => {
                  const done = isDone(habit.id, d);
                  const isToday = d === todayKey;
                  const future = new Date(d) > new Date();
                  const weekendOff = habit.weekdaysOnly && isWeekendDateKey(d);
                  const disabled = future || weekendOff || !isToday;
                  return (
                    <button
                      type="button"
                      key={d}
                      style={{
                        ...st.mCell,
                        background: done ? habit.color : "transparent",
                        border: isToday ? `2px solid ${habit.color}` : "2px solid #eee",
                        opacity: future || weekendOff ? 0.2 : 1,
                        cursor: !disabled ? "pointer" : "default",
                        color: done ? "#fff" : "#bbb",
                        fontSize: 9,
                      }}
                      onClick={() =>
                        !disabled && toggle(habit.id, d, habit.weekdaysOnly)
                      }
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {view === "stats" && (
        <InsightsPanel habits={habits} completions={completions} accent={accentColor} />
      )}

      {habits.length > 0 && todayTotal > 0 && (
        <div style={st.progressWrap}>
          <div style={st.progressTrack}>
            <div
              style={{
                ...st.progressFill,
                width: `${(todayDone / todayTotal) * 100}%`,
                background: todayDone === todayTotal ? "#2D6A4F" : "#1B4080",
              }}
            />
          </div>
          <div style={st.progressLabel}>
            {todayDone === todayTotal
              ? "all set for today"
              : `${todayPct}% of today’s habits`}
          </div>
        </div>
      )}
    </div>
  );
}

function NoteEditor({ initial, onSave, onCancel, color }) {
  const [val, setVal] = useState(initial || "");
  return (
    <div style={{ marginTop: 8 }}>
      <textarea
        style={{
          width: "100%",
          background: "#f5f2ee",
          border: "none",
          borderRadius: 8,
          padding: "8px 10px",
          fontFamily: "'IBM Plex Mono',monospace",
          fontSize: 12,
          color: "#111",
          outline: "none",
          resize: "none",
          height: 48,
        }}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        autoFocus
      />
      <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
        <button
          type="button"
          style={{
            background: color,
            color: "#fff",
            border: "none",
            borderRadius: 6,
            padding: "4px 12px",
            fontSize: 11,
            fontFamily: "'IBM Plex Mono',monospace",
            cursor: "pointer",
          }}
          onClick={() => onSave(val)}
        >
          save
        </button>
        <button
          type="button"
          style={{
            background: "#eee",
            color: "#666",
            border: "none",
            borderRadius: 6,
            padding: "4px 12px",
            fontSize: 11,
            fontFamily: "'IBM Plex Mono',monospace",
            cursor: "pointer",
          }}
          onClick={onCancel}
        >
          cancel
        </button>
      </div>
    </div>
  );
}

function Empty() {
  return (
    <div style={{ textAlign: "center", padding: "56px 0" }}>
      <div style={{ fontSize: 34, color: "#e0dbd3", marginBottom: 10 }}>◇</div>
      <div
        style={{
          fontFamily: "'Playfair Display',serif",
          fontSize: 20,
          color: "#ccc",
        }}
      >
        no habits yet
      </div>
      <div style={{ fontSize: 11, color: "#ccc", marginTop: 6, letterSpacing: "0.05em" }}>
        use quick add or + — small daily wins beat perfect plans
      </div>
    </div>
  );
}

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=IBM+Plex+Mono:wght@300;400;500&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #f4f1eb; }
  .icon-btn { transition: transform 0.2s ease; }
  .icon-btn:hover { transform: rotate(15deg) scale(1.1); }
  .habit-card { transition: box-shadow 0.18s ease, border-color 0.18s ease, transform 0.18s ease; }
  .habit-card:hover { box-shadow: 0 14px 34px rgba(34,30,25,0.08); border-color: #ded5c9 !important; transform: translateY(-1px); }
  .check-today { transition: transform 0.1s; }
  .check-today:hover { transform: scale(1.18); }
  .del-btn { opacity: 0 !important; transition: opacity 0.15s; }
  .habit-card:hover .del-btn { opacity: 1 !important; }
  .checkmark {
    width: 7px;
    height: 11px;
    border: solid #fff;
    border-width: 0 2px 2px 0;
    transform: rotate(45deg) translateY(-1px);
    display: block;
  }
  .color-dot { transition: transform 0.1s; outline-width: 2.5px; outline-style: solid; outline-offset: 2px; }
  .color-dot:hover { transform: scale(1.2); }
  .view-btn, .cat-chip { transition: all 0.15s; }
  .focus-pill { transition: background 0.15s, border-color 0.15s; }
  .focus-pill:hover { background: #f0ede8; }
  .quick-chip { transition: background 0.15s, border-color 0.15s; }
  .quick-chip:hover { background: #111 !important; color: #fff !important; border-color: #111 !important; }
  .insights-root { animation: insightsIn 0.45s ease-out; }
  @keyframes insightsIn {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .insights-hero::after {
    content: "";
    position: absolute;
    width: 100px;
    height: 100px;
    left: -20px;
    bottom: -30px;
    background: radial-gradient(circle, rgba(27,64,128,0.12) 0%, transparent 70%);
    pointer-events: none;
  }
  .insights-line {
    stroke-dasharray: 400;
    stroke-dashoffset: 400;
    animation: drawLine 1.1s ease forwards 0.15s;
  }
  .insights-area {
    opacity: 0;
    animation: fadeArea 0.8s ease forwards 0.4s;
  }
  @keyframes drawLine { to { stroke-dashoffset: 0; } }
  @keyframes fadeArea { to { opacity: 1; } }
  .insights-dot {
    animation: dotPop 0.35s ease backwards;
  }
  @keyframes dotPop {
    from { transform: scale(0); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }
  .insights-bar-fill { transition: width 0.75s cubic-bezier(0.22, 1, 0.36, 1); }
  .insights-svg { display: block; width: 100%; height: auto; max-height: 200px; }
  .insights-chart-wrap { min-height: 120px; }
  @media (min-width: 860px) {
    .tracker-shell {
      border-left: 1px solid #e5ded4;
      border-right: 1px solid #e5ded4;
      box-shadow: 0 28px 80px rgba(31,28,24,0.06);
    }
    .tracker-stats {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }
  @media (max-width: 700px) {
    .tracker-hero {
      flex-direction: column;
    }
    .tracker-toolbar {
      align-items: stretch !important;
      flex-direction: column;
    }
    .tracker-stats {
      grid-template-columns: 1fr;
    }
    .habit-card__top {
      align-items: flex-start !important;
      flex-wrap: wrap;
    }
    .habit-card__checks {
      width: 100%;
      justify-content: space-between;
      padding-left: 15px;
    }
  }
  @media (max-width: 400px) {
    .view-btn { padding: 5px 10px; font-size: 10px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .insights-root { animation: none; }
    .insights-line { animation: none !important; stroke-dashoffset: 0 !important; }
    .insights-area { animation: none !important; opacity: 1 !important; }
    .insights-dot { animation: none !important; }
    .insights-bar-fill { transition: none; }
  }
`;

const st = {
  root: {
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top left, rgba(27,64,128,0.08), transparent 32%), linear-gradient(180deg, #fbfaf7 0%, #f4f1eb 100%)",
    maxWidth: 980,
    width: "100%",
    margin: "0 auto",
    padding: "clamp(18px, 4vw, 34px) clamp(14px, 4vw, 34px) 120px",
    boxSizing: "border-box",
  },
  loader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100vh",
    background: "#faf9f6",
  },
  loaderText: { fontFamily: "'IBM Plex Mono',monospace", color: "#bbb", fontSize: 13 },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
    gap: 18,
    background: "rgba(255,255,255,0.78)",
    border: "1px solid #e9e1d7",
    borderRadius: 18,
    padding: "clamp(16px, 3vw, 24px)",
    boxShadow: "0 18px 50px rgba(34,30,25,0.06)",
  },
  headerActions: { display: "flex", alignItems: "center", gap: 10, flexShrink: 0 },
  kicker: {
    fontFamily: "'IBM Plex Mono',monospace",
    fontSize: 10,
    color: "#8a8176",
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  focusPill: {
    fontFamily: "'IBM Plex Mono',monospace",
    fontSize: 11,
    padding: "8px 12px",
    borderRadius: 20,
    border: "2px solid #1B4080",
    background: "#fff",
    color: "#111",
    cursor: "pointer",
  },
  focusPanel: {
    position: "fixed",
    bottom: 72,
    right: 20,
    left: 20,
    maxWidth: 320,
    marginLeft: "auto",
    background: "#fff",
    border: "2px solid #1B4080",
    borderRadius: 14,
    padding: "14px 16px 16px",
    boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
    zIndex: 20,
  },
  focusHead: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  focusPhase: { fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" },
  focusClose: {
    border: "none",
    background: "transparent",
    fontSize: 20,
    lineHeight: 1,
    color: "#ccc",
    cursor: "pointer",
  },
  focusClock: {
    fontFamily: "'Playfair Display',serif",
    fontSize: 42,
    color: "#111",
    textAlign: "center",
    marginTop: 4,
    letterSpacing: "-1px",
  },
  focusActions: { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12, justifyContent: "center" },
  focusBtn: {
    border: "none",
    borderRadius: 8,
    padding: "8px 16px",
    fontSize: 11,
    fontFamily: "'IBM Plex Mono',monospace",
    cursor: "pointer",
  },
  focusBtnGhost: {
    border: "1px solid #ddd",
    borderRadius: 8,
    padding: "8px 12px",
    fontSize: 10,
    fontFamily: "'IBM Plex Mono',monospace",
    cursor: "pointer",
    background: "#faf9f6",
    color: "#555",
  },
  title: {
    fontFamily: "'Playfair Display',serif",
    fontSize: "clamp(34px, 6vw, 52px)",
    color: "#111",
    letterSpacing: "-1.5px",
    lineHeight: 1.05,
  },
  meta: {
    fontFamily: "'IBM Plex Mono',monospace",
    fontSize: 11,
    color: "#8a8176",
    marginTop: 8,
    lineHeight: 1.6,
  },
  addBtn: {
    width: 38,
    height: 38,
    borderRadius: "50%",
    background: "#111",
    color: "#fff",
    border: "none",
    fontSize: 22,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 1,
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: 10,
    marginBottom: 18,
  },
  statCard: {
    background: "#fff",
    border: "1px solid #e9e1d7",
    borderRadius: 14,
    padding: "13px 14px",
    boxShadow: "0 8px 24px rgba(34,30,25,0.04)",
  },
  statLabel: {
    display: "block",
    fontFamily: "'IBM Plex Mono',monospace",
    fontSize: 9,
    color: "#9a9288",
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    marginBottom: 7,
  },
  statValue: {
    display: "block",
    fontFamily: "'Playfair Display',serif",
    fontSize: 31,
    lineHeight: 1,
    letterSpacing: "-0.5px",
  },
  statSub: {
    display: "block",
    fontFamily: "'IBM Plex Mono',monospace",
    fontSize: 10,
    color: "#9a9288",
    marginTop: 7,
  },
  quickRow: {
    background: "rgba(255,255,255,0.64)",
    border: "1px solid #e9e1d7",
    borderRadius: 14,
    padding: 14,
    marginBottom: 18,
  },
  quickLabel: { fontSize: 10, color: "#bbb", letterSpacing: "0.12em", textTransform: "uppercase", display: "block", marginBottom: 8 },
  quickChips: { display: "flex", gap: 8, flexWrap: "wrap" },
  quickChip: {
    fontFamily: "'IBM Plex Mono',monospace",
    fontSize: 10,
    padding: "7px 11px",
    borderRadius: 20,
    border: "1px solid #ded6cc",
    background: "#fff",
    color: "#555",
    cursor: "pointer",
  },
  addPanel: {
    background: "#fff",
    border: "1px solid #e1d8cd",
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    boxShadow: "0 16px 38px rgba(34,30,25,0.07)",
  },
  weekdayCheck: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    fontSize: 11,
    color: "#666",
    cursor: "pointer",
  },
  input: {
    width: "100%",
    background: "#faf8f4",
    border: "1px solid #e8dfd4",
    borderRadius: 10,
    padding: "11px 12px",
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
    fontSize: 14,
    color: "#111",
    outline: "none",
  },
  row: { display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10, alignItems: "center" },
  chip: {
    borderRadius: 20,
    padding: "4px 11px",
    fontSize: 11,
    border: "none",
    cursor: "pointer",
    fontFamily: "'IBM Plex Mono',monospace",
  },
  colorDot: {
    width: 22,
    height: 22,
    borderRadius: "50%",
    border: "none",
    cursor: "pointer",
  },
  confirmBtn: {
    marginTop: 12,
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "11px 20px",
    fontSize: 12,
    fontFamily: "'IBM Plex Mono',monospace",
    cursor: "pointer",
  },
  toolbar: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginBottom: 18,
    justifyContent: "space-between",
    alignItems: "center",
    background: "rgba(255,255,255,0.72)",
    border: "1px solid #e9e1d7",
    borderRadius: 14,
    padding: 10,
  },
  viewBtn: {
    borderRadius: 10,
    padding: "8px 14px",
    fontSize: 11,
    border: "1px solid #ded6cc",
    cursor: "pointer",
    fontFamily: "'IBM Plex Mono',monospace",
  },
  select: {
    fontFamily: "'IBM Plex Mono',monospace",
    fontSize: 11,
    border: "1px solid #ded6cc",
    borderRadius: 10,
    padding: "8px 10px",
    background: "#fff",
    color: "#777",
    cursor: "pointer",
    outline: "none",
  },
  weekHead: {
    display: "flex",
    alignItems: "center",
    marginBottom: 8,
    padding: "0 8px",
    fontFamily: "'IBM Plex Mono',monospace",
  },
  dayLabel: { width: 30, textAlign: "center", fontSize: 10 },
  list: { display: "flex", flexDirection: "column", gap: 12 },
  card: {
    background: "rgba(255,255,255,0.92)",
    border: "1px solid #e9e1d7",
    borderRadius: 14,
    padding: "14px 14px 11px",
    boxShadow: "0 5px 18px rgba(34,30,25,0.035)",
  },
  cardTop: { display: "flex", alignItems: "center", gap: 8 },
  habitLeft: { display: "flex", alignItems: "flex-start", gap: 10, flex: 1, minWidth: 0 },
  colorBar: { width: 5, height: 40, borderRadius: 4, flexShrink: 0 },
  habitName: {
    fontSize: 15,
    fontWeight: 650,
    color: "#111",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  subRow: { display: "flex", gap: 8, alignItems: "center", marginTop: 2, flexWrap: "wrap" },
  catBadge: { fontSize: 10 },
  weekdayBadge: { fontSize: 10, color: "#888" },
  streakBadge: { fontSize: 10, color: "#aaa" },
  weekdayToggle: {
    display: "block",
    marginTop: 4,
    padding: 0,
    border: "none",
    background: "transparent",
    fontSize: 9,
    color: "#c4beb4",
    cursor: "pointer",
    fontFamily: "'IBM Plex Mono',monospace",
    textAlign: "left",
  },
  checks: { display: "flex", gap: 4, flexShrink: 0 },
  check: {
    width: 30,
    height: 30,
    borderRadius: 9,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  del: {
    width: 24,
    height: 24,
    border: "none",
    background: "transparent",
    color: "#ccc",
    fontSize: 10,
    cursor: "pointer",
  },
  notePreview: { fontSize: 11, color: "#aaa", marginTop: 8, paddingLeft: 14, cursor: "pointer" },
  noteAdd: {
    fontSize: 10,
    color: "#d0cbc3",
    marginTop: 6,
    paddingLeft: 14,
    cursor: "pointer",
    letterSpacing: "0.04em",
  },
  monthTitle: {
    fontFamily: "'Playfair Display',serif",
    fontSize: 24,
    color: "#111",
    marginBottom: 14,
    letterSpacing: "-0.5px",
  },
  monthDayRow: { display: "grid", gridTemplateColumns: "repeat(7, 30px)", gap: 4, marginBottom: 12 },
  monthDayLabel: { width: 30, textAlign: "center", fontSize: 9, color: "#bbb", fontWeight: 500 },
  monthBlock: { marginBottom: 28 },
  monthHabitLabel: { display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" },
  monthWeekdayHint: { fontSize: 9, color: "#aaa" },
  monthGrid: { display: "grid", gridTemplateColumns: "repeat(7, 30px)", gap: 4 },
  mCell: {
    width: 30,
    height: 28,
    borderRadius: 6,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'IBM Plex Mono',monospace",
  },
  progressWrap: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    background: "rgba(250,249,246,0.95)",
    borderTop: "1px solid #eee",
    padding: "12px 24px 16px",
    backdropFilter: "blur(8px)",
    zIndex: 10,
  },
  progressTrack: {
    height: 3,
    background: "#eee",
    borderRadius: 4,
    overflow: "hidden",
    maxWidth: 680,
    margin: "0 auto",
  },
  progressFill: { height: "100%", borderRadius: 4, transition: "width 0.4s ease" },
  progressLabel: {
    textAlign: "center",
    fontSize: 10,
    color: "#bbb",
    marginTop: 6,
    letterSpacing: "0.05em",
  },
  insightsFilterSpacer: { minWidth: 80, flexShrink: 0 },
  insightsEmpty: {
    textAlign: "center",
    padding: "48px 16px",
    borderRadius: 16,
    border: "1px dashed #ddd",
    background: "linear-gradient(180deg, #fff 0%, #faf8ff 100%)",
  },
  insightsEmptyEmoji: { fontSize: 40, marginBottom: 8 },
  insightsEmptyTitle: {
    fontFamily: "'Playfair Display',serif",
    fontSize: 22,
    color: "#bbb",
  },
  insightsEmptySub: { fontSize: 11, color: "#ccc", marginTop: 8 },
  insightsHero: {
    position: "relative",
    background: "linear-gradient(125deg, #fffefb 0%, #eef4ff 42%, #fff5f2 88%)",
    borderRadius: 16,
    padding: "clamp(14px, 3vw, 20px)",
    border: "1px solid #e8e3dc",
    marginBottom: 14,
    boxShadow: "0 6px 24px rgba(27,64,128,0.06)",
  },
  insightsHeroTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  insightsBadge: {
    fontSize: 9,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: "#888",
    fontWeight: 600,
  },
  insightsSparkle: { fontSize: 18, color: "#C1440E", opacity: 0.85 },
  insightsHeroGrid: { display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-end" },
  insightsHeroLabel: { fontSize: 10, color: "#999", marginBottom: 4 },
  insightsHeroBig: {
    fontFamily: "'Playfair Display',serif",
    fontSize: "clamp(36px, 10vw, 48px)",
    lineHeight: 1,
    letterSpacing: "-2px",
  },
  insightsHeroSmall: { fontSize: 12, color: "#444", fontWeight: 500 },
  insightsCard: {
    background: "#fff",
    border: "1px solid #ede9e2",
    borderRadius: 14,
    padding: "clamp(14px, 3vw, 18px)",
    marginBottom: 12,
    boxShadow: "0 2px 16px rgba(0,0,0,0.04)",
  },
  insightsCardTitle: {
    fontFamily: "'Playfair Display',serif",
    fontSize: 18,
    color: "#111",
    letterSpacing: "-0.3px",
  },
  insightsCardSub: { fontSize: 10, color: "#aaa", marginTop: 4, marginBottom: 12 },
  insightsChartWrap: { width: "100%", overflow: "hidden" },
  insightsBars: { display: "flex", flexDirection: "column", gap: 10 },
  insightsBarRow: {
    display: "grid",
    gridTemplateColumns: "minmax(72px, 22%) 1fr 28px",
    alignItems: "center",
    gap: "clamp(6px, 2vw, 10px)",
  },
  insightsBarLabel: { fontSize: 10, color: "#666", overflow: "hidden", textOverflow: "ellipsis" },
  insightsBarTrack: {
    height: 10,
    borderRadius: 8,
    background: "#f0ede8",
    overflow: "hidden",
  },
  insightsBarFill: {
    height: "100%",
    borderRadius: 8,
    width: 0,
    boxShadow: "0 0 12px rgba(0,0,0,0.08)",
  },
  insightsBarCount: { fontSize: 10, color: "#aaa", textAlign: "right" },
};
