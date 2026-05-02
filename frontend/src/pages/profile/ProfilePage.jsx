import { useCallback, useEffect, useState } from "react";
import { fetchProfile, updateProfile } from "../../api/authAPI";
import useAuth from "../../hooks/useAuth";
import { getApiErrorMessage } from "../../utils/getApiErrorMessage";

const initialsFromName = (name) => {
  if (!name?.trim()) return "?";
  return name
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
};

const ProfilePage = () => {
  const { user, setUser } = useAuth();
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [semester, setSemester] = useState("");
  const [strongSubjects, setStrongSubjects] = useState("");
  const [improvementSubjects, setImprovementSubjects] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [memberSince, setMemberSince] = useState(null);
  const [lastLogin, setLastLogin] = useState(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const applyPayload = useCallback((data) => {
    if (!data) return;
    setName(data.name || "");
    setDepartment(data.department || "");
    setSemester(data.semester || "");
    setStrongSubjects(
      Array.isArray(data.strongSubjects) ? data.strongSubjects.join(", ") : "",
    );
    setImprovementSubjects(
      Array.isArray(data.improvementSubjects)
        ? data.improvementSubjects.join(", ")
        : "",
    );
    setEmail(data.email || "");
    setRole(data.role || "");
    setMemberSince(data.memberSince ? new Date(data.memberSince) : null);
    setLastLogin(data.lastLogin ? new Date(data.lastLogin) : null);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await fetchProfile();
      applyPayload(data);
    } catch (e) {
      setError(getApiErrorMessage(e, "Could not load profile."));
      if (user) {
        setEmail(user.email || "");
        setName(user.name || "");
        setDepartment(user.department || "");
        setSemester(user.semester || "");
        setStrongSubjects(
          Array.isArray(user.strongSubjects)
            ? user.strongSubjects.join(", ")
            : "",
        );
        setImprovementSubjects(
          Array.isArray(user.improvementSubjects)
            ? user.improvementSubjects.join(", ")
            : "",
        );
        setRole(user.role || "");
      }
    } finally {
      setLoading(false);
    }
  }, [applyPayload, user]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword || confirmPassword || currentPassword) {
      if (!currentPassword) {
        setError("Enter your current password to change it.");
        return;
      }
      if (newPassword.length < 6) {
        setError("New password must be at least 6 characters.");
        return;
      }
      if (newPassword !== confirmPassword) {
        setError("New password and confirmation do not match.");
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        department: department.trim(),
        semester: semester.trim(),
        strongSubjects: strongSubjects
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        improvementSubjects: improvementSubjects
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      };
      if (newPassword) {
        payload.currentPassword = currentPassword;
        payload.newPassword = newPassword;
      }
      const { data } = await updateProfile(payload);
      setUser({
        id: data.id,
        _id: data.id,
        name: data.name,
        email: data.email,
        role: data.role,
        department: data.department,
        semester: data.semester,
        strongSubjects: data.strongSubjects,
        improvementSubjects: data.improvementSubjects,
      });
      applyPayload(data);
      setSuccess("Profile updated.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(
        getApiErrorMessage(err, "Could not save profile."),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="page-pad profile-page">
      <h1>Profile</h1>
      <p className="page-lead">
        Full profile settings: account details, semester, strong subjects, and
        subjects you want to improve.
      </p>

      {error ? (
        <p className="page-banner error" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="page-banner success" role="status">
          {success}
        </p>
      ) : null}

      {loading ? (
        <p>Loading profile…</p>
      ) : (
        <form className="profile-layout" onSubmit={handleSave}>
          <section className="panel-card profile-card profile-card--identity">
            <div className="profile-hero">
              <div className="profile-avatar" aria-hidden>
                {initialsFromName(name)}
              </div>
              <div className="profile-hero-text">
                <h2>{name || "Your name"}</h2>
                <p className="profile-email">{email}</p>
                <span className="profile-role-pill">
                  {role ? role.charAt(0).toUpperCase() + role.slice(1) : "—"}
                </span>
              </div>
            </div>
            <dl className="profile-meta">
              <div>
                <dt>Member since</dt>
                <dd>
                  {memberSince
                    ? memberSince.toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })
                    : "—"}
                </dd>
              </div>
              <div>
                <dt>Last sign-in</dt>
                <dd>
                  {lastLogin
                    ? lastLogin.toLocaleString()
                    : "—"}
                </dd>
              </div>
            </dl>
          </section>

          <section className="panel-card profile-card">
            <h2 className="profile-section-title">Account details</h2>
            <div className="grid-form profile-form-grid">
              <label>
                Full name
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                />
              </label>
              <label>
                Department
                <input
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g. Computer Science"
                  autoComplete="organization"
                />
              </label>
              <label>
                Semester
                <input
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                  placeholder="e.g. 4th semester"
                />
              </label>
              <label className="profile-readonly">
                Email
                <input value={email} readOnly tabIndex={-1} />
              </label>
              <label className="profile-readonly">
                Role
                <input
                  value={
                    role
                      ? role.charAt(0).toUpperCase() + role.slice(1)
                      : ""
                  }
                  readOnly
                  tabIndex={-1}
                />
              </label>
            </div>
          </section>

          <section className="panel-card profile-card">
            <h2 className="profile-section-title">Academic focus</h2>
            <p className="muted-line profile-hint">
              Add comma-separated subjects. Example: DSA, DBMS, Java.
            </p>
            <div className="grid-form profile-form-grid">
              <label className="grid-span-2">
                Subjects you are good at
                <textarea
                  rows={3}
                  value={strongSubjects}
                  onChange={(e) => setStrongSubjects(e.target.value)}
                  placeholder="e.g. DSA, DBMS, Computer Networks"
                />
              </label>
              <label className="grid-span-2">
                Subjects you need to work on
                <textarea
                  rows={3}
                  value={improvementSubjects}
                  onChange={(e) => setImprovementSubjects(e.target.value)}
                  placeholder="e.g. Operating Systems, Aptitude"
                />
              </label>
            </div>
          </section>

          <section className="panel-card profile-card">
            <h2 className="profile-section-title">Change password</h2>
            <p className="muted-line profile-hint">
              Leave blank to keep your current password. If you set a new one,
              all three fields are required.
            </p>
            <div className="grid-form profile-form-grid">
              <label>
                Current password
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </label>
              <label>
                New password
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={6}
                />
              </label>
              <label>
                Confirm new password
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </label>
            </div>
          </section>

          <div className="profile-actions">
            <button type="submit" className="profile-save-btn" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      )}
    </main>
  );
};

export default ProfilePage;
