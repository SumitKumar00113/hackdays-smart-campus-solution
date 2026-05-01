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

const generateQR = async ({ sessionId, subject, expiresAt }) => {
  if (!sessionId || !subject || !expiresAt) {
    throw new Error(
      "sessionId, subject, and expiresAt are required to generate a QR code",
    );
  }

  const qrPayload = {
    tokenId: randomUUID(),
    sessionId,
    subject,
    expiresAt: new Date(expiresAt).toISOString(),
  };

  const payloadString = JSON.stringify(qrPayload);
  const dataUrl = await QRCode.toDataURL(payloadString, {
    type: "image/png",
    errorCorrectionLevel: "H",
    margin: 2,
    width: 300,
  });

  return {
    qrBase64: dataUrl,
    token: encodeQRData(qrPayload),
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

module.exports = { generateQR, verifyQRToken };
