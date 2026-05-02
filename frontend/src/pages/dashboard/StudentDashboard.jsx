import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  QrCode,
  Timer,
  Trophy,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchDashboardStats } from "../../api/dashboardAPI";
import { fetchAttendanceAIInsights } from "../../api/attendanceAPI";
import { fetchStudySuggestions } from "../../api/geminiAPI";
import AIInsightsPanel from "../../components/dashboard/AIInsightsPanel";
import RecentActivity from "../../components/dashboard/RecentActivity";
import StatsCard from "../../components/dashboard/StatsCard";
import useAuth from "../../hooks/useAuth";
import { Reveal } from "../../components/ui/Reveal";
import { getApiErrorMessage } from "../../utils/getApiErrorMessage";

const grades = [
  { label: "Algorithm Quiz 2", grade: "A", tone: "green" },
  { label: "UI/UX Project Phase 1", grade: "A-", tone: "blue" },
  { label: "OS Midterm", grade: "B+", tone: "orange" },
];

const StudentDashboard = () => {
  const { user } = useAuth();
  const firstName = user?.name?.split(/\s+/)[0] || "there";
  const today = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());

  const [dash, setDash] = useState(null);
  const [dashLoading, setDashLoading] = useState(true);
  const [dashError, setDashError] = useState("");
  const [aiTip, setAiTip] = useState("");
  const [aiLoading, setAiLoading] = useState(true);
  const [aiErr, setAiErr] = useState("");
  const [studyTip, setStudyTip] = useState("");
  const [studyLoading, setStudyLoading] = useState(true);
  const [studyErr, setStudyErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setDashLoading(true);
      setDashError("");
      try {
        const { data } = await fetchDashboardStats();
        if (!cancelled) setDash(data);
      } catch (e) {
        if (!cancelled)
          setDashError(getApiErrorMessage(e, "Could not load dashboard."));
      } finally {
        if (!cancelled) setDashLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setAiLoading(true);
      setAiErr("");
      try {
        const { data } = await fetchAttendanceAIInsights();
        const text =
          typeof data?.aiTips === "string"
            ? data.aiTips
            : "Review your attendance and bookings on the dashboard.";
        const short =
          text.length > 280 ? `${text.slice(0, 277).trim()}…` : text;
        if (!cancelled) setAiTip(short);
      } catch (e) {
        if (!cancelled)
          setAiErr(
            getApiErrorMessage(
              e,
              "AI insights unavailable (check GEMINI_API_KEY on the server).",
            ),
          );
      } finally {
        if (!cancelled) setAiLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStudyLoading(true);
      setStudyErr("");
      try {
        const { data } = await fetchStudySuggestions({
          subjects: grades.map((g) => g.label),
        });
        const text =
          typeof data?.suggestion === "string"
            ? data.suggestion
            : "Join a session from Room Booking.";
        const short =
          text.length > 320 ? `${text.slice(0, 317).trim()}…` : text;
        if (!cancelled) setStudyTip(short);
      } catch (e) {
        if (!cancelled)
          setStudyErr(
            getApiErrorMessage(
              e,
              "Study suggestions need GEMINI_API_KEY and a signed-in user.",
            ),
          );
      } finally {
        if (!cancelled) setStudyLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = dash?.stats;
  const attendanceDisplay =
    stats?.myAttendancePercent != null
      ? `${stats.myAttendancePercent}%`
      : "—";
  const joinedDisplay =
    stats?.myBookingsJoined != null ? String(stats.myBookingsJoined) : "—";

  return (
    <main className="dashboard-page">
      {dashError ? (
        <p className="page-banner error" role="alert">
          {dashError}
        </p>
      ) : null}

      <Reveal className="dashboard-hero" y={24}>
        <div>
          <p className="eyebrow">Student dashboard</p>
          <h1>Welcome, {firstName}</h1>
          <p>Here's what's happening on campus today, {today}.</p>
        </div>
        <div className="hero-actions">
          <Link className="secondary-action" to="/bookings">
            <CalendarDays size={17} />
            <span>Full schedule</span>
          </Link>
          <Link className="primary-action" to="/attendance">
            <QrCode size={17} />
            <span>Mark attendance</span>
          </Link>
        </div>
      </Reveal>

      <section className="dashboard-grid">
        <AIInsightsPanel
          tip={aiTip}
          loading={aiLoading}
          error={aiErr || undefined}
          studyTip={studyTip}
          studyLoading={studyLoading}
          studyError={studyErr || undefined}
        />

        <div className="stat-grid">
          <StatsCard
            icon={CheckCircle2}
            label="My attendance"
            value={dashLoading ? "…" : attendanceDisplay}
            change={
              stats?.myAttendancePercent != null ? "last 200 records" : "—"
            }
            tone="green"
          />
          <StatsCard
            icon={Timer}
            label="Sessions I'm in"
            value={dashLoading ? "…" : joinedDisplay}
            tone="orange"
          />
        </div>

        <article className="progress-card">
          <div className="progress-ring" aria-label="Campus activity">
            <span>{stats?.openLostFound ?? "—"}</span>
          </div>
          <div>
            <strong>Open lost & found</strong>
            <span>Items waiting to be claimed campus-wide</span>
          </div>
          <div className="milestone">
            <span>Notices</span>
            <strong>{dashLoading ? "…" : (stats?.noticeCount ?? "—")} total</strong>
          </div>
        </article>
      </section>

      <Reveal className="lower-grid lower-grid-reveal" delay={0.08} y={20}>
        <RecentActivity
          bookings={dash?.upcomingBookings || []}
          loading={dashLoading}
        />

        <section className="grades-section">
          <div className="section-heading">
            <h2>Academic snapshot</h2>
          </div>
          <article className="grades-card">
            <div className="grades-header">
              <span>Demo grades</span>
              <Link to="/attendance">Attendance report</Link>
            </div>
            <div className="grade-list">
              {grades.map((grade) => (
                <div className="grade-row" key={grade.label}>
                  <span>{grade.label}</span>
                  <strong className={`grade-pill ${grade.tone}`}>
                    {grade.grade}
                  </strong>
                </div>
              ))}
            </div>
          </article>
        </section>
      </Reveal>

      <Reveal className="quick-actions quick-actions-reveal" delay={0.12} y={16}>
        <article>
          <ClipboardList size={20} />
          <div>
            <strong>Campus notices</strong>
            <span>
              {dashLoading
                ? "Loading…"
                : `${stats?.noticeCount ?? 0} published (see Notices).`}
            </span>
          </div>
        </article>
        <article>
          <Trophy size={20} />
          <div>
            <strong>Community</strong>
            <span>
              {stats?.totalStudents != null
                ? `${stats.totalStudents} students, ${stats.totalTeachers} faculty.`
                : "Connect via bookings and lost & found."}
            </span>
          </div>
        </article>
      </Reveal>
    </main>
  );
};

export default StudentDashboard;
