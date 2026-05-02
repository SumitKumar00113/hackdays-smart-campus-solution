import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { GraduationCap } from "lucide-react";
import { register } from "../../api/authAPI";
import useAuth from "../../hooks/useAuth";
import { getApiErrorMessage } from "../../utils/getApiErrorMessage";

const ease = [0.22, 1, 0.36, 1];

const RegisterPage = () => {
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const { token, applyAuthPayload } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("student");
  const [department, setDepartment] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (token) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const { data } = await register({
        name,
        email,
        password,
        role,
        department: department.trim() || undefined,
      });
      applyAuthPayload(data);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(
        getApiErrorMessage(
          err,
          "Registration failed. Try a different email.",
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
            <h1>Create account</h1>
            <p>Join Smart Campus with your role and department.</p>
          </div>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {error ? (
            <p className="auth-error" role="alert">
              {error}
            </p>
          ) : null}
          <label className="auth-field">
            <span>Full name</span>
            <input
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
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
              autoComplete="new-password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <label className="auth-field">
            <span>Role</span>
            <select
              name="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <label className="auth-field">
            <span>Department (optional)</span>
            <input
              name="department"
              placeholder="e.g. Computer Science"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            />
          </label>
          <button
            className="auth-submit"
            type="submit"
            disabled={submitting}
          >
            {submitting ? "Creating account…" : "Register"}
          </button>
        </form>

        <p className="auth-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </motion.div>
    </div>
  );
};

export default RegisterPage;
