const QRCode = require("qrcode");
const { randomUUID } = require("crypto");

const usedQRTokens = new Set();

const encodeQRData = (payload) =>
  Buffer.from(JSON.stringify(payload)).toString("base64");

const decodeQRData = (token) => {
  try {
    return JSON.parse(token);
  } catch (error) {
    const decoded = Buffer.from(token, "base64").toString("utf8");
    return JSON.parse(decoded);
  }
};

/**
 * @param {{ sessionId: string, subject?: string, classroom?: string, expiresAt: number | string | Date }} params
 */
const generateQR = async ({ sessionId, subject, classroom, expiresAt }) => {
  const room = subject || classroom;
  if (!sessionId || !room || !expiresAt) {
    throw new Error(
      "sessionId, subject (or classroom), and expiresAt are required to generate a QR code",
    );
  }

  const qrPayload = {
    tokenId: randomUUID(),
    sessionId,
    subject: room,
    classroom: room,
    expiresAt: new Date(expiresAt).toISOString(),
  };

  const token = encodeQRData(qrPayload);
  const dataUrl = await QRCode.toDataURL(token, {
    type: "image/png",
    errorCorrectionLevel: "H",
    margin: 2,
    width: 320,
  });

  return {
    qrBase64: dataUrl,
    token,
    payload: qrPayload,
  };
};

const verifyQRToken = (token) => {
  if (!token) {
    throw new Error("QR token is required for verification");
  }

  let payload;
  try {
    payload = decodeQRData(token);
  } catch (error) {
    throw new Error("Invalid QR token format");
  }

  const { tokenId, sessionId, subject, expiresAt } = payload;
  if (!tokenId || !sessionId || !subject || !expiresAt) {
    throw new Error("QR token payload is incomplete");
  }

  const expiry = new Date(expiresAt);
  if (Number.isNaN(expiry.getTime())) {
    throw new Error("QR token expiry is invalid");
  }

  if (expiry < new Date()) {
    throw new Error("QR token has expired");
  }

  if (usedQRTokens.has(tokenId)) {
    throw new Error("QR token has already been used");
  }

  usedQRTokens.add(tokenId);
  return { sessionId, subject, expiresAt: expiry.toISOString(), tokenId };
};

/**
 * Session QR for class attendance: time-limited, reusable until expiry (no single-use).
 * @param {string} raw — scanned string (base64 token or JSON)
 */
const verifyAttendanceSessionToken = (raw) => {
  if (!raw || typeof raw !== "string") {
    throw new Error("Scan payload is required");
  }

  const trimmed = raw.trim();
  let payload;
  try {
    if (trimmed.startsWith("{")) {
      payload = JSON.parse(trimmed);
    } else {
      payload = decodeQRData(trimmed);
    }
  } catch {
    throw new Error("Invalid attendance QR payload");
  }

  const room = payload.classroom || payload.subject;
  const { sessionId, expiresAt } = payload;
  if (!sessionId || !room || !expiresAt) {
    throw new Error("Attendance QR is missing required fields");
  }

  const expiry = new Date(expiresAt);
  if (Number.isNaN(expiry.getTime())) {
    throw new Error("Attendance QR expiry is invalid");
  }

  if (expiry < new Date()) {
    throw new Error("Attendance QR has expired");
  }

  return {
    sessionId,
    classroom: room,
    expiresAt: expiry.toISOString(),
  };
};

module.exports = {
  generateQR,
  verifyQRToken,
  verifyAttendanceSessionToken,
  encodeQRData,
  decodeQRData,
};
