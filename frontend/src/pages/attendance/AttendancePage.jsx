import { lazy, Suspense, useCallback, useEffect, useState } from "react";

const AttendanceScanPanel = lazy(() =>
  import("../../components/attendance/AttendanceScanPanel"),
);
const AttendanceRoomCodePanel = lazy(() =>
  import("../../components/attendance/AttendanceRoomCodePanel"),
);
import useAuth from "../../hooks/useAuth";
import { fetchAttendance, markAttendance } from "../../api/attendanceAPI";
import { getApiErrorMessage } from "../../utils/getApiErrorMessage";

const AttendancePage = () => {
  const { user } = useAuth();
  const userId = user?._id || user?.id;
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [classroom, setClassroom] = useState("Main lecture hall");
  const [status, setStatus] = useState("present");
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState("manual");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await fetchAttendance();
      const all = Array.isArray(data) ? data : [];
      const mine = userId
        ? all.filter(
            (r) =>
              r.student?._id === userId ||
              r.student === userId ||
              String(r.student?._id) === String(userId),
          )
        : all;
      setRecords(userId ? mine : all);
    } catch (e) {
      setError(getApiErrorMessage(e, "Could not load attendance."));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleMark = async (e) => {
    e.preventDefault();
    if (!userId) {
      setError("Sign in to record attendance.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await markAttendance({
        student: userId,
        classroom: classroom.trim() || "General",
        status,
        date: new Date().toISOString(),
      });
      await load();
    } catch (err) {
      setError(
        getApiErrorMessage(err, "Could not save attendance."),
      );
    } finally {
      setSaving(false);
    }
  };

  const presentCount = records.filter(
    (r) => r.status === "present" || r.status === "late",
  ).length;
  const rate =
    records.length > 0
      ? Math.round((presentCount / records.length) * 100)
      : null;

  return (
    <main className="page-pad attendance-page">
      <h1>Attendance</h1>
      <p className="page-lead">
        Mark yourself present (manual, in-room session code, or QR + face) and
        review your recent records.
      </p>

      <div className="attendance-mode-tabs" role="tablist" aria-label="Attendance mode">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "manual"}
          className={mode === "manual" ? "is-active" : ""}
          onClick={() => setMode("manual")}
        >
          Manual entry
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "room-code"}
          className={mode === "room-code" ? "is-active" : ""}
          onClick={() => setMode("room-code")}
        >
          Room session code
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "scan"}
          className={mode === "scan" ? "is-active" : ""}
          onClick={() => setMode("scan")}
        >
          QR scan & face check-in
        </button>
      </div>

      {error ? (
        <p className="page-banner error" role="alert">
          {error}
        </p>
      ) : null}

      {mode === "room-code" ? (
        <Suspense fallback={<p className="panel-card">Loading…</p>}>
          <AttendanceRoomCodePanel onMarked={load} />
        </Suspense>
      ) : null}

      {mode === "scan" ? (
        <Suspense fallback={<p className="panel-card">Loading scanner…</p>}>
          <AttendanceScanPanel onMarked={load} />
        </Suspense>
      ) : null}

      {mode === "manual" ? (
      <section className="panel-card">
        <h2>Mark today</h2>
        <form className="grid-form" onSubmit={handleMark}>
          <p
            style={{
              gridColumn: "1 / -1",
              margin: 0,
              fontSize: "0.9rem",
              color: "var(--muted)",
            }}
          >
            Manual entry is the least secure option; prefer a room code or QR +
            face when available.
          </p>
          <label>
            Classroom / label
            <input
              value={classroom}
              onChange={(e) => setClassroom(e.target.value)}
              required
            />
          </label>
          <label>
            Status
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="present">Present</option>
              <option value="late">Late</option>
              <option value="absent">Absent</option>
            </select>
          </label>
          <div className="form-actions">
            <button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save attendance"}
            </button>
          </div>
        </form>
      </section>
      ) : null}

      <section className="panel-card">
        <h2>Your records {rate != null ? `(${rate}% present)` : ""}</h2>
        {loading ? (
          <p>Loading…</p>
        ) : records.length === 0 ? (
          <p>No rows yet. Submit the form above to create your first entry.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Classroom</th>
                  <th>Status</th>
                  <th>Method</th>
                </tr>
              </thead>
              <tbody>
                {records.slice(0, 25).map((r) => (
                  <tr key={r._id}>
                    <td>
                      {r.date ? new Date(r.date).toLocaleString() : "—"}
                    </td>
                    <td>{r.classroom}</td>
                    <td>{r.status}</td>
                    <td>
                      {r.checkInMethod === "room_code"
                        ? "Room code"
                        : r.checkInMethod === "qr_face"
                          ? "QR + face"
                          : r.checkInMethod === "manual"
                            ? "Manual"
                            : r.checkInMethod || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
};

export default AttendancePage;
