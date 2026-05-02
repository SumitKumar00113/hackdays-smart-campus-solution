const crypto = require("crypto");

/**
 * In-memory session codes: shown in class only, bound to a room + expiry.
 * Each student may redeem a given code at most once per calendar day (local server date).
 */

/** @type {Map<string, { classroom: string, expiresAt: number, sessionId: string, issuedBy: string }>} */
const activeCodes = new Map();

/** "studentId|code|YYYY-MM-DD" */
const redemptionLedger = new Set();

const dateKey = (d = new Date()) => d.toISOString().slice(0, 10);

function generateSixDigitCode() {
  return String(crypto.randomInt(100000, 1000000));
}

function pruneLedger() {
  const today = dateKey();
  for (const k of redemptionLedger) {
    if (!k.endsWith(`|${today}`)) redemptionLedger.delete(k);
  }
}

function pruneExpiredCodes() {
  const now = Date.now();
  for (const [code, data] of activeCodes) {
    if (data.expiresAt < now) activeCodes.delete(code);
  }
}

function pruneAll() {
  pruneExpiredCodes();
  pruneLedger();
}

/**
 * @param {{ classroom: string, durationMinutes?: number, issuedBy: import("mongoose").Types.ObjectId | string }} params
 */
function issueRoomSessionCode({ classroom, durationMinutes = 45, issuedBy }) {
  pruneAll();
  const room = String(classroom || "").trim();
  if (!room) {
    throw new Error("classroom is required");
  }
  const mins = Math.min(Math.max(Number(durationMinutes) || 45, 5), 240);

  let code = generateSixDigitCode();
  let guard = 0;
  while (activeCodes.has(code) && guard < 50) {
    code = generateSixDigitCode();
    guard += 1;
  }
  if (activeCodes.has(code)) {
    throw new Error("Could not generate a unique code; try again.");
  }

  const sessionId = crypto.randomUUID();
  const expiresAt = Date.now() + mins * 60 * 1000;
  activeCodes.set(code, {
    classroom: room,
    expiresAt,
    sessionId,
    issuedBy: String(issuedBy),
  });

  return {
    code,
    classroom: room,
    expiresAt: new Date(expiresAt).toISOString(),
    sessionId,
  };
}

/**
 * @param {{ code: string, studentId: import("mongoose").Types.ObjectId | string }} params
 */
function redeemRoomSessionCode({ code, studentId }) {
  pruneAll();
  const normalized = String(code || "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(normalized)) {
    throw new Error("Enter the 6-digit code displayed for this room.");
  }

  const entry = activeCodes.get(normalized);
  if (!entry) {
    throw new Error(
      "Invalid or expired code. Ask your instructor for today’s code for this room.",
    );
  }
  if (entry.expiresAt < Date.now()) {
    activeCodes.delete(normalized);
    throw new Error("This code has expired. Ask for a new one.");
  }

  const ledgerKey = `${String(studentId)}|${normalized}|${dateKey()}`;
  if (redemptionLedger.has(ledgerKey)) {
    throw new Error("You already used this code today.");
  }
  redemptionLedger.add(ledgerKey);

  return {
    classroom: entry.classroom,
    sessionId: entry.sessionId,
    code: normalized,
  };
}

module.exports = {
  issueRoomSessionCode,
  redeemRoomSessionCode,
  pruneAll,
};
