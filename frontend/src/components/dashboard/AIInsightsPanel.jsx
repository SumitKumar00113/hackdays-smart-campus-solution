import { ArrowRight, Bot, CalendarHeart, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

const AIInsightsPanel = ({
  tip,
  loading,
  error,
  studyTip,
  studyLoading,
  studyError,
}) => (
  <section className="ai-panel">
    <div className="ai-kicker">
      <Sparkles size={18} />
      <span>Campus insights</span>
    </div>
    <h2>
      {loading
        ? "Generating a quick insight from live attendance data…"
        : error ||
          tip ||
          "Sign in and use the AI assistant for personalized campus help — room bookings, notices, and attendance."}
    </h2>

    <div className="ai-study-block">
      <div className="ai-study-kicker">
        <CalendarHeart size={17} />
        <span>Study session picks</span>
      </div>
      <p className="ai-study-text">
        {studyLoading
          ? "Finding open sessions that match your profile…"
          : studyError ||
            studyTip ||
            "Sign in to get AI-matched study session ideas from live room bookings."}
      </p>
    </div>

    <div className="ai-tip">
      <Bot size={20} />
      <span>
        Tip: open <strong>Room Booking</strong> to join sessions; suggestions
        use your department and open seats on the server.
      </span>
    </div>
    <Link className="ai-button" to="/bookings">
      <span>Browse & join sessions</span>
      <ArrowRight size={18} />
    </Link>
    <Link className="ai-button ai-button--ghost" to="/ai">
      <span>Open AI assistant</span>
      <ArrowRight size={18} />
    </Link>
  </section>
);

export default AIInsightsPanel;
