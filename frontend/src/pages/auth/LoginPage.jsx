import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Link, Navigate, useNavigate, useLocation } from "react-router-dom";
import { GraduationCap } from "lucide-react";
import { login } from "../../api/authAPI";
import useAuth from "../../hooks/useAuth";
import { getApiErrorMessage } from "../../utils/getApiErrorMessage";

const ease = [0.22, 1, 0.36, 1];

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const reduce = useReducedMotion();
  const { token, applyAuthPayload } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const from = location.state?.from?.pathname || "/dashboard";

  if (token) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const { data } = await login({ email, password });
      applyAuthPayload(data);
      navigate(from, { replace: true });
    } catch (err) {
      setError(
        getApiErrorMessage(
          err,
          "Could not sign in. Check your email and password.",
        ),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const cardMotion = reduce
    ? {}
    : {
        initial: { opacity: 0, y: 40, scale: 0.96 },
        animate: { opacity: 1, y: 0, scale: 1 },
        transition: { duration: 0.65, ease },
      };

  return (
    <div className="auth-shell">
      <motion.div className="auth-card" {...cardMotion}>
        <div className="auth-brand">
          <div className="brand-mark">
            <GraduationCap size={22} strokeWidth={2.4} />
          </div>
          <div>
            <h1>Sign in</h1>
            <p>CampusConnect — use your campus account.</p>
          </div>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {error ? (
            <p className="auth-error" role="alert">
              {error}
            </p>
          ) : null}
          <label className="auth-field">
            <span>Email</span>
            <input
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="auth-field">
            <span>Password</span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <button
            className="auth-submit"
            type="submit"
            disabled={submitting}
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="auth-footer">
          No account? <Link to="/register">Create one</Link>
        </p>
      </motion.div>
    </div>
  );
};

export default LoginPage;
