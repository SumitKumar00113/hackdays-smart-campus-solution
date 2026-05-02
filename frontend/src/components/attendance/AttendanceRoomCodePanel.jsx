import { useCallback, useState } from "react";
import useAuth from "../../hooks/useAuth";
import {
  issueAttendanceRoomCode,
  redeemAttendanceRoomCode,
} from "../../api/attendanceAPI";
import { getApiErrorMessage } from "../../utils/getApiErrorMessage";

const AttendanceRoomCodePanel = ({ onMarked }) => {
  const { user } = useAuth();
  const userId = user?.id || user?._id;

  const [teacherRoom, setTeacherRoom] = useState("Main lecture hall");
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [issued, setIssued] = useState(null);
  const [issueBusy, setIssueBusy] = useState(false);
  const [issueMsg, setIssueMsg] = useState("");

  const [studentCode, setStudentCode] = useState("");
  const [redeemBusy, setRedeemBusy] = useState(false);
  const [redeemMsg, setRedeemMsg] = useState("");

  const handleIssue = async (e) => {
    e.preventDefault();
    if (!userId) {
      setIssueMsg("Sign in to generate a room code.");
      return;
    }
    setIssueBusy(true);
    setIssueMsg("");
    try {
      const { data } = await issueAttendanceRoomCode({
        classroom: teacherRoom.trim() || "General",
        durationMinutes: Number(durationMinutes) || 45,
      });
      setIssued(data);
    } catch (err) {
      setIssueMsg(getApiErrorMessage(err, "Could not create room code."));
    } finally {
      setIssueBusy(false);
    }
  };

  const handleRedeem = useCallback(
    async (e) => {
      e.preventDefault();
      if (!userId) {
        setRedeemMsg("Sign in to check in with a room code.");
        return;
      }
      const digits = studentCode.replace(/\D/g, "").slice(0, 6);
      if (digits.length !== 6) {
        setRedeemMsg("Enter all 6 digits from the screen in your room.");
        return;
      }
      setRedeemBusy(true);
      setRedeemMsg("");
      try {
        await redeemAttendanceRoomCode({ code: digits });
        setStudentCode("");
        setRedeemMsg("Checked in successfully.");
        onMarked?.();
      } catch (err) {
        setRedeemMsg(
          getApiErrorMessage(err, "Could not redeem this code."),
        );
      } finally {
        setRedeemBusy(false);
      }
    },
    [userId, studentCode, onMarked],
  );

  return (
    <div className="attendance-scan-panel attendance-room-code-panel">
      <p className="subtle">
        The instructor generates a short code for the <strong>selected room</strong> and
        displays it in class. Students enter it to mark attendance—remote classmates
        cannot guess the room without being there when it is shown.
      </p>

      <div className="attendance-room-code-grid">
        <section className="panel-card">
          <h2>Instructor: issue room code</h2>
          <form className="grid-form" onSubmit={handleIssue}>
            <label>
              Room / classroom
              <input
                value={teacherRoom}
                onChange={(e) => setTeacherRoom(e.target.value)}
                required
                placeholder="e.g. Lab 204"
              />
            </label>
            <label>
              Valid for (minutes)
              <input
                type="number"
                min={5}
                max={240}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
              />
            </label>
            <div className="form-actions">
              <button type="submit" disabled={issueBusy}>
                {issueBusy ? "Generating…" : "Generate 6-digit code"}
              </button>
            </div>
          </form>
          {issueMsg ? (
            <p className="page-banner error" role="alert">
              {issueMsg}
            </p>
          ) : null}
          {issued ? (
            <div style={{ marginTop: 16 }}>
              <p className="enrollment-status">Show this in the room only</p>
              <div
                className="room-code-display"
                aria-live="polite"
              >
                {String(issued.code).padStart(6, "0")}
              </div>
              <p className="subtle" style={{ marginTop: 8 }}>
                Room: <strong>{issued.classroom}</strong>
                <br />
                Expires:{" "}
                {issued.expiresAt
                  ? new Date(issued.expiresAt).toLocaleString()
                  : "—"}
              </p>
            </div>
          ) : null}
        </section>

        <section className="panel-card">
          <h2>Student: enter room code</h2>
          <form className="grid-form" onSubmit={handleRedeem}>
            <label>
              6-digit code
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={studentCode}
                onChange={(e) =>
                  setStudentCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="000000"
              />
            </label>
            <div className="form-actions">
              <button type="submit" disabled={redeemBusy}>
                {redeemBusy ? "Checking in…" : "Mark present for this room"}
              </button>
            </div>
          </form>
          {redeemMsg ? (
            <p
              className={
                redeemMsg.includes("success")
                  ? "page-banner success"
                  : "page-banner error"
              }
              role="status"
            >
              {redeemMsg}
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
};

export default AttendanceRoomCodePanel;
