import { useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import useAuth from "../../hooks/useAuth";
import {
  enrollFace as enrollFaceApi,
  generateAttendanceQR,
  getFaceEnrollment,
  verifyAttendanceScan,
} from "../../api/attendanceAPI";
import { getApiErrorMessage } from "../../utils/getApiErrorMessage";
import { getFaceDescriptorFromVideo, loadFaceModels } from "../../lib/faceModels";

const SCANNER_ELEMENT_ID = "attendance-qr-scanner-region";

const AttendanceScanPanel = ({ onMarked }) => {
  const { user } = useAuth();
  const userId = user?.id || user?._id;

  const [faceEnrollment, setFaceEnrollment] = useState({
    loaded: false,
    enrolled: false,
  });
  const [enrollMsg, setEnrollMsg] = useState("");
  const [enrollBusy, setEnrollBusy] = useState(false);

  const [teacherRoom, setTeacherRoom] = useState("Main lecture hall");
  const [teacherMinutes, setTeacherMinutes] = useState(45);
  const [qrImage, setQrImage] = useState("");
  const [sessionMeta, setSessionMeta] = useState(null);
  const [teacherBusy, setTeacherBusy] = useState(false);

  const [scannedToken, setScannedToken] = useState("");
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef(null);

  const videoRef = useRef(null);
  const videoStreamRef = useRef(null);
  const [videoReady, setVideoReady] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState("");
  const [verifyBusy, setVerifyBusy] = useState(false);

  const refreshEnrollment = useCallback(async () => {
    if (!userId) return;
    try {
      const { data } = await getFaceEnrollment();
      setFaceEnrollment({ loaded: true, enrolled: Boolean(data?.enrolled) });
    } catch {
      setFaceEnrollment({ loaded: true, enrolled: false });
    }
  }, [userId]);

  useEffect(() => {
    refreshEnrollment();
  }, [refreshEnrollment]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadFaceModels();
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 640, height: 480 },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        videoStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setVideoReady(true);
        }
      } catch {
        if (!cancelled) setVerifyMsg("Allow camera access for face verification.");
      }
    })();
    return () => {
      cancelled = true;
      videoStreamRef.current?.getTracks().forEach((t) => t.stop());
      videoStreamRef.current = null;
    };
  }, []);

  const stopScanner = useCallback(async () => {
    const inst = scannerRef.current;
    scannerRef.current = null;
    if (inst) {
      try {
        await inst.stop();
      } catch {
        /* not running */
      }
      try {
        await inst.clear();
      } catch {
        /* ignore */
      }
    }
    setScanning(false);
  }, []);

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, [stopScanner]);

  const startScanner = async () => {
    setVerifyMsg("");
    await stopScanner();
    setScanning(true);
    const html5 = new Html5Qrcode(SCANNER_ELEMENT_ID);
    scannerRef.current = html5;
    try {
      await html5.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 260, height: 260 } },
        (decodedText) => {
          setScannedToken(decodedText.trim());
          stopScanner();
        },
        () => {},
      );
    } catch (e) {
      setScanning(false);
      scannerRef.current = null;
      setVerifyMsg(
        getApiErrorMessage(e, "Could not start the QR camera (try HTTPS or another browser)."),
      );
    }
  };

  const handleGenerateQr = async (e) => {
    e.preventDefault();
    setTeacherBusy(true);
    setVerifyMsg("");
    try {
      const { data } = await generateAttendanceQR({
        classroom: teacherRoom.trim(),
        durationMinutes: Number(teacherMinutes) || 45,
      });
      setQrImage(data.qrImage || "");
      setSessionMeta({
        classroom: data.classroom,
        expiresAt: data.expiresAt,
        sessionId: data.sessionId,
      });
    } catch (err) {
      setVerifyMsg(getApiErrorMessage(err, "Could not generate session QR."));
    } finally {
      setTeacherBusy(false);
    }
  };

  const handleEnrollFace = async () => {
    if (!videoRef.current || !videoReady) {
      setEnrollMsg("Camera is not ready yet.");
      return;
    }
    setEnrollBusy(true);
    setEnrollMsg("");
    try {
      const descriptor = await getFaceDescriptorFromVideo(videoRef.current);
      if (!descriptor) {
        setEnrollMsg("No face detected. Face the camera with good lighting.");
        return;
      }
      await enrollFaceApi({ descriptor });
      await refreshEnrollment();
      setEnrollMsg("Face enrolled. You can use QR check-in.");
    } catch (err) {
      setEnrollMsg(getApiErrorMessage(err, "Enrollment failed."));
    } finally {
      setEnrollBusy(false);
    }
  };

  const handleVerifyScan = async () => {
    if (!scannedToken) {
      setVerifyMsg("Scan the session QR code first.");
      return;
    }
    if (!faceEnrollment.enrolled) {
      setVerifyMsg("Enroll your face before checking in.");
      return;
    }
    if (!videoRef.current || !videoReady) {
      setVerifyMsg("Camera is not ready.");
      return;
    }
    setVerifyBusy(true);
    setVerifyMsg("");
    try {
      const descriptor = await getFaceDescriptorFromVideo(videoRef.current);
      if (!descriptor) {
        setVerifyMsg("No face detected for verification.");
        return;
      }
      const { data } = await verifyAttendanceScan({
        token: scannedToken,
        faceDescriptor: descriptor,
      });
      setVerifyMsg(data?.message || "Checked in.");
      setScannedToken("");
      onMarked?.();
    } catch (err) {
      setVerifyMsg(
        getApiErrorMessage(
          err,
          "Check-in failed. Confirm QR is current and your face matches enrollment.",
        ),
      );
    } finally {
      setVerifyBusy(false);
    }
  };

  return (
    <div className="attendance-scan-panel">
      <section className="panel-card">
        <h2>Face enrollment</h2>
        <p className="page-lead subtle">
          One-time setup: we store a numeric face vector on your account (not a
          photo). Use the same lighting next time for best matches.
        </p>
        <p className="enrollment-status">
          Status:{" "}
          {!faceEnrollment.loaded
            ? "Loading…"
            : faceEnrollment.enrolled
              ? "Enrolled — ready for QR check-in"
              : "Not enrolled yet"}
        </p>
        {enrollMsg ? (
          <p className="page-banner error" role="alert">
            {enrollMsg}
          </p>
        ) : null}
        <div className="face-preview-row">
          <video
            ref={videoRef}
            className="face-preview-video"
            playsInline
            muted
            width={320}
            height={240}
          />
          <div className="face-preview-actions">
            <button
              type="button"
              onClick={handleEnrollFace}
              disabled={enrollBusy || !videoReady}
            >
              {enrollBusy ? "Saving…" : "Capture & save face profile"}
            </button>
          </div>
        </div>
      </section>

      <section className="panel-card">
        <h2>Teacher: session QR</h2>
        <p className="page-lead subtle">
          Generate a QR for the room; it expires after the set duration. Students
          scan it and verify with their enrolled face.
        </p>
        <form className="grid-form" onSubmit={handleGenerateQr}>
          <label>
            Classroom
            <input
              value={teacherRoom}
              onChange={(e) => setTeacherRoom(e.target.value)}
              required
            />
          </label>
          <label>
            Valid for (minutes)
            <input
              type="number"
              min={5}
              max={720}
              value={teacherMinutes}
              onChange={(e) => setTeacherMinutes(e.target.value)}
            />
          </label>
          <div className="form-actions">
            <button type="submit" disabled={teacherBusy}>
              {teacherBusy ? "Generating…" : "Generate QR"}
            </button>
          </div>
        </form>
        {sessionMeta ? (
          <p className="session-meta subtle">
            Session for <strong>{sessionMeta.classroom}</strong> · expires{" "}
            {sessionMeta.expiresAt
              ? new Date(sessionMeta.expiresAt).toLocaleString()
              : "—"}
          </p>
        ) : null}
        {qrImage ? (
          <div className="qr-image-wrap">
            <img src={qrImage} alt="Attendance session QR code" />
          </div>
        ) : null}
      </section>

      <section className="panel-card">
        <h2>Student: scan & check in</h2>
        <p className="page-lead subtle">
          1) Start the scanner and point at the projected QR. 2) Then capture
          your face using the preview above to submit verification.
        </p>
        <div className="qr-scanner-wrap">
          <div id={SCANNER_ELEMENT_ID} className="qr-scanner-region" />
        </div>
        <div className="scan-actions">
          {!scanning ? (
            <button type="button" onClick={startScanner}>
              Start QR scanner
            </button>
          ) : (
            <button type="button" onClick={stopScanner}>
              Stop scanner
            </button>
          )}
        </div>
        {scannedToken ? (
          <p className="scanned-token subtle">
            QR captured ({scannedToken.length} chars). Ready for face verification.
          </p>
        ) : (
          <p className="subtle">No QR scanned yet.</p>
        )}
        {verifyMsg ? (
          <p
            className={
              verifyMsg.includes("failed") || verifyMsg.includes("Could not")
                ? "page-banner error"
                : "page-banner success"
            }
            role="status"
          >
            {verifyMsg}
          </p>
        ) : null}
        <div className="form-actions">
          <button
            type="button"
            onClick={handleVerifyScan}
            disabled={
              verifyBusy ||
              !scannedToken ||
              !faceEnrollment.enrolled ||
              !videoReady
            }
          >
            {verifyBusy ? "Verifying…" : "Verify face & mark attendance"}
          </button>
        </div>
      </section>
    </div>
  );
};

export default AttendanceScanPanel;
